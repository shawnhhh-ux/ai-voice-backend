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
            project: 'AI Voice Assistant',
            contact: 'GitHub: shawnhhh-ux'
        };

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.SERVER_URL || 'https://ai-voice-backend-apq3.onrender.com', // UPDATE THIS!
                'X-Title': 'AI Voice Assistant by shone',
                'X-Developer': 'shone (GitHub: shawnhhh-ux)'
            },
            timeout: 30000
        });

        console.log('OpenRouterService initialized by shone (GitHub: shawnhhh-ux)');
    }

    /**
     * Send a message to OpenRouter and get AI response
     * @param {Object} options - Message options
     * @param {string} options.message - User message
     * @param {string} options.conversationId - Conversation ID for context
     * @param {string} options.systemPrompt - System prompt (optional)
     * @returns {Promise<Object>} AI response
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

            console.log(`🤖 [OpenRouter] Sending message: ${message.substring(0, 100)}...`);
            console.log(`👨‍💻 Developer: shone (GitHub: shawnhhh-ux)`);

            const response = await this.client.post('/chat/completions', requestBody);

            const aiResponse = response.data.choices[0].message.content;

            console.log(`✅ [OpenRouter] Response received: ${aiResponse.substring(0, 100)}...`);

            return {
                success: true,
                data: {
                    response: aiResponse,
                    conversationId: conversationId || this.generateId(),
                    usage: response.data.usage,
                    model: response.data.model,
                    developer: this.developerInfo
                }
            };

        } catch (error) {
            console.error('❌ [OpenRouter] API Error:', error.response?.data || error.message);
            console.log(`👨‍💻 Developer: shone (GitHub: shawnhhh-ux) - Error occurred`);
            
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

    /**
     * Stream message for real-time responses
     * @param {Object} options - Stream options
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

            console.log(`🔊 [OpenRouter] Streaming message...`);
            console.log(`👨‍💻 Developer: shone (GitHub: shawnhhh-ux)`);

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
                console.log(`✅ [OpenRouter] Stream completed`);
                onComplete({
                    fullResponse,
                    conversationId: conversationId || this.generateId(),
                    developer: this.developerInfo
                });
            });

            response.data.on('error', (error) => {
                console.error('❌ [OpenRouter] Stream error:', error);
                onError(error);
            });

        } catch (error) {
            console.error('❌ [OpenRouter] Stream initialization error:', error);
            onError(error);
        }
    }

    /**
     * Process audio data through OpenRouter
     * @param {Object} options - Audio processing options
     */
    async processAudio({ audioData, sessionId }) {
        try {
            console.log(`🎵 [OpenRouter] Processing audio, session: ${sessionId}`);
            console.log(`👨‍💻 Developer: shone (GitHub: shawnhhh-ux)`);
            
            // Note: OpenRouter primarily handles text, so you'd typically:
            // 1. Convert audio to text first (using another service)
            // 2. Then send text to OpenRouter
            
            // For now, we'll simulate audio processing
            // In a real implementation, you'd integrate with a speech-to-text service
            
            const simulatedTranscription = "This is a simulated transcription of the audio input. In a real implementation, this would be converted from audio to text.";
            
            // Send transcribed text to OpenRouter
            const aiResponse = await this.sendMessage({
                message: simulatedTranscription,
                sessionId: sessionId
            });

            return {
                success: true,
                data: {
                    transcribedText: simulatedTranscription,
                    aiResponse: aiResponse.data.response,
                    sessionId: sessionId,
                    developer: this.developerInfo
                }
            };

        } catch (error) {
            console.error('❌ [OpenRouter] Audio processing error:', error);
            throw new Error(`Audio processing failed: ${error.message}`);
        }
    }

    /**
     * Get available models from OpenRouter
     * @returns {Promise<Array>} List of available models
     */
    async getAvailableModels() {
        try {
            console.log(`📋 [OpenRouter] Fetching available models`);
            console.log(`👨‍💻 Developer: shone (GitHub: shawnhhh-ux)`);

            const response = await this.client.get('/models');
            
            console.log(`✅ [OpenRouter] Retrieved ${response.data.data.length} models`);
            
            return {
                success: true,
                data: {
                    models: response.data.data,
                    total: response.data.data.length,
                    developer: this.developerInfo
                }
            };
        } catch (error) {
            console.error('❌ [OpenRouter] Error fetching models:', error);
            return {
                success: false,
                error: 'Failed to fetch models',
                developer: this.developerInfo
            };
        }
    }

    /**
     * Get service status and information
     * @returns {Object} Service information
     */
    getServiceInfo() {
        return {
            service: 'OpenRouter AI Service',
            developer: this.developerInfo,
            model: this.model,
            baseURL: this.baseURL,
            status: 'active',
            features: ['chat', 'streaming', 'multiple-models'],
            repository: 'https://github.com/shawnhhh-ux/ai-voice-assistant'
        };
    }

    /**
     * Generate a unique ID
     * @returns {string} Unique ID
     */
    generateId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = OpenRouterService;