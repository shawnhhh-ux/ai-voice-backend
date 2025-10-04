module.exports = {
  // API Constants
  MAX_MESSAGE_LENGTH: 4000,
  MAX_CONVERSATION_MESSAGES: 50,
  CONVERSATION_EXPIRY: 30 * 60 * 1000, // 30 minutes
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: 15 * 60 * 1000, // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: 200,
  
  // AI Service
  DEFAULT_AI_MODEL: 'mistralai/mistral-nemo:free',
  MAX_TOKENS: 500,
  TEMPERATURE: 0.7,
  
  // Audio Processing
  MAX_AUDIO_SIZE: 10 * 1024 * 1024, // 10MB
  SUPPORTED_AUDIO_FORMATS: ['mp3', 'wav', 'm4a', 'ogg']
};