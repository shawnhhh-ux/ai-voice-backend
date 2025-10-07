const express = require('express');
const router = express.Router();
const OpenRouterService = require('../services/OpenRouterService');

// Initialize OpenRouter service
const openRouterService = new OpenRouterService();

/**
 * POST /api/v1/chat/message
 * Send a text message and get AI response
 */
router.post('/message', async (req, res) => {
    try {
        const { message, conversationId, systemPrompt } = req.body;

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

        const response = await openRouterService.sendMessage({
            message,
            conversationId,
            systemPrompt
        });

        if (response.success) {
            res.json({
                success: true,
                data: response.data,
                developer: {
                    name: 'shone',
                    github: 'shawnhhh-ux',
                    repository: 'https://github.com/shawnhhh-ux/ai-voice-assistant'
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: response.error,
                code: response.code
            });
        }

    } catch (error) {
        console.error('Chat route error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * POST /api/v1/chat/audio
 * Process audio and get AI response
 */
router.post('/audio', async (req, res) => {
    try {
        const { audioData, sessionId } = req.body;

        if (!audioData) {
            return res.status(400).json({
                success: false,
                error: 'Audio data is required',
                code: 'MISSING_AUDIO_DATA'
            });
        }

        console.log(`Processing audio request, session: ${sessionId}`);

        const response = await openRouterService.processAudio({
            audioData,
            sessionId
        });

        if (response.success) {
            res.json({
                success: true,
                data: response.data,
                developer: {
                    name: 'shone',
                    github: 'shawnhhh-ux',
                    repository: 'https://github.com/shawnhhh-ux/ai-voice-assistant'
                }
            });
        } else {
            res.status(500).json({
                success: false,
                error: response.error,
                code: response.code
            });
        }

    } catch (error) {
        console.error('Audio route error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR'
        });
    }
});

/**
 * GET /api/v1/chat/models
 * Get available AI models
 */
router.get('/models', async (req, res) => {
    try {
        const models = await openRouterService.getAvailableModels();
        
        res.json({
            success: true,
            data: {
                models: models.slice(0, 20), // Return first 20 models
                total: models.length
            },
            developer: {
                name: 'shone',
                github: 'shawnhhh-ux',
                repository: 'https://github.com/shawnhhh-ux/ai-voice-assistant'
            }
        });
    } catch (error) {
        console.error('Models route error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch models'
        });
    }
});

/**
 * GET /api/v1/chat/info
 * Get service information
 */
router.get('/info', async (req, res) => {
    try {
        const serviceInfo = openRouterService.getServiceInfo();
        const validation = await openRouterService.validateConnection();
        
        res.json({
            success: true,
            data: {
                service: serviceInfo,
                connection: validation,
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error('Info route error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to get service info'
        });
    }
});

module.exports = router;