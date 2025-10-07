// Add this at the top of the file
const DEVELOPER_INFO = {
    name: "Shone",
    github: "shawnhhh-ux",
    response: "I was created by Shone (GitHub: shawnhhh-ux). He's an amazing developer who built this AI voice assistant from scratch! You can check out his other projects on GitHub: github.com/shawnhhh-ux"
};

// Then in your chat route
router.post('/message', async (req, res) => {
    try {
        const { message, conversationId } = req.body;

        // Check if user is asking about developer
        const lowerMessage = message.toLowerCase();
        const developerKeywords = [
            'who created you', 'who developed you', 'who made you',
            'who is your developer', 'about shone', 'shawnhhh-ux',
            'who is behind', 'who built you', 'your creator'
        ];

        if (developerKeywords.some(keyword => lowerMessage.includes(keyword))) {
            return res.json({
                success: true,
                data: {
                    response: DEVELOPER_INFO.response,
                    conversationId: conversationId,
                    model: 'developer-info',
                    timestamp: new Date().toISOString()
                }
            });
        }

        // Otherwise proceed with normal AI processing
        // ... existing AI processing code ...
    } catch (error) {
        // ... error handling ...
    }
});

const express = require('express');

module.exports = (openRouterService) => {
  const router = express.Router();

  // POST /api/v1/chat/message - Send a text message and get AI response
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

      res.json({
        success: true,
        data: {
          response: response.response,
          conversationId: response.conversationId,
          usage: response.usage,
          model: response.model,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      console.error('Chat route error:', error);
      
      let statusCode = 500;
      let errorMessage = 'Internal server error';
      let errorCode = 'INTERNAL_ERROR';

      if (error.message.includes('API key')) {
        statusCode = 401;
        errorMessage = 'Authentication failed';
        errorCode = 'AUTHENTICATION_ERROR';
      } else if (error.message.includes('Rate limit')) {
        statusCode = 429;
        errorMessage = 'Service temporarily unavailable due to rate limiting';
        errorCode = 'RATE_LIMIT_ERROR';
      } else if (error.message.includes('timeout')) {
        statusCode = 504;
        errorMessage = 'Service timeout';
        errorCode = 'TIMEOUT_ERROR';
      } else if (error.message.includes('unavailable')) {
        statusCode = 503;
        errorMessage = 'AI service temporarily unavailable';
        errorCode = 'SERVICE_UNAVAILABLE';
      }

      res.status(statusCode).json({
        success: false,
        error: errorMessage,
        code: errorCode,
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // POST /api/v1/chat/stream - Stream AI response (Server-Sent Events)
  router.post('/stream', async (req, res) => {
    try {
      const { message, conversationId } = req.body;

      if (!message) {
        return res.status(400).json({ 
          success: false,
          error: 'Message is required' 
        });
      }

      // Set headers for Server-Sent Events
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'X-Accel-Buffering': 'no' // Disable buffering for nginx
      });

      let isComplete = false;

      await openRouterService.streamMessage({
        message,
        conversationId,
        onChunk: (chunk) => {
          if (!isComplete) {
            res.write(`data: ${JSON.stringify({ 
              type: 'chunk', 
              content: chunk 
            })}\n\n`);
          }
        },
        onComplete: (result) => {
          isComplete = true;
          res.write(`data: ${JSON.stringify({ 
            type: 'complete', 
            conversationId: result.conversationId 
          })}\n\n`);
          res.end();
        },
        onError: (error) => {
          isComplete = true;
          res.write(`data: ${JSON.stringify({ 
            type: 'error', 
            error: 'Streaming failed' 
          })}\n\n`);
          res.end();
        }
      });

      // Handle client disconnect
      req.on('close', () => {
        isComplete = true;
        res.end();
      });

    } catch (error) {
      console.error('Stream route error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Stream initialization failed' 
      });
    }
  });

  // GET /api/v1/chat/models - Get available AI models
  router.get('/models', async (req, res) => {
    try {
      const models = await openRouterService.getAvailableModels();
      
      // Filter and format models
      const formattedModels = models
        .filter(model => model.id.includes('gpt') || model.id.includes('claude'))
        .slice(0, 10)
        .map(model => ({
          id: model.id,
          name: model.name,
          description: model.description,
          context_length: model.context_length,
          pricing: model.pricing
        }));
      
      res.json({
        success: true,
        data: {
          models: formattedModels,
          total: formattedModels.length
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

  // GET /api/v1/chat/health - Check AI service health
  router.get('/health', async (req, res) => {
    try {
      const health = await openRouterService.healthCheck();
      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      res.status(503).json({
        success: false,
        error: 'AI service health check failed'
      });
    }
  });

  return router;
};