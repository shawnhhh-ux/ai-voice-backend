const express = require('express');
const router = express.Router();
const OpenRouterService = require('../services/OpenRouterService');

// Initialize the service
const openRouterService = new OpenRouterService();

// GET /api/info - Get service information
router.get('/info', (req, res) => {
    const serviceInfo = openRouterService.getServiceInfo();
    res.json({
        success: true,
        data: serviceInfo
    });
});

// POST /api/v1/chat/message - Send a text message
router.post('/message', async (req, res) => {
    try {
        const { message, conversationId, systemPrompt } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a string',
                code: 'INVALID_MESSAGE'
            });
        }

        console.log(`Processing chat message from client: ${message.substring(0, 100)}...`);

        const response = await openRouterService.sendMessage({
            message,
            conversationId,
            systemPrompt
        });

        if (response.success) {
            res.json(response);
        } else {
            res.status(500).json(response);
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

// POST /api/v1/audio/process - Process audio data
router.post('/process', async (req, res) => {
    try {
        const { audioData, sessionId } = req.body;

        if (!audioData || !sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Audio data and session ID are required',
                code: 'INVALID_AUDIO_DATA'
            });
        }

        console.log(`Processing audio data for session: ${sessionId}`);

        const response = await openRouterService.processAudio(audioData, sessionId);

        if (response.success) {
            res.json(response);
        } else {
            res.status(500).json(response);
        }

    } catch (error) {
        console.error('Audio processing route error:', error);
        res.status(500).json({
            success: false,
            error: 'Audio processing failed',
            code: 'AUDIO_PROCESSING_ERROR'
        });
    }
});

// GET /api/v1/models - Get available AI models
router.get('/models', async (req, res) => {
    try {
        const response = await openRouterService.getAvailableModels();
        
        if (response.success) {
            res.json(response);
        } else {
            res.status(500).json(response);
        }
    } catch (error) {
        console.error('Models route error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch models',
            code: 'MODELS_FETCH_ERROR'
        });
    }
});

module.exports = router;