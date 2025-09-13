// ChatMessage entity for managing chat messages
export class ChatMessage {
  constructor(data = {}) {
    this.id = data.id || null;
    this.sender = data.sender || 'user'; // 'user' or 'bot'
    this.message = data.message || '';
    this.message_type = data.message_type || 'text'; // 'text', 'deal_recommendation', 'error'
    this.timestamp = data.timestamp || new Date().toISOString();
    this.metadata = data.metadata || {};
  }

  // Mock method to get chat messages
  static async getMessages(conversationId = 'default') {
    return ChatMessage.list('-created_date');
  }

  // Add list method expected by Chat.jsx
  static async list(orderBy = '-created_date', conversationId = 'default') {
    const messages = [
      new ChatMessage({
        id: '1',
        sender: 'user',
        message: 'Hello, I need help finding a good laptop deal',
        message_type: 'text',
        timestamp: new Date(Date.now() - 300000).toISOString()
      }),
      new ChatMessage({
        id: '2',
        sender: 'ai',
        message: 'I found some great laptop deals for you!',
        message_type: 'deal_recommendation',
        timestamp: new Date(Date.now() - 200000).toISOString(),
        metadata: {
          product: 'MacBook Pro 14-inch',
          price: '$1,599',
          originalPrice: '$1,999',
          discount: '20% OFF',
          retailer: 'Apple Store'
        }
      })
    ];

    const sorted = [...messages].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return orderBy?.startsWith('-') ? sorted.reverse() : sorted;
  }

  // Mock method to send a message
  static async send(message, conversationId = 'default') {
    // This would typically make an API call
    console.log('Sending message:', message);
    
    // Mock bot response
    const botResponse = new ChatMessage({
      id: Date.now().toString(),
      sender: 'bot',
      message: 'Thanks for your message! I\'m processing your request.',
      message_type: 'text',
      timestamp: new Date().toISOString()
    });

    return {
      userMessage: new ChatMessage({
        id: (Date.now() - 1).toString(),
        sender: 'user',
        message: message,
        message_type: 'text',
        timestamp: new Date(Date.now() - 1000).toISOString()
      }),
      botResponse: botResponse
    };
  }

  // Mock method to create a message
  static async create(data) {
    // This would typically make an API call
    console.log('Creating chat message:', data);
    return { success: true, id: Date.now().toString() };
  }
}
