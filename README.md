# GoHighLevel Referral Webhook Server

A secure Node.js webhook server that integrates with the GoHighLevel API to automatically increment referral counts for contacts. Optimized for deployment on Vercel.

## Features

- **Secure Webhook Endpoint**: Accepts GET requests with contact ID validation
- **GoHighLevel Integration**: Fetches and updates contact custom fields
- **Rate Limiting**: 10 requests per minute per IP to prevent abuse
- **Input Validation**: Validates contact IDs and request parameters
- **Error Handling**: Comprehensive error handling with appropriate HTTP status codes
- **Security Headers**: CORS support for cross-origin requests
- **Logging**: Detailed logging for successful updates and errors
- **Health Check**: Built-in health check endpoint
- **Serverless Ready**: Optimized for Vercel deployment

## Deployment to Vercel

### Quick Deploy
[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/ghl-referral-webhook)

### Manual Deployment

1. **Install Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**
   ```bash
   vercel login
   ```

3. **Set Environment Variables**
   ```bash
   vercel env add GHL_API_KEY
   vercel env add GHL_LOCATION_ID
   ```
   Enter your actual GoHighLevel API key and Location ID when prompted.

4. **Deploy**
   ```bash
   vercel --prod
   ```

### Environment Variables Setup

In your Vercel dashboard:
1. Go to your project settings
2. Navigate to "Environment Variables"
3. Add the following variables:
   - `GHL_API_KEY`: Your GoHighLevel API key
   - `GHL_LOCATION_ID`: Your GoHighLevel Location ID

## Local Development

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` and add your GoHighLevel credentials:
   ```
   GHL_API_KEY=your_actual_api_key_here
   GHL_LOCATION_ID=your_actual_location_id_here
   PORT=3000
   ```

3. **Start the Server**
   ```bash
   # Development (with auto-reload)
   npm run dev
   
   # Production
   npm start
   ```

4. **Test with Vercel Dev (Recommended for Vercel deployment)**
   ```bash
   vercel dev
   ```

## API Endpoints

### Increment Referral Count
- **URL**: `/increment-referral`
- **Method**: `GET`
- **Query Parameters**:
  - `contactId` (required): The GoHighLevel contact ID

**Example Request**:
```
GET /increment-referral?contactId=abc123xyz
```

**Success Response** (200):
```json
{
  "success": true,
  "message": "Referral count updated successfully",
  "data": {
    "contactId": "abc123xyz",
    "previousCount": 5,
    "newCount": 6,
    "processingTimeMs": 234
  }
}
```

**Error Response** (400):
```json
{
  "success": false,
  "error": "Invalid request parameters",
  "details": [
    {
      "msg": "contactId is required",
      "param": "contactId"
    }
  ]
}
```

### Health Check
- **URL**: `/health`
- **Method**: `GET`

**Response** (200):
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:45.123Z",
  "platform": "vercel",
  "environment": "production"
}
```

## Usage Examples

### Production URL (after deployment)
```
https://your-app-name.vercel.app/increment-referral?contactId=abc123xyz456
```

### Using curl
```bash
curl "https://your-app-name.vercel.app/increment-referral?contactId=abc123xyz456"
```

### Using JavaScript fetch
```javascript
const response = await fetch('https://your-app-name.vercel.app/increment-referral?contactId=abc123xyz456');
const result = await response.json();
console.log(result);
```

## Security Features

- **Rate Limiting**: 10 requests per minute per IP address
- **Input Validation**: Contact ID validation with character restrictions
- **CORS Headers**: Proper cross-origin resource sharing configuration
- **Environment Variables**: API keys stored securely in environment variables
- **Error Handling**: Prevents information leakage through error messages

## GoHighLevel API Integration

The server integrates with GoHighLevel's API to:
1. Fetch contact details using the contact ID and Location ID
2. Locate the `referral_count` custom field
3. Increment the value by 1
4. Update the contact with the new value

### Required Custom Field

Ensure your GoHighLevel account has a custom field named `referral_count` configured for contacts.

### Getting Your Credentials

**API Key**:
1. Log into your GoHighLevel account
2. Go to Settings > Integrations > API
3. Generate or copy your API key

**Location ID**:
1. Found in your GoHighLevel dashboard URL
2. Or go to Settings > Company Info
3. The Location ID is displayed there

## Error Handling

The server handles various error scenarios:
- **400**: Invalid request parameters
- **404**: Contact not found
- **405**: Method not allowed
- **429**: Rate limit exceeded
- **500**: Internal server errors, API authentication issues

## Monitoring and Logs

View logs in your Vercel dashboard:
1. Go to your project in Vercel
2. Click on "Functions" tab
3. View real-time logs and performance metrics

## Development vs Production

- **Local Development**: Use `npm run dev` or `vercel dev`
- **Production**: Deployed automatically on Vercel with `vercel --prod`
- **Environment**: Automatically detected (development/production)

## Troubleshooting

### Common Issues

1. **Environment Variables Not Set**
   - Ensure `GHL_API_KEY` and `GHL_LOCATION_ID` are set in Vercel dashboard
   - Redeploy after adding environment variables

2. **Contact Not Found**
   - Verify the contact ID exists in your GoHighLevel account
   - Ensure you're using the correct Location ID

3. **API Authentication Failed**
   - Check your API key is valid and has proper permissions
   - Verify the API key hasn't expired

4. **Rate Limiting**
   - Wait 1 minute between bursts of requests
   - Consider implementing exponential backoff in your client

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally with `vercel dev`
5. Submit a pull request

## License

This project is licensed under the MIT License.