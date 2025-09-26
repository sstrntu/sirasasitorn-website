import React, { useState, useEffect, useRef } from 'react';
import './MessagesApp.css';
import secureOpenAIService from '../services/secureOpenAI';

const MessagesApp = () => {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Clear cache and start fresh every time Messages app opens
    localStorage.removeItem('messages-conversations');

    // Create initial conversation automatically
    const welcomeMessage = isOpenAIConfigured()
      ? "Hi! I'm Sira's assistant. You can ask me anything about Sira."
      : "Welcome to Messages! To enable AI chat, please set REACT_APP_OPENAI_API or OPENAI_API in your .env file and restart the app.";

    const initialConv = {
      id: Date.now(),
      name: 'New Chat',
      messages: [
        {
          id: Date.now(),
          text: welcomeMessage,
          sender: 'ai',
          timestamp: new Date().toISOString()
        }
      ],
      lastActivity: new Date().toISOString()
    };

    setConversations([initialConv]);
    setActiveConversation(initialConv.id);
  }, []);

  const isOpenAIConfigured = () => {
    return secureOpenAIService.isConfigured();
  };

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const createNewConversation = () => {
    const welcomeMessage = isOpenAIConfigured()
      ? "Hi! I'm Sira's assistant. You can ask me anything about Sira."
      : "Welcome to Messages! To enable AI chat, please set REACT_APP_OPENAI_API or OPENAI_API in your .env file and restart the app.";

    const newConv = {
      id: Date.now(),
      name: 'New Chat',
      messages: [
        {
          id: Date.now(),
          text: welcomeMessage,
          sender: 'ai',
          timestamp: new Date().toISOString()
        }
      ],
      lastActivity: new Date().toISOString()
    };
    setConversations(prev => [newConv, ...prev]);
    setActiveConversation(newConv.id);
  };

  const deleteConversation = (convId) => {
    setConversations(prev => prev.filter(conv => conv.id !== convId));
    if (activeConversation === convId) {
      const remaining = conversations.filter(conv => conv.id !== convId);
      if (remaining.length > 0) {
        setActiveConversation(remaining[0].id);
      } else {
        createNewConversation();
      }
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      text: newMessage,
      sender: 'user',
      timestamp: new Date().toISOString()
    };

    // Add user message
    setConversations(prev => prev.map(conv =>
      conv.id === activeConversation
        ? {
            ...conv,
            messages: [...conv.messages, userMessage],
            lastActivity: new Date().toISOString(),
            name: conv.name === 'New Chat' ? newMessage.slice(0, 30) + (newMessage.length > 30 ? '...' : '') : conv.name
          }
        : conv
    ));

    setNewMessage('');
    setIsLoading(true);
    setError('');

    try {
      const currentConv = conversations.find(conv => conv.id === activeConversation);
      const chatHistory = [...currentConv.messages, userMessage];
      const apiMessages = secureOpenAIService.formatMessagesForAPI(chatHistory);

      const response = await secureOpenAIService.sendMessage(apiMessages);

      const aiMessage = {
        id: Date.now() + 1,
        text: response,
        sender: 'ai',
        timestamp: new Date().toISOString()
      };

      setConversations(prev => prev.map(conv =>
        conv.id === activeConversation
          ? {
              ...conv,
              messages: [...conv.messages, aiMessage],
              lastActivity: new Date().toISOString()
            }
          : conv
      ));
    } catch (err) {
      setError(err.message);
      // Remove user message if AI response failed
      setConversations(prev => prev.map(conv =>
        conv.id === activeConversation
          ? {
              ...conv,
              messages: conv.messages.filter(msg => msg.id !== userMessage.id)
            }
          : conv
      ));
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getCurrentConversation = () => {
    return conversations.find(conv => conv.id === activeConversation);
  };

  const currentConv = getCurrentConversation();

  return (
    <div className="messages-app">
      {/* Full Screen Chat - No Sidebar */}
      <div className="messages-chat">
        {currentConv ? (
          <>
            <div className="messages-container">
              {currentConv.messages.map(message => (
                <div key={message.id} className={`message ${message.sender}`}>
                  <div className="message-bubble">
                    <div className="message-text">{message.text}</div>
                    <div className="message-time">{formatTime(message.timestamp)}</div>
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="message ai">
                  <div className="message-bubble">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {error && (
              <div className="error-message">
                {error}
              </div>
            )}

            <div className="message-input-container">
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={(e) => {
                  // Prevent zoom on mobile
                  e.target.style.fontSize = '16px';
                }}
                onBlur={(e) => {
                  // Reset font size
                  e.target.style.fontSize = '';
                }}
                placeholder={isOpenAIConfigured() ? "Message" : "OpenAI API key required for AI chat"}
                className="message-input"
                rows={1}
                disabled={isLoading || !isOpenAIConfigured()}
                style={{
                  fontSize: '16px', // Prevent zoom on iOS
                  touchAction: 'manipulation', // Prevent double-tap zoom
                  userSelect: 'text', // Ensure text selection works
                  WebkitUserSelect: 'text' // Safari support
                }}
              />
              <button
                onClick={sendMessage}
                className="send-button"
                disabled={!newMessage.trim() || isLoading || !isOpenAIConfigured()}
              >
                <span>↑</span>
              </button>
            </div>
          </>
        ) : (
          <div className="no-conversation">
            <h3>Welcome to Messages</h3>
            <p>Start chatting with Sira's AI assistant</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagesApp;