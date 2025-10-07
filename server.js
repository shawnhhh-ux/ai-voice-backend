const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('dotenv').config();
const { router: openRouterRoutes } = require('./services/OpenRouterService');


// Import services
const OpenRouterService = require('./services/openRouterService');
const ConversationService = require('./services/conversationService');

// Import routes
const chatRoutes = require('./routes/chat');
const audioRoutes = require('./routes/audio');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');
const { validateApiKey } = require('./middleware/auth');

// Use OpenRouter routes
app.use('/api/v1/chat', openRouterRoutes);


// Logger configuration
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.simple()
    })
  ]
});

class AIVoiceServer {
  constructor() {
    this.app = express();
    this.server = http.createServer(this.app);
    this.io = socketIo(this.server, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || ["https://your-app-name.onrender.com", "http://localhost:3001"],
        methods: ["GET", "POST"],
        credentials: true
      }
    });
    
    this.port = process.env.PORT || 3000;
    this.conversationService = new ConversationService();
    this.openRouterService = new OpenRouterService(this.conversationService);
    
    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeWebSocket();
    this.initializeErrorHandling();
    
    logger.info('AI Voice Server initialized');
  }

  initializeMiddlewares() {
    // Security middleware
    this.app.use(helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" }
    }));

    // CORS configuration
    this.app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ["https://your-app-name.onrender.com", "http://localhost:3001"],
      credentials: true
    }));

    // Rate limiting - more generous for voice app
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 200, // Increased limit for voice interactions
      message: {
        error: 'Too many requests from this IP, please try again later.',
        code: 'RATE_LIMIT_EXCEEDED'
      },
      standardHeaders: true,
      legacyHeaders: false
    });
    this.app.use(limiter);

    // Body parsing middleware with increased limits for audio
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Compression
    this.app.use(compression());

    // Logging
    if (process.env.NODE_ENV !== 'production') {
      this.app.use(morgan('dev'));
    } else {
      this.app.use(morgan('combined'));
    }

    // Static files (if needed)
    this.app.use(express.static('public'));
  }

  initializeRoutes() {
    // Health check endpoint
    this.app.get('/health', (req, res) => {
      res.status(200).json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: process.env.NODE_ENV,
        version: '1.0.0'
      });
    });

    // API routes
    this.app.use('/api/v1/chat', validateApiKey, chatRoutes(this.openRouterService));
    this.app.use('/api/v1/audio', validateApiKey, audioRoutes);

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        message: '🚀 AI Voice Assistant Backend API',
        version: '1.0.0',
        endpoints: {
          chat: '/api/v1/chat',
          audio: '/api/v1/audio',
          health: '/health',
          websocket: '/ws'
        },
        documentation: 'See README for API documentation'
      });
    });

    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({
        error: 'Endpoint not found',
        path: req.originalUrl,
        code: 'ENDPOINT_NOT_FOUND'
      });
    });
  }

  initializeWebSocket() {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      
      // Store conversation for this socket
      const conversationId = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.conversationService.createConversation(conversationId);

      // Send welcome message with conversation ID
      socket.emit('connected', { 
        conversationId,
        message: 'Connected to AI Voice Assistant',
        timestamp: new Date().toISOString()
      });

      // Handle text chat messages
      socket.on('chat_message', async (data) => {
        try {
          await this.handleChatMessage(socket, data, conversationId);
        } catch (error) {
          logger.error('Chat message error:', error);
          socket.emit('error', { 
            message: 'Failed to process message',
            code: 'CHAT_PROCESSING_ERROR'
          });
        }
      });

      // Handle audio stream data
      socket.on('audio_stream', async (data) => {
        try {
          await this.handleAudioStream(socket, data, conversationId);
        } catch (error) {
          logger.error('Audio stream error:', error);
          socket.emit('error', { 
            message: 'Failed to process audio stream',
            code: 'AUDIO_PROCESSING_ERROR'
          });
        }
      });

      // Handle audio chunk (for real-time processing)
      socket.on('audio_chunk', async (data) => {
        try {
          await this.handleAudioChunk(socket, data, conversationId);
        } catch (error) {
          logger.error('Audio chunk error:', error);
        }
      });

      // Handle typing indicators
      socket.on('typing_start', () => {
        socket.broadcast.emit('user_typing', { userId: socket.id });
      });

      socket.on('typing_stop', () => {
        socket.broadcast.emit('user_stopped_typing', { userId: socket.id });
      });

      // Handle disconnection
      socket.on('disconnect', (reason) => {
        logger.info(`Client disconnected: ${socket.id} - ${reason}`);
        // Clean up conversation after delay
        setTimeout(() => {
          this.conversationService.deleteConversation(conversationId);
        }, 300000); // 5 minutes
      });

      // Handle errors
      socket.on('error', (error) => {
        logger.error(`Socket error for ${socket.id}:`, error);
      });
    });

    logger.info('WebSocket service initialized');
  }

  async handleChatMessage(socket, data, conversationId) {
    const { message, messageId } = data;

    // Validate input
    if (!message || typeof message !== 'string') {
      socket.emit('error', { 
        message: 'Invalid message format',
        code: 'INVALID_MESSAGE_FORMAT'
      });
      return;
    }

    if (message.length > 4000) {
      socket.emit('error', { 
        message: 'Message too long. Maximum 4000 characters allowed.',
        code: 'MESSAGE_TOO_LONG'
      });
      return;
    }

    logger.info(`Processing chat message from ${socket.id}: ${message.substring(0, 100)}...`);

    // Send processing status
    socket.emit('processing_start', { messageId });

    try {
      // Add user message to conversation
      this.conversationService.addMessage(conversationId, 'user', message);

      // Get AI response from Open Router
      const aiResponse = await this.openRouterService.sendMessage({
        message: message,
        conversationId: conversationId
      });

      // Add AI response to conversation
      this.conversationService.addMessage(conversationId, 'assistant', aiResponse.response);

      // Send response back to client
      socket.emit('chat_response', {
        messageId,
        response: aiResponse.response,
        conversationId: conversationId,
        usage: aiResponse.usage,
        model: aiResponse.model,
        timestamp: new Date().toISOString()
      });

      logger.info(`AI response sent for message ${messageId}`);

    } catch (error) {
      logger.error('Open Router error:', error);
      socket.emit('error', {
        messageId,
        error: 'Failed to get AI response',
        details: error.message,
        code: 'AI_SERVICE_ERROR'
      });
    }
  }

  async handleAudioStream(socket, data, conversationId) {
    const { audioData, sessionId, isFinal } = data;

    logger.info(`Processing audio stream: session ${sessionId}, final: ${isFinal}`);

    // Simulate audio processing (in real app, integrate with speech-to-text service)
    // For now, we'll simulate transcription after receiving final chunk
    socket.emit('audio_processed', {
      sessionId,
      processed: true,
      isFinal,
      timestamp: new Date().toISOString()
    });

    // If it's the final chunk, process the complete audio
    if (isFinal && audioData) {
      await this.processCompleteAudio(socket, audioData, sessionId, conversationId);
    }
  }

  async handleAudioChunk(socket, data, conversationId) {
    const { chunk, sessionId, chunkIndex, isFinal } = data;
    
    // Process individual audio chunks for real-time transcription
    // This is where you'd integrate with real-time speech-to-text services
    
    socket.emit('chunk_processed', {
      sessionId,
      chunkIndex,
      processed: true,
      isFinal,
      timestamp: new Date().toISOString()
    });
  }

  async processCompleteAudio(socket, audioData, sessionId, conversationId) {
    try {
      logger.info(`Processing complete audio for session: ${sessionId}`);
      
      // Simulate speech-to-text transcription
      // In production, you would send this to a speech-to-text service
      const transcribedText = await this.simulateSpeechToText(audioData);
      
      // Add user message with transcribed text to conversation
      this.conversationService.addMessage(conversationId, 'user', transcribedText);

      // Get AI response for the transcribed text
      const aiResponse = await this.openRouterService.sendMessage({
        message: transcribedText,
        conversationId: conversationId
      });

      // Add AI response to conversation
      this.conversationService.addMessage(conversationId, 'assistant', aiResponse.response);

      socket.emit('audio_response', {
        sessionId,
        transcribedText,
        aiResponse: aiResponse.response,
        conversationId: conversationId,
        usage: aiResponse.usage,
        model: aiResponse.model,
        timestamp: new Date().toISOString()
      });

      logger.info(`Audio response sent for session ${sessionId}`);

    } catch (error) {
      logger.error('Audio processing error:', error);
      socket.emit('error', {
        sessionId,
        error: 'Failed to process audio',
        details: error.message,
        code: 'AUDIO_PROCESSING_ERROR'
      });
    }
  }

  async simulateSpeechToText(audioData) {
    // Simulate speech-to-text processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Return simulated transcription
    const sampleResponses = [
      "Hello! How can I help you today?",
      "I'd like to know more about artificial intelligence.",
      "What's the weather like today?",
      "Can you tell me a joke?",
      "How do I build a mobile application?",
      "What are the best practices for software development?",
      "Explain machine learning in simple terms.",
      "How can I improve my coding skills?"
    ];
    
    return sampleResponses[Math.floor(Math.random() * sampleResponses.length)];
  }

  initializeErrorHandling() {
    this.app.use(errorHandler);
  }

  start() {
    this.server.listen(this.port, () => {
      logger.info(`🚀 AI Voice Assistant Server running on port ${this.port}`);
      logger.info(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`🔗 Server URL: ${process.env.SERVER_URL || `http://localhost:${this.port}`}`);
      logger.info(`💬 WebSocket ready at: ${process.env.SERVER_URL ? process.env.SERVER_URL.replace('http', 'ws') : `ws://localhost:${this.port}`}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      this.server.close(() => {
        logger.info('Process terminated');
      });
    });

    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
      process.exit(1);
    });
  }
}

// Create and start server
const server = new AIVoiceServer();
server.start();

module.exports = server;