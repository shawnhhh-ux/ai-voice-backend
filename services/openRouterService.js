const express = require('express');
const axios = require('axios');
const router = express.Router();

/**
 * OpenRouter Service for AI Voice Assistant
 * Developed by: shone (GitHub: shawnhhh-ux)
 * Repository: https://github.com/shawnhhh-ux/ai-voice-assistant
 * 
 * This service handles communication with OpenRouter AI API
 * for processing chat messages and generating AI responses.
 */

class OpenRouterService {
    constructor() {
        this.apiKey = process.env.OPENROUTER_API_KEY;
        this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
        this.model = process.env.OPENROUTER_MODEL || 'mistralai/mistral-nemo:free';
        
        if (!this.apiKey) {
            throw new Error('OPENROUTER_API_KEY is required in environment variables');
        }

        // Developer information for API attribution
        this.developerInfo = {
            name: 'shone',
            github: 'shawnhhh-ux',
            repository: 'https://github.com/shawnhhh-ux/ai-voice-assistant',
            project: 'AI Voice Assistant'
        };

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.SERVER_URL || 'https://ai-voice-backend-apq3.onrender.com',
                'X-Title': this.developerInfo.project,
                'X-Developer': this.developerInfo.name,
                'X-GitHub': this.developerInfo.github
            },
            timeout: 30000
        });

        console.log('OpenRouterService initialized by', this.developerInfo.name);
    }

    async sendMessage({ message, conversationId, systemPrompt }) {
        try {
            const messages = [];

            // Add system prompt if provided
            if (systemPrompt) {
                messages.push({
                    role: 'system',
                    content: systemPrompt
                });
            }

            // Add user message
            messages.push({
                role: 'user',
                content: message
            });

            const requestBody = {
                model: this.model,
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7,
                stream: false
            };

            console.log(`Sending request to Open Router from ${this.developerInfo.name}: ${message.substring(0, 100)}...`);

            const response = await this.client.post('/chat/completions', requestBody);

            const aiResponse = response.data.choices[0].message.content;

            return {
                success: true,
                data: {
                    response: aiResponse,
                    conversationId: conversationId || this.generateId(),
                    usage: response.data.usage,
                    model: response.data.model,
                    developer: this.developerInfo.name,
                    github: this.developerInfo.github
                }
            };

        } catch (error) {
            console.error('Open Router API Error:', error.response?.data || error.message);
            
            let errorMessage = 'Open Router service error';
            let statusCode = 500;

            if (error.response?.status === 401) {
                errorMessage = 'Invalid Open Router API key';
                statusCode = 401;
            } else if (error.response?.status === 429) {
                errorMessage = 'Rate limit exceeded for Open Router';
                statusCode = 429;
            } else if (error.code === 'ECONNABORTED') {
                errorMessage = 'Open Router request timeout';
                statusCode = 504;
            }

            return {
                success: false,
                error: errorMessage,
                code: `OPENROUTER_${statusCode}`,
                developer: this.developerInfo.name
            };
        }
    }

    async streamMessage({ message, conversationId, onChunk, onComplete, onError }) {
        try {
            const messages = [{
                role: 'user',
                content: message
            }];

            const requestBody = {
                model: this.model,
                messages: messages,
                max_tokens: 1000,
                temperature: 0.7,
                stream: true
            };

            const response = await this.client.post('/chat/completions', requestBody, {
                responseType: 'stream'
            });

            let fullResponse = '';

            response.data.on('data', (chunk) => {
                const lines = chunk.toString().split('\n');
                
                for (const line of lines) {
                    if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                        try {
                            const data = JSON.parse(line.slice(6));
                            const content = data.choices[0]?.delta?.content;
                            
                            if (content) {
                                fullResponse += content;
                                onChunk(content);
                            }
                        } catch (e) {
                            // Ignore parsing errors for incomplete chunks
                        }
                    }
                }
            });

            response.data.on('end', () => {
                onComplete({
                    fullResponse,
                    conversationId: conversationId || this.generateId(),
                    developer: this.developerInfo.name
                });
            });

            response.data.on('error', (error) => {
                onError(error);
            });

        } catch (error) {
            onError(error);
        }
    }

    async processAudio(audioData, sessionId) {
        try {
            console.log(`Processing audio from ${this.developerInfo.name}, session: ${sessionId}`);
            
            // For now, we'll simulate audio processing and use a text message
            // In a real implementation, you would:
            // 1. Convert audio to text using a speech-to-text service
            // 2. Send the text to Open Router
            // 3. Return the AI response
            
            const simulatedText = "I received your audio message. This is a simulated response. In a real implementation, I would transcribe your audio and respond accordingly.";
            
            const aiResponse = await this.sendMessage({
                message: simulatedText,
                conversationId: sessionId,
                systemPrompt: "You are a helpful AI assistant. The user is sending audio messages which are being converted to text. Respond naturally and helpfully."
            });

            return {
                success: true,
                data: {
                    transcribedText: "User audio message (simulated transcription)",
                    response: aiResponse.data?.response || "I'm here to help!",
                    sessionId: sessionId,
                    developer: this.developerInfo.name,
                    github: this.developerInfo.github
                }
            };

        } catch (error) {
            console.error('Audio processing error:', error);
            return {
                success: false,
                error: 'Failed to process audio',
                code: 'AUDIO_PROCESSING_ERROR',
                developer: this.developerInfo.name
            };
        }
    }

    async getAvailableModels() {
        try {
            const response = await this.client.get('/models');
            return {
                success: true,
                data: {
                    models: response.data.data,
                    developer: this.developerInfo.name
                }
            };
        } catch (error) {
            console.error('Error fetching models:', error);
            return {
                success: false,
                error: 'Failed to fetch models',
                developer: this.developerInfo.name
            };
        }
    }

    generateId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    getDeveloperInfo() {
        return this.developerInfo;
    }
}

// Create router and define routes
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

        console.log(`Processing chat message from ${req.ip}: ${message.substring(0, 100)}...`);

        const openRouterService = new OpenRouterService();
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
            code: 'SERVER_ERROR',
            developer: 'shone (shawnhhh-ux)'
        });
    }
});

router.post('/audio/process', async (req, res) => {
    try {
        const { audioData, sessionId } = req.body;

        if (!audioData || !sessionId) {
            return res.status(400).json({
                success: false,
                error: 'audioData and sessionId are required',
                code: 'INVALID_AUDIO_REQUEST'
            });
        }

        console.log(`Processing audio request, session: ${sessionId}`);

        const openRouterService = new OpenRouterService();
        const response = await openRouterService.processAudio(audioData, sessionId);

        if (response.success) {
            res.json(response);
        } else {
            res.status(500).json(response);
        }

    } catch (error) {
        console.error('Audio route error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error processing audio',
            code: 'AUDIO_SERVER_ERROR',
            developer: 'shone (shawnhhh-ux)'
        });
    }
});

router.post('/stream', async (req, res) => {
    try {
        const { message, conversationId } = req.body;

        if (!message) {
            return res.status(400).json({ 
                success: false,
                error: 'Message is required',
                code: 'INVALID_MESSAGE'
            });
        }

        // Set headers for Server-Sent Events
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Developer': 'shone (shawnhhh-ux)'
        });

        const openRouterService = new OpenRouterService();
        
        await openRouterService.streamMessage({
            message,
            conversationId,
            onChunk: (chunk) => {
                res.write(`data: ${JSON.stringify({ chunk, type: 'content' })}\n\n`);
            },
            onComplete: (result) => {
                res.write(`data: ${JSON.stringify({ 
                    type: 'complete', 
                    conversationId: result.conversationId,
                    developer: result.developer
                })}\n\n`);
                res.end();
            },
            onError: (error) => {
                res.write(`data: ${JSON.stringify({ 
                    type: 'error', 
                    error: 'Streaming failed',
                    developer: 'shone (shawnhhh-ux)'
                })}\n\n`);
                res.end();
            }
        });

    } catch (error) {
        console.error('Stream route error:', error);
        res.status(500).json({ 
            success: false,
            error: 'Stream initialization failed',
            developer: 'shone (shawnhhh-ux)'
        });
    }
});

router.get('/models', async (req, res) => {
    try {
        const openRouterService = new OpenRouterService();
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
            developer: 'shone (shawnhhh-ux)'
        });
    }
});

router.get('/developer', (req, res) => {
    const openRouterService = new OpenRouterService();
    const developerInfo = openRouterService.getDeveloperInfo();
    
    res.json({
        success: true,
        data: {
            developer: developerInfo.name,
            github: developerInfo.github,
            repository: developerInfo.repository,
            project: developerInfo.project,
            message: 'AI Voice Assistant powered by OpenRouter API'
        }
    });
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'OpenRouter Service is running',
        developer: 'shone (shawnhhh-ux)',
        timestamp: new Date().toISOString(),
        github: 'https://github.com/shawnhhh-ux/ai-voice-assistant'
    });
});

module.exports = {
    router,
    OpenRouterService
};