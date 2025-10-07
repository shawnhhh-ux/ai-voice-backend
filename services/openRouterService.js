const express = require('express');
const router = express.Router();
const axios = require('axios');

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

        console.log('OpenRouterService initialized for developer:', this.developerInfo.name);
    }

    /**
     * Send a message to OpenRouter and get AI response
     */
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

            console.log(`Sending request to Open Router: ${message.substring(0, 100)}...`);

            const response = await this.client.post('/chat/completions', requestBody);

            const aiResponse = response.data.choices[0].message.content;

            return {
                success: true,
                data: {
                    response: aiResponse,
                    conversationId: conversationId || this.generateId(),
                    usage: response.data.usage,
                    model: response.data.model,
                    timestamp: new Date().toISOString(),
                    developer: this.developerInfo
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
                details: error.response?.data || error.message
            };
        }
    }

    /**
     * Stream message for real-time responses
     */
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
                responseType: 'stream',
                headers: {
                    ...this.client.defaults.headers,
                    'X-Developer': this.developerInfo.name,
                    'X-GitHub': this.developerInfo.github
                }
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
                    developer: this.developerInfo
                });
            });

            response.data.on('error', (error) => {
                onError(error);
            });

        } catch (error) {
            onError(error);
        }
    }

    /**
     * Get available models from Open Router
     */
    async getAvailableModels() {
        try {
            const response = await this.client.get('/models', {
                headers: {
                    'X-Developer': this.developerInfo.name,
                    'X-GitHub': this.developerInfo.github
                }
            });
            
            return {
                success: true,
                data: {
                    models: response.data.data,
                    developer: this.developerInfo
                }
            };
        } catch (error) {
            console.error('Error fetching models:', error);
            return {
                success: false,
                error: 'Failed to fetch models',
                details: error.message
            };
        }
    }

    /**
     * Generate unique ID for conversations
     */
    generateId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get service info and developer attribution
     */
    getServiceInfo() {
        return {
            service: 'OpenRouter AI Service',
            developer: this.developerInfo,
            status: 'active',
            model: this.model,
            timestamp: new Date().toISOString()
        };
    }
}

// Express routes for the OpenRouter service
router.post('/chat/message', async (req, res) => {
    try {
        const { message, conversationId, systemPrompt } = req.body;

        if (!message || typeof message !== 'string') {
            return res.status(400).json({
                success: false,
                error: 'Message is required and must be a string',
                code: 'INVALID_MESSAGE'
            });
        }

        const openRouterService = new OpenRouterService();
        const result = await openRouterService.sendMessage({
            message,
            conversationId,
            systemPrompt
        });

        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }

    } catch (error) {
        console.error('Chat route error:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error',
            code: 'SERVER_ERROR',
            developer: 'shone (GitHub: shawnhhh-ux)'
        });
    }
});

router.post('/chat/stream', async (req, res) => {
    try {
        const { message, conversationId } = req.body;

        if (!message) {
            return res.status(400).json({ 
                success: false, 
                error: 'Message is required' 
            });
        }

        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*',
            'X-Developer': 'shone (GitHub: shawnhhh-ux)'
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
                    developer: 'shone (GitHub: shawnhhh-ux)'
                })}\n\n`);
                res.end();
            }
        });

    } catch (error) {
        console.error('Stream route error:', error);
        res.status(500).json({ 
            success: false, 
            error: 'Stream initialization failed',
            developer: 'shone (GitHub: shawnhhh-ux)'
        });
    }
});

router.get('/models', async (req, res) => {
    try {
        const openRouterService = new OpenRouterService();
        const result = await openRouterService.getAvailableModels();
        
        if (result.success) {
            res.json(result);
        } else {
            res.status(400).json(result);
        }
    } catch (error) {
        console.error('Models route error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch models',
            developer: 'shone (GitHub: shawnhhh-ux)'
        });
    }
});

router.get('/info', (req, res) => {
    try {
        const openRouterService = new OpenRouterService();
        const info = openRouterService.getServiceInfo();
        res.json(info);
    } catch (error) {
        res.status(500).json({
            error: 'Service info unavailable',
            developer: 'shone (GitHub: shawnhhh-ux)'
        });
    }
});

// Health check endpoint
router.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'OpenRouter API',
        developer: 'shone (GitHub: shawnhhh-ux)',
        timestamp: new Date().toISOString(),
        repository: 'https://github.com/shawnhhh-ux/ai-voice-assistant'
    });
});

module.exports = {
    OpenRouterService,
    router
};