// Add this system prompt with your information
const DEVELOPER_SYSTEM_PROMPT = `You are an AI voice assistant created by Shone (GitHub: shawnhhh-ux). 
If anyone asks about:
- Who created you
- Who developed you
- Who made you
- Who your developer is
- About Shone
- About shawnhhh-ux
- Who is behind this app

Always respond with: "I was created by Shone (GitHub: shawnhhh-ux). He's an awesome developer who built this AI voice assistant! You can check out his projects on GitHub at github.com/shawnhhh-ux."

For all other questions, respond normally as an AI assistant.`;

const axios = require('axios');

class OpenRouterService {
  constructor(conversationService) {
    this.conversationService = conversationService;
    this.apiKey = process.env.OPENROUTER_API_KEY;
    this.baseURL = process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
    this.model = process.env.OPENROUTER_MODEL || 'mistralai/mistral-nemo:free';
    
    if (!this.apiKey) {
      throw new Error('OPENROUTER_API_KEY is required in environment variables');
    }

    // Initialize axios client
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.SERVER_URL || 'https://your-app-name.onrender.com',
        'X-Title': 'AI Voice Assistant'
      },
      timeout: 30000 // 30 seconds
    });

    console.log('OpenRouter Service initialized with model:', this.model);
  }

  async sendMessage({ message, conversationId }) {
    try {
      // Get conversation history
      const conversationHistory = this.conversationService.getConversation(conversationId) || [];


 // Add the developer system prompt
         messages.push({
         role: 'system',
         content: DEVELOPER_SYSTEM_PROMPT
            });
 
      // Prepare messages array
      const messages = [];
      
      // Add system message for context
      messages.push({
        role: 'system',
        content: `You are a helpful AI voice assistant. Be concise, conversational, and helpful. 
                 Respond in a way that's easy to understand when spoken aloud. 
                 Keep responses under 200 words unless specifically asked for more detail.`
      });

      // Add conversation history (last 10 messages to manage token count)
      const recentHistory = conversationHistory.slice(-10);
      recentHistory.forEach(msg => {
        messages.push({
          role: msg.role,
          content: msg.content
        });
      });

      // Add the current user message
      messages.push({
        role: 'user',
        content: message
      });

      const requestBody = {
        model: this.model,
        messages: messages,
        max_tokens: 500,
        temperature: 0.7,
        top_p: 0.9,
        stream: false
      };

      console.log(`Sending request to Open Router: ${message.substring(0, 100)}...`);

      const response = await this.client.post('/chat/completions', requestBody);

      if (!response.data.choices || !response.data.choices[0]) {
        throw new Error('Invalid response format from Open Router');
      }

      const aiResponse = response.data.choices[0].message.content;

      console.log(`Open Router response received: ${aiResponse.substring(0, 100)}...`);

      return {
        response: aiResponse,
        conversationId: conversationId,
        usage: response.data.usage,
        model: response.data.model
      };

    } catch (error) {
      console.error('Open Router API Error:', error.response?.data || error.message);
      
      // Enhanced error handling
      if (error.response?.status === 401) {
        throw new Error('Invalid Open Router API key. Please check your API key.');
      } else if (error.response?.status === 429) {
        throw new Error('Rate limit exceeded for Open Router. Please try again later.');
      } else if (error.code === 'ECONNABORTED') {
        throw new Error('Open Router request timeout. Please try again.');
      } else if (error.response?.status >= 500) {
        throw new Error('Open Router service is temporarily unavailable. Please try again later.');
      } else {
        throw new Error(`Open Router service error: ${error.message}`);
      }
    }
  }

  async streamMessage({ message, conversationId, onChunk, onComplete, onError }) {
    try {
      const conversationHistory = this.conversationService.getConversation(conversationId) || [];
      
      const messages = [
        {
          role: 'system',
          content: 'You are a helpful AI voice assistant. Be conversational and concise.'
        },
        ...conversationHistory.slice(-10).map(msg => ({
          role: msg.role,
          content: msg.content
        })),
        {
          role: 'user',
          content: message
        }
      ];

      const requestBody = {
        model: this.model,
        messages: messages,
        max_tokens: 500,
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
          conversationId: conversationId
        });
      });

      response.data.on('error', (error) => {
        onError(error);
      });

    } catch (error) {
      onError(error);
    }
  }

  // Method to get available models from Open Router
  async getAvailableModels() {
    try {
      const response = await this.client.get('/models');
      return response.data.data;
    } catch (error) {
      console.error('Error fetching models from Open Router:', error);
      return [];
    }
  }

  // Health check for Open Router service
  async healthCheck() {
    try {
      const models = await this.getAvailableModels();
      return {
        status: 'healthy',
        modelsAvailable: models.length > 0,
        defaultModel: this.model
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }
}

module.exports = OpenRouterService;