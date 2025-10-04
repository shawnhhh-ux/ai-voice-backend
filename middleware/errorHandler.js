// Global error handling middleware
const errorHandler = (err, req, res, next) => {
  console.error('Global error handler:', err);

  // Default error
  let error = { 
    message: 'Internal server error', 
    statusCode: 500,
    code: 'INTERNAL_ERROR'
  };

  // Axios error (external API calls)
  if (err.isAxiosError) {
    error.message = 'External service error';
    error.statusCode = 502;
    error.code = 'EXTERNAL_SERVICE_ERROR';
  }

  // Rate limit error
  if (err.statusCode === 429) {
    error.message = 'Too many requests';
    error.statusCode = 429;
    error.code = 'RATE_LIMIT_EXCEEDED';
  }

  // JSON parse error
  if (err.type === 'entity.parse.failed') {
    error.message = 'Invalid JSON in request body';
    error.statusCode = 400;
    error.code = 'INVALID_JSON';
  }

  const response = {
    success: false,
    error: error.message,
    code: error.code
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
    response.details = err.message;
  }

  res.status(error.statusCode).json(response);
};

module.exports = {
  errorHandler
};