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
        this.model = process.env.OPENROUTER_MODEL || 'openai/gpt-3.5-turbo';
        
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

        // Initialize axios client with headers
        this.client = axios.create({
            baseURL: this.baseURL,
            timeout: 30000,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.SERVER_URL || 'https://your-render-app.onrender.com',
                'X-Title': this.developerInfo.project,
                'User-Agent': `${this.developerInfo.project}/1.0.0 (${this.developerInfo.repository})`
            }
        });

        console.log('OpenRouterService initialized successfully');
    }

    /**
     * Send a message to OpenRouter and get AI response
     * @param {Object} options - Message options
     * @param {string} options.message - The user message
     * @param {string} options.conversationId - Conversation ID for context
     * @param {string} options.systemPrompt - System prompt (optional)
     * @param {boolean} options.stream - Whether to stream response (default: false)
     * @returns {Promise<Object>} AI response
     */
    async sendMessage(options) {
        try {
            const { message, conversationId, systemPrompt, stream = false } = options;

            if (!message || typeof message !== 'string') {
                throw new Error('Message is required and must be a string');
            }

            // Build messages array
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
                stream: stream
            };

            console.log(`Sending request to OpenRouter: ${message.substring(0, 100)}...`);

            const response = await this.client.post('/chat/completions', requestBody);

            if (!response.data || !response.data.choices || !response.data.choices[0]) {
                throw new Error('Invalid response format from OpenRouter');
            }

            const aiResponse = response.data.choices[0].message.content;

            return {
                success: true,
                data: {
                    response: aiResponse,
                    conversationId: conversationId || this.generateConversationId(),
                    usage: response.data.usage || {},
                    model: response.data.model,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('OpenRouter API Error:', error.response?.data || error.message);
            
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
            } else if (error.response?.data?.error?.message) {
                errorMessage = error.response.data.error.message;
            }

            return {
                success: false,
                error: errorMessage,
                code: `OPENROUTER_${statusCode}`
            };
        }
    }

    /**
     * Stream response from OpenRouter (for real-time responses)
     * @param {Object} options - Stream options
     * @param {string} options.message - The user message
     * @param {string} options.conversationId - Conversation ID
     * @param {Function} options.onChunk - Callback for each chunk
     * @param {Function} options.onComplete - Callback when complete
     * @param {Function} options.onError - Callback for errors
     */
    async streamMessage(options) {
        try {
            const { message, conversationId, onChunk, onComplete, onError } = options;

            if (!message) {
                throw new Error('Message is required for streaming');
            }

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
                try {
                    const lines = chunk.toString().split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ') && !line.includes('[DONE]')) {
                            try {
                                const data = JSON.parse(line.slice(6));
                                const content = data.choices[0]?.delta?.content;
                                
                                if (content) {
                                    fullResponse += content;
                                    if (onChunk) {
                                        onChunk(content);
                                    }
                                }
                            } catch (parseError) {
                                // Ignore parsing errors for incomplete chunks
                            }
                        }
                    }
                } catch (chunkError) {
                    console.error('Error processing stream chunk:', chunkError);
                }
            });

            response.data.on('end', () => {
                if (onComplete) {
                    onComplete({
                        fullResponse,
                        conversationId: conversationId || this.generateConversationId()
                    });
                }
            });

            response.data.on('error', (error) => {
                console.error('Stream error:', error);
                if (onError) {
                    onError(error);
                }
            });

        } catch (error) {
            console.error('Stream initialization error:', error);
            if (onError) {
                onError(error);
            }
        }
    }

    /**
     * Process audio transcription and get AI response
     * @param {Object} options - Audio processing options
     * @param {string} options.audioData - Base64 encoded audio data
     * @param {string} options.sessionId - Session ID for tracking
     * @returns {Promise<Object>} AI response with transcription
     */
    async processAudio(options) {
        try {
            const { audioData, sessionId } = options;

            if (!audioData) {
                throw new Error('Audio data is required');
            }

            // Note: OpenRouter doesn't directly process audio
            // You would need to use a speech-to-text service first
            // This is a placeholder for the complete flow
            
            console.log(`Processing audio for session: ${sessionId}, data length: ${audioData.length}`);

            // For now, we'll simulate speech-to-text and then get AI response
            // In production, integrate with a speech-to-text service like:
            // Google Speech-to-Text, AWS Transcribe, or OpenAI Whisper
            
            const simulatedTranscription = "This is a simulated transcription of the audio input. In a real implementation, this would be the actual transcribed text from the audio.";

            // Get AI response for the transcribed text
            const aiResponse = await this.sendMessage({
                message: simulatedTranscription,
                conversationId: sessionId
            });

            return {
                success: true,
                data: {
                    transcribedText: simulatedTranscription,
                    response: aiResponse.success ? aiResponse.data.response : 'Error processing audio',
                    sessionId: sessionId,
                    timestamp: new Date().toISOString()
                }
            };

        } catch (error) {
            console.error('Audio processing error:', error);
            return {
                success: false,
                error: 'Failed to process audio: ' + error.message,
                code: 'AUDIO_PROCESSING_ERROR'
            };
        }
    }

    /**
     * Get available models from OpenRouter
     * @returns {Promise<Array>} List of available models
     */
    async getAvailableModels() {
        try {
            const response = await this.client.get('/models');
            
            if (response.data && response.data.data) {
                return response.data.data;
            }
            
            return [];

        } catch (error) {
            console.error('Error fetching models:', error);
            return [];
        }
    }

    /**
     * Generate a unique conversation ID
     * @returns {string} Unique conversation ID
     */
    generateConversationId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Get service status and information
     * @returns {Object} Service information
     */
    getServiceInfo() {
        return {
            service: 'OpenRouter',
            developer: this.developerInfo.name,
            github: this.developerInfo.github,
            repository: this.developerInfo.repository,
            model: this.model,
            status: 'active',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate API key and service connectivity
     * @returns {Promise<Object>} Validation result
     */
    async validateConnection() {
        try {
            const models = await this.getAvailableModels();
            return {
                valid: true,
                message: 'OpenRouter service is connected and working',
                modelsCount: models.length
            };
        } catch (error) {
            return {
                valid: false,
                message: 'OpenRouter service connection failed: ' + error.message
            };
        }
    }
}

module.exports = OpenRouterService;