const { query, validationResult } = require('express-validator');
const axios = require('axios');

// Validation middleware for contact ID
const validateContactId = [
  query('contactId')
    .notEmpty()
    .withMessage('contactId is required')
    .isLength({ min: 1, max: 50 })
    .withMessage('contactId must be between 1 and 50 characters')
    .matches(/^[a-zA-Z0-9_-]+$/)
    .withMessage('contactId contains invalid characters')
];

// GoHighLevel API configuration
const GHL_API_BASE = 'https://services.leadconnectorhq.com';
const GHL_API_KEY = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;

// Helper function to make GHL API requests
async function makeGHLRequest(method, endpoint, data = null) {
  try {
    const config = {
      method,
      url: `${GHL_API_BASE}${endpoint}`,
      headers: {
        'Authorization': `Bearer ${GHL_API_KEY}`,
        'Content-Type': 'application/json',
        'Version': '2021-07-28'
      }
    };

    if (data) {
      config.data = data;
    }

    const response = await axios(config);
    return response.data;
  } catch (error) {
    console.error('GHL API Request Error:', {
      endpoint,
      method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw error;
  }
}

// Simple rate limiting for serverless
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 requests per minute

function checkRateLimit(ip) {
  const now = Date.now();
  const userRequests = rateLimitMap.get(ip) || [];
  
  // Remove old requests outside the window
  const validRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);
  
  if (validRequests.length >= RATE_LIMIT_MAX) {
    return false;
  }
  
  validRequests.push(now);
  rateLimitMap.set(ip, validRequests);
  return true;
}

// Manual validation function for serverless
function validateRequest(req) {
  const { contactId } = req.query;
  const errors = [];

  if (!contactId) {
    errors.push({ msg: 'contactId is required', param: 'contactId' });
  } else if (contactId.length < 1 || contactId.length > 50) {
    errors.push({ msg: 'contactId must be between 1 and 50 characters', param: 'contactId' });
  } else if (!/^[a-zA-Z0-9_-]+$/.test(contactId)) {
    errors.push({ msg: 'contactId contains invalid characters', param: 'contactId' });
  }

  return errors;
}

module.exports = async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      error: 'Method not allowed'
    });
  }

  // Check environment variables
  if (!GHL_API_KEY || !GHL_LOCATION_ID) {
    console.error('Missing required environment variables');
    return res.status(500).json({
      success: false,
      error: 'Server configuration error'
    });
  }

  // Rate limiting
  const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
  if (!checkRateLimit(clientIP)) {
    return res.status(429).json({
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: '1 minute'
    });
  }

  const startTime = Date.now();
  const { contactId } = req.query;

  // Validate request
  const validationErrors = validateRequest(req);
  if (validationErrors.length > 0) {
    console.log('Validation failed:', {
      contactId,
      errors: validationErrors,
      timestamp: new Date().toISOString()
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid request parameters',
      details: validationErrors
    });
  }

  try {
    console.log(`Processing referral increment for contact: ${contactId}`);

    // Step 1: Fetch the contact using location-specific endpoint
    const contact = await makeGHLRequest('GET', `/locations/${GHL_LOCATION_ID}/contacts/${contactId}`);
    
    if (!contact || !contact.contact) {
      console.log(`Contact not found: ${contactId}`);
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    // Step 2: Get current referral count
    const customFields = contact.contact.customFields || [];
    const referralCountField = customFields.find(field => 
      field.key === 'referral_count' || field.id === 'referral_count'
    );

    let currentCount = 0;
    if (referralCountField && referralCountField.value) {
      currentCount = parseInt(referralCountField.value, 10) || 0;
    }

    const newCount = currentCount + 1;

    console.log(`Current referral count: ${currentCount}, incrementing to: ${newCount}`);

    // Step 3: Update the contact with new referral count using location-specific endpoint
    const updateData = {
      customFields: [
        {
          key: 'referral_count',
          field_value: newCount.toString()
        }
      ]
    };

    await makeGHLRequest('PUT', `/locations/${GHL_LOCATION_ID}/contacts/${contactId}`, updateData);

    const processingTime = Date.now() - startTime;
    
    console.log(`Successfully updated referral count for contact ${contactId}:`, {
      previousCount: currentCount,
      newCount: newCount,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });

    res.status(200).json({
      success: true,
      message: 'Referral count updated successfully',
      data: {
        contactId,
        previousCount: currentCount,
        newCount: newCount,
        processingTimeMs: processingTime
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    
    console.error(`Failed to update referral count for contact ${contactId}:`, {
      error: error.message,
      status: error.response?.status,
      processingTimeMs: processingTime,
      timestamp: new Date().toISOString()
    });

    // Handle different types of errors
    if (error.response?.status === 401) {
      return res.status(500).json({
        success: false,
        error: 'Authentication failed with GoHighLevel API'
      });
    }

    if (error.response?.status === 403) {
      return res.status(500).json({
        success: false,
        error: 'Access denied to GoHighLevel API'
      });
    }

    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found'
      });
    }

    if (error.response?.status === 429) {
      return res.status(429).json({
        success: false,
        error: 'Rate limit exceeded, please try again later'
      });
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: 'Internal server error occurred while updating referral count'
    });
  }
};