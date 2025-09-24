import OpenAI from 'openai';

class OpenAIService {
  constructor() {
    this.apiKey = process.env.REACT_APP_OPENAI_API || process.env.OPENAI_API;
    this.client = null;

    // Debug logging for environment variables
    console.log('OpenAI Environment Debug:', {
      REACT_APP_OPENAI_API: process.env.REACT_APP_OPENAI_API ? `${process.env.REACT_APP_OPENAI_API.substring(0, 8)}...` : 'undefined',
      OPENAI_API: process.env.OPENAI_API ? `${process.env.OPENAI_API.substring(0, 8)}...` : 'undefined',
      hasApiKey: !!this.apiKey,
      apiKeyLength: this.apiKey?.length || 0
    });

    if (this.apiKey) {
      try {
        this.client = new OpenAI({
          apiKey: this.apiKey,
          dangerouslyAllowBrowser: true
        });
        console.log('OpenAI client initialized successfully');
      } catch (error) {
        console.warn('Failed to initialize OpenAI client:', error);
      }
    } else {
      console.warn('No OpenAI API key found. Set REACT_APP_OPENAI_API or OPENAI_API environment variable.');
    }
  }

  isConfigured() {
    return this.apiKey && this.client;
  }

  async sendMessage(messages) {
    if (!this.isConfigured()) {
      throw new Error('OpenAI is not configured. Please set your REACT_APP_OPENAI_API or OPENAI_API environment variable and restart the app.');
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: messages,
        max_tokens: 1000,
        temperature: 0.7,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('OpenAI API Error:', error);
      throw new Error('Failed to get response from AI. Please check your API key and try again.');
    }
  }

  formatMessagesForAPI(chatHistory) {
    return chatHistory.map(msg => ({
      role: msg.sender === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
  }
}

export default new OpenAIService();