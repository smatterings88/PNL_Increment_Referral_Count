const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { query, validationResult } = require('express-validator');
const axios = require('axios');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Security middleware
app.use(helmet());

// Rate limiting - 10 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 requests per windowMs
  message: {
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: '1 minute'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/increment-referral', limiter);

// Middleware to parse JSON
app.use(express.json());

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

if (!GHL_API_KEY) {
  console.error('ERROR: GHL_API_KEY environment variable is required');
  process.exit(1);
}

if (!GHL_LOCATION_ID) {
  console.error('ERROR: GHL_LOCATION_ID environment variable is required');
  process.exit(1);
}

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

// Webhook endpoint to increment referral count
app.get('/increment-referral', validateContactId, async (req, res) => {
  const startTime = Date.now();
  const { contactId } = req.query;

  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Validation failed:', {
      contactId,
      errors: errors.array(),
      timestamp: new Date().toISOString()
    });
    return res.status(400).json({
      success: false,
      error: 'Invalid request parameters',
      details: errors.array()
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
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Handle 404 for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    availableEndpoints: [
      'GET /increment-referral?contactId=<id>',
      'GET /health'
    ]
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  res.status(500).json({
    success: false,
    error: 'Internal server error'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`🚀 GoHighLevel Referral Webhook Server running on port ${PORT}`);
  console.log(`📊 Health check available at: http://localhost:${PORT}/health`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/increment-referral?contactId=<CONTACT_ID>`);
  console.log(`🔐 Rate limit: 10 requests per minute per IP`);
  console.log(`📍 Using Location ID: ${GHL_LOCATION_ID}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});