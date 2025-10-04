// Simple API key validation middleware
const validateApiKey = (req, res, next) => {
  // Skip authentication in development
  if (process.env.NODE_ENV === 'development') {
    return next();
  }

  // Get API key from header
  const apiKey = req.headers['x-api-key'] || req.query.apiKey;
  
  // For production, you can validate against environment variables
  const validApiKeys = process.env.VALID_API_KEYS ? process.env.VALID_API_KEYS.split(',') : [];
  
  // If no API keys are configured, allow all requests
  if (validApiKeys.length === 0) {
    return next();
  }
  
  if (!apiKey || !validApiKeys.includes(apiKey)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or missing API key',
      code: 'INVALID_API_KEY'
    });
  }
  
  next();
};

module.exports = {
  validateApiKey
};