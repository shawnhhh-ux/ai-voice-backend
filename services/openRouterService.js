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

        this.client = axios.create({
            baseURL: this.baseURL,
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
                'Content-Type': 'application/json',
                'HTTP-Referer': process.env.SERVER_URL || 'https://your-render-app.onrender.com',
                'X-Title': this.developerInfo.project,
                'X-Developer': this.developerInfo.name,
                'X-GitHub': this.developerInfo.github
            },
            timeout: 30000
        });

        console.log('OpenRouterService initialized by', this.developerInfo.name);
    }

    /**
     * Send a message to OpenRouter AI and get response
     * @param {Object} params - Message parameters
     * @param {string} params.message - User message
     * @param {string} params.conversationId - Conversation ID for context
     * @param {string} params.sessionId - Session ID for tracking
     * @param {string} params.systemPrompt - System prompt for AI behavior
     * @returns {Promise<Object>} AI response
     */
    async sendMessage({ message, conversationId, sessionId, systemPrompt }) {
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

            console.log(`[OpenRouter] Sending message from ${this.developerInfo.name}: ${message.substring(0, 100)}...`);

            const response = await this.client.post('/chat/completions', requestBody);

            const aiResponse = response.data.choices[0].message.content;

            console.log(`[OpenRouter] Response received by ${this.developerInfo.github}`);

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
            console.error('[OpenRouter] API Error:', error.response?.data || error.message);
            
            let errorMessage = 'AI service error';
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
            } else {
                errorMessage = `Open Router service error: ${error.message}`;
            }

            return {
                success: false,
                error: errorMessage,
                code: `OPENROUTER_${statusCode}`,
                developer: this.developerInfo.name
            };
        }
    }

    /**
     * Stream AI response for real-time updates
     * @param {Object} params - Stream parameters
     * @param {string} params.message - User message
     * @param {string} params.conversationId - Conversation ID
     * @param {Function} params.onChunk - Callback for each chunk
     * @param {Function} params.onComplete - Callback when complete
     * @param {Function} params.onError - Callback for errors
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

            console.log(`[OpenRouter] Streaming message from ${this.developerInfo.github}`);

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
                console.log(`[OpenRouter] Stream completed for ${this.developerInfo.name}`);
                onComplete({
                    fullResponse,
                    conversationId: conversationId || this.generateId(),
                    developer: this.developerInfo.name
                });
            });

            response.data.on('error', (error) => {
                console.error('[OpenRouter] Stream error:', error);
                onError(error);
            });

        } catch (error) {
            console.error('[OpenRouter] Stream initialization error:', error);
            onError(error);
        }
    }

    /**
     * Process audio transcription and get AI response
     * @param {string} audioData - Base64 encoded audio data
     * @param {string} sessionId - Session ID
     * @returns {Promise<Object>} Processed response with transcription and AI reply
     */
    async processAudio(audioData, sessionId) {
        try {
            console.log(`[OpenRouter] Processing audio for session: ${sessionId} by ${this.developerInfo.github}`);

            // Note: OpenRouter doesn't directly process audio
            // You would need to use a speech-to-text service first
            // For now, we'll simulate audio processing
            
            // Simulate speech-to-text processing
            const transcribedText = await this.simulateSpeechToText(audioData);
            
            // Get AI response for transcribed text
            const aiResponse = await this.sendMessage({
                message: transcribedText,
                sessionId: sessionId
            });

            return {
                success: true,
                data: {
                    transcribedText: transcribedText,
                    response: aiResponse.data?.response || 'No response generated',
                    sessionId: sessionId,
                    developer: this.developerInfo.name,
                    github: this.developerInfo.github
                }
            };

        } catch (error) {
            console.error('[OpenRouter] Audio processing error:', error);
            return {
                success: false,
                error: 'Audio processing failed',
                code: 'AUDIO_PROCESSING_ERROR',
                developer: this.developerInfo.name
            };
        }
    }

    /**
     * Simulate speech-to-text processing
     * @param {string} audioData - Base64 audio data
     * @returns {Promise<string>} Transcribed text
     */
    async simulateSpeechToText(audioData) {
        // In a real implementation, you would use:
        // - Google Speech-to-Text
        // - Azure Speech Services
        // - AWS Transcribe
        // - Whisper API
        
        console.log(`[OpenRouter] Simulating STT for audio length: ${audioData?.length || 0} by ${this.developerInfo.github}`);
        
        // Simulate processing delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Return simulated transcription
        return "This is a simulated transcription of the audio. In a real implementation, this would be the actual transcribed text from the audio input.";
    }

    /**
     * Get available models from OpenRouter
     * @returns {Promise<Array>} List of available models
     */
    async getAvailableModels() {
        try {
            console.log(`[OpenRouter] Fetching models by ${this.developerInfo.name}`);
            
            const response = await this.client.get('/models');
            return {
                success: true,
                data: {
                    models: response.data.data,
                    total: response.data.data.length,
                    developer: this.developerInfo.name,
                    github: this.developerInfo.github
                }
            };
        } catch (error) {
            console.error('[OpenRouter] Error fetching models:', error);
            return {
                success: false,
                error: 'Failed to fetch models',
                developer: this.developerInfo.name
            };
        }
    }

    /**
     * Get service information and developer credits
     * @returns {Object} Service information
     */
    getServiceInfo() {
        return {
            service: 'OpenRouter AI Service',
            version: '1.0.0',
            developer: this.developerInfo.name,
            github: this.developerInfo.github,
            repository: this.developerInfo.repository,
            supported_models: [this.model],
            features: ['chat', 'streaming', 'audio_processing']
        };
    }

    /**
     * Generate unique ID
     * @returns {string} Unique identifier
     */
    generateId() {
        return `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

module.exports = OpenRouterService;