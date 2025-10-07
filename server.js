const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
require('dotenv').config();

/**
 * AI Voice Assistant Backend Server
 * Developed by: shone (GitHub: shawnhhh-ux)
 * Repository: https://github.com/shawnhhh-ux/ai-voice-assistant
 * 
 * This server handles voice and text requests from the Android app
 * and communicates with OpenRouter AI API for intelligent responses.
 */

class AIVoiceServer {
    constructor() {
        this.app = express();
        this.server = http.createServer(this.app);
        this.io = socketIo(this.server, {
            cors: {
                origin: process.env.ALLOWED_ORIGINS?.split(',') || "*",
                methods: ["GET", "POST"]
            }
        });
        
        this.port = process.env.PORT || 3000;
        
        this.initializeMiddlewares();
        this.initializeRoutes();
        this.initializeWebSocket();
        this.initializeErrorHandling();
        
        console.log('🚀 AI Voice Assistant Server initialized');
        console.log('👨‍💻 Developer: shone (GitHub: shawnhhh-ux)');
        console.log('📚 Repository: https://github.com/shawnhhh-ux/ai-voice-assistant');
    }

    initializeMiddlewares() {
        // Security middleware
        this.app.use(helmet({
            crossOriginResourcePolicy: { policy: "cross-origin" }
        }));

        // CORS configuration
        this.app.use(cors({
            origin: process.env.ALLOWED_ORIGINS?.split(',') || "*",
            credentials: true
        }));

        // Rate limiting
        const limiter = rateLimit({
            windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
            max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
            message: {
                error: 'Too many requests from this IP, please try again later.'
            }
        });
        this.app.use(limiter);

        // Body parsing middleware
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

        // Static files
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
                developer: 'shone (GitHub: shawnhhh-ux)',
                repository: 'https://github.com/shawnhhh-ux/ai-voice-assistant'
            });
        });

        // Chat message endpoint
        this.app.post('/api/v1/chat/message', async (req, res) => {
            try {
                const { message, conversationId } = req.body;

                // Validate request
                if (!message || typeof message !== 'string') {
                    return res.status(400).json({
                        success: false,
                        error: 'Message is required and must be a string',
                        code: 'INVALID_MESSAGE'
                    });
                }

                if (message.length > 4000) {
                    return res.status(400).json({
                        success: false,
                        error: 'Message too long. Maximum 4000 characters allowed.',
                        code: 'MESSAGE_TOO_LONG'
                    });
                }

                console.log(`Processing chat message: ${message.substring(0, 100)}...`);

                // Get AI response from OpenRouter
                const aiResponse = await this.getAIResponse(message, conversationId);

                res.json({
                    success: true,
                    data: {
                        response: aiResponse.response,
                        conversationId: aiResponse.conversationId,
                        usage: aiResponse.usage,
                        model: aiResponse.model,
                        timestamp: new Date().toISOString()
                    }
                });

            } catch (error) {
                console.error('Chat route error:', error);
                
                let statusCode = 500;
                let errorMessage = 'Internal server error';

                if (error.message.includes('API key')) {
                    statusCode = 401;
                    errorMessage = 'Authentication failed';
                } else if (error.message.includes('Rate limit')) {
                    statusCode = 429;
                    errorMessage = 'Service temporarily unavailable due to rate limiting';
                } else if (error.message.includes('timeout')) {
                    statusCode = 504;
                    errorMessage = 'Service timeout';
                }

                res.status(statusCode).json({
                    success: false,
                    error: errorMessage,
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                    code: `CHAT_ERROR_${statusCode}`
                });
            }
        });

        // Audio processing endpoint
        this.app.post('/api/v1/audio/process', async (req, res) => {
            try {
                const { audioData, sessionId } = req.body;

                // Validate request
                if (!audioData || typeof audioData !== 'string') {
                    return res.status(400).json({
                        success: false,
                        error: 'Audio data is required and must be a base64 string',
                        code: 'INVALID_AUDIO_DATA'
                    });
                }

                console.log(`Processing audio data, session: ${sessionId}, data length: ${audioData.length}`);

                // Simulate audio processing and transcription
                // In a real application, you would use a speech-to-text service here
                const transcribedText = await this.simulateSpeechToText(audioData);

                // Get AI response for the transcribed text
                const aiResponse = await this.getAIResponse(transcribedText, sessionId);

                res.json({
                    success: true,
                    data: {
                        response: aiResponse.response,
                        transcribedText: transcribedText,
                        conversationId: aiResponse.conversationId,
                        timestamp: new Date().toISOString()
                    }
                });

            } catch (error) {
                console.error('Audio processing error:', error);
                
                res.status(500).json({
                    success: false,
                    error: 'Audio processing failed',
                    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
                    code: 'AUDIO_PROCESSING_ERROR'
                });
            }
        });

        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                message: 'AI Voice Assistant Backend API',
                version: '1.0.0',
                developer: 'shone (GitHub: shawnhhh-ux)',
                repository: 'https://github.com/shawnhhh-ux/ai-voice-assistant',
                endpoints: {
                    chat: '/api/v1/chat/message',
                    audio: '/api/v1/audio/process',
                    health: '/health',
                    websocket: '/ws'
                }
            });
        });

        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                path: req.originalUrl
            });
        });
    }

    initializeWebSocket() {
        this.io.on('connection', (socket) => {
            console.log(`Client connected: ${socket.id}`);

            // Handle real-time chat messages
            socket.on('chat_message', async (data) => {
                try {
                    await this.handleChatMessage(socket, data);
                } catch (error) {
                    socket.emit('error', { message: 'Failed to process message' });
                    console.error('Chat message error:', error);
                }
            });

            // Handle audio streaming
            socket.on('audio_stream', async (data) => {
                try {
                    await this.handleAudioStream(socket, data);
                } catch (error) {
                    socket.emit('error', { message: 'Failed to process audio' });
                    console.error('Audio stream error:', error);
                }
            });

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                console.log(`Client disconnected: ${socket.id} - ${reason}`);
            });

            // Handle errors
            socket.on('error', (error) => {
                console.error(`Socket error for ${socket.id}:`, error);
            });
        });

        console.log('WebSocket service initialized');
    }

    async handleChatMessage(socket, data) {
        const { message, conversationId, messageId } = data;

        // Validate input
        if (!message || typeof message !== 'string') {
            socket.emit('error', { message: 'Invalid message format' });
            return;
        }

        // Send processing status
        socket.emit('processing_start', { messageId });

        try {
            // Get AI response from OpenRouter
            const aiResponse = await this.getAIResponse(message, conversationId);

            // Send response back to client
            socket.emit('chat_response', {
                messageId,
                response: aiResponse.response,
                conversationId: aiResponse.conversationId,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Open Router error:', error);
            socket.emit('error', {
                messageId,
                error: 'Failed to get AI response',
                details: error.message
            });
        }
    }

    async handleAudioStream(socket, data) {
        const { audioChunk, sessionId, isFinal } = data;

        // Process audio chunk (simulate processing)
        socket.emit('audio_processed', {
            sessionId,
            processed: true,
            isFinal,
            timestamp: new Date().toISOString()
        });

        // If it's the final chunk, process the complete audio
        if (isFinal) {
            await this.processCompleteAudio(socket, sessionId);
        }
    }

    async processCompleteAudio(socket, sessionId) {
        try {
            // Simulate audio transcription
            const transcribedText = "This is a simulated transcription of the audio input. In a real application, this would be processed by a speech-to-text service.";
            
            // Get AI response for the transcribed text
            const aiResponse = await this.getAIResponse(transcribedText, sessionId);

            socket.emit('audio_response', {
                sessionId,
                transcribedText,
                aiResponse: aiResponse.response,
                timestamp: new Date().toISOString()
            });

        } catch (error) {
            console.error('Audio processing error:', error);
            socket.emit('error', {
                sessionId,
                error: 'Failed to process audio'
            });
        }
    }

    async getAIResponse(message, conversationId = null) {
        try {
            const openRouterApiKey = process.env.OPENROUTER_API_KEY;
            if (!openRouterApiKey) {
                throw new Error('OpenRouter API key not configured');
            }

            const messages = [
                {
                    role: 'system',
                    content: 'You are a helpful AI assistant. Provide clear, concise, and helpful responses.'
                },
                {
                    role: 'user',
                    content: message
                }
            ];

            const requestBody = {
                model: process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo',
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7,
                stream: false
            };

            const response = await axios.post('https://openrouter.ai/api/v1/chat/completions', requestBody, {
                headers: {
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': process.env.SERVER_URL || 'https://your-render-app.onrender.com',
                    'X-Title': 'AI Voice Assistant'
                },
                timeout: 30000
            });

            const aiResponse = response.data.choices[0].message.content;

            return {
                response: aiResponse,
                conversationId: conversationId || this.generateConversationId(),
                usage: response.data.usage,
                model: response.data.model
            };

        } catch (error) {
            console.error('Open Router API Error:', error.response?.data || error.message);
            
            if (error.response?.status === 401) {
                throw new Error('Invalid Open Router API key');
            } else if (error.response?.status === 429) {
                throw new Error('Rate limit exceeded for Open Router');
            } else if (error.code === 'ECONNABORTED') {
                throw new Error('Open Router request timeout');
            } else {
                throw new Error(`Open Router service error: ${error.message}`);
            }
        }
    }

    async simulateSpeechToText(audioData) {
        // Simulate speech-to-text processing
        // In a real application, you would use Google Speech-to-Text, Whisper, etc.
        return new Promise((resolve) => {
            setTimeout(() => {
                const simulatedTexts = [
                    "Hello! How can I help you today?",
                    "I understand you're looking for assistance.",
                    "That's an interesting question. Let me think about it.",
                    "I'd be happy to help with that!",
                    "Could you please provide more details about your request?"
                ];
                const randomText = simulatedTexts[Math.floor(Math.random() * simulatedTexts.length)];
                resolve(randomText);
            }, 1000);
        });
    }

    generateConversationId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    initializeErrorHandling() {
        // Global error handling middleware
        this.app.use((err, req, res, next) => {
            console.error('Global error handler:', err);

            let error = { 
                message: 'Internal server error', 
                statusCode: 500,
                code: 'INTERNAL_ERROR'
            };

            // Axios error
            if (err.isAxiosError) {
                error.message = 'External service error';
                error.statusCode = 502;
                error.code = 'EXTERNAL_SERVICE_ERROR';
            }

            // Validation error
            if (err.name === 'ValidationError') {
                error.message = 'Validation failed';
                error.statusCode = 400;
                error.code = 'VALIDATION_ERROR';
            }

            // Rate limit error
            if (err.statusCode === 429) {
                error.message = 'Too many requests';
                error.statusCode = 429;
                error.code = 'RATE_LIMIT_EXCEEDED';
            }

            const response = {
                success: false,
                error: error.message,
                code: error.code,
                ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
            };

            res.status(error.statusCode).json(response);
        });
    }

    start() {
        this.server.listen(this.port, () => {
            console.log(`🚀 AI Voice Assistant Server running on port ${this.port}`);
            console.log(`📡 Environment: ${process.env.NODE_ENV || 'development'}`);
            console.log(`🔗 Server URL: ${process.env.SERVER_URL || `http://localhost:${this.port}`}`);
            console.log(`👨‍💻 Developer: shone (GitHub: shawnhhh-ux)`);
            console.log(`📚 Repository: https://github.com/shawnhhh-ux/ai-voice-assistant`);
            console.log(`💡 Health check: ${process.env.SERVER_URL || `http://localhost:${this.port}`}/health`);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
            console.log('SIGTERM received, shutting down gracefully');
            this.server.close(() => {
                console.log('Process terminated');
            });
        });
    }
}

// Create and start server
const server = new AIVoiceServer();
server.start();

module.exports = server;