class ConversationService {
  constructor() {
    this.conversations = new Map();
    this.conversationExpiry = 30 * 60 * 1000; // 30 minutes
    this.maxMessagesPerConversation = 50;
    
    // Clean up expired conversations every 5 minutes
    setInterval(() => this.cleanupExpiredConversations(), 5 * 60 * 1000);
    
    console.log('Conversation Service initialized with in-memory storage');
  }

  createConversation(conversationId) {
    if (!this.conversations.has(conversationId)) {
      this.conversations.set(conversationId, {
        messages: [],
        createdAt: Date.now(),
        lastAccessed: Date.now()
      });
      console.log(`Created new conversation: ${conversationId}`);
    }
    return this.getConversation(conversationId);
  }

  getConversation(conversationId) {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.lastAccessed = Date.now();
      return conversation.messages;
    }
    return null;
  }

  addMessage(conversationId, role, content) {
    let conversation = this.conversations.get(conversationId);
    
    if (!conversation) {
      conversation = this.createConversation(conversationId);
    }

    const message = {
      role,
      content,
      timestamp: Date.now(),
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };

    conversation.messages.push(message);
    
    // Limit the number of messages to prevent memory issues
    if (conversation.messages.length > this.maxMessagesPerConversation) {
      conversation.messages = conversation.messages.slice(-this.maxMessagesPerConversation);
    }

    conversation.lastAccessed = Date.now();
    
    console.log(`Added ${role} message to conversation ${conversationId}`);
    return message;
  }

  deleteConversation(conversationId) {
    const deleted = this.conversations.delete(conversationId);
    if (deleted) {
      console.log(`Deleted conversation: ${conversationId}`);
    }
    return deleted;
  }

  cleanupExpiredConversations() {
    const now = Date.now();
    let deletedCount = 0;

    for (const [conversationId, conversation] of this.conversations.entries()) {
      if (now - conversation.lastAccessed > this.conversationExpiry) {
        this.conversations.delete(conversationId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} expired conversations`);
    }
  }

  // Get conversation statistics
  getStats() {
    return {
      totalConversations: this.conversations.size,
      totalMessages: Array.from(this.conversations.values()).reduce(
        (total, conv) => total + conv.messages.length, 0
      ),
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    };
  }

  // Get all conversations (for debugging/admin purposes)
  getAllConversations() {
    const result = {};
    for (const [id, conversation] of this.conversations.entries()) {
      result[id] = {
        messageCount: conversation.messages.length,
        createdAt: new Date(conversation.createdAt).toISOString(),
        lastAccessed: new Date(conversation.lastAccessed).toISOString(),
        messages: conversation.messages.slice(-5) // Last 5 messages
      };
    }
    return result;
  }
}

module.exports = ConversationService;