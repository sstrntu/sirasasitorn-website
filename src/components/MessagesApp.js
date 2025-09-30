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
      : "Welcome to Messages! To enable AI chat, please configure OPENAI_API_KEY in backend/.env and restart the backend server.";

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

  const openAIConfigured = isOpenAIConfigured();

  useEffect(() => {
    scrollToBottom();
  }, [conversations, activeConversation]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const createNewConversation = () => {
    const welcomeMessage = isOpenAIConfigured()
      ? "Hi! I'm Sira's assistant. You can ask me anything about Sira."
      : "Welcome to Messages! To enable AI chat, please configure OPENAI_API_KEY in backend/.env and restart the backend server.";

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

    if (!openAIConfigured) {
      setError('Messages service is not configured yet. Add your backend URL or API key to enable sending.');
      return;
    }

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

            <div
              className="message-input-container"
              onClick={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
            >
              <textarea
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                onFocus={(e) => {
                  // Don't preventDefault on focus - this can cause navigation issues
                  // Force 16px font size to prevent zoom
                  e.target.style.fontSize = '16px';
                  e.target.style.WebkitTextSizeAdjust = '16px';

                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const isAndroidChrome = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);

                  // iOS Safari viewport fix - prevent white space injection
                  if (isIOS) {
                    document.body.style.position = 'fixed';
                    document.body.style.width = '100%';
                    setTimeout(() => {
                      e.target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'end',
                        inline: 'nearest'
                      });
                    }, 300);
                  }

                  // Chrome Android viewport fix - prevent resize issues
                  if (isAndroidChrome) {
                    // Store original viewport
                    const viewport = document.querySelector('meta[name=viewport]');
                    if (viewport) {
                      viewport.setAttribute('data-original-content', viewport.getAttribute('content'));
                      // Set viewport to prevent zoom and layout breaks
                      viewport.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, interactive-widget=resizes-visual');
                    }

                    // Handle keyboard resize for Chrome Android
                    const handleResize = () => {
                      if (document.activeElement === e.target) {
                        setTimeout(() => {
                          e.target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest',
                            inline: 'nearest'
                          });
                        }, 100);
                      }
                    };
                    window.addEventListener('resize', handleResize);
                    e.target.setAttribute('data-resize-handler', 'true');
                  }
                }}
                onBlur={(e) => {
                  // Reset font size
                  e.target.style.fontSize = '16px';

                  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                  const isAndroidChrome = /Android/.test(navigator.userAgent) && /Chrome/.test(navigator.userAgent);

                  // iOS Safari cleanup
                  if (isIOS) {
                    document.body.style.position = '';
                    document.body.style.width = '';
                    // Force repaint to fix any remaining white space
                    setTimeout(() => {
                      window.scrollTo(0, 0);
                    }, 100);
                  }

                  // Chrome Android cleanup
                  if (isAndroidChrome) {
                    // Restore original viewport
                    const viewport = document.querySelector('meta[name=viewport]');
                    if (viewport && viewport.getAttribute('data-original-content')) {
                      viewport.setAttribute('content', viewport.getAttribute('data-original-content'));
                      viewport.removeAttribute('data-original-content');
                    }

                    // Remove resize handler
                    if (e.target.getAttribute('data-resize-handler')) {
                      const handleResize = () => {
                        if (document.activeElement === e.target) {
                          setTimeout(() => {
                            e.target.scrollIntoView({
                              behavior: 'smooth',
                              block: 'nearest',
                              inline: 'nearest'
                            });
                          }, 100);
                        }
                      };
                      window.removeEventListener('resize', handleResize);
                      e.target.removeAttribute('data-resize-handler');
                    }
                  }
                }}
                onTouchStart={(e) => {
                  // Prevent event propagation that might cause navigation
                  e.stopPropagation();
                }}
                onClick={(e) => {
                  // Prevent event propagation that might cause navigation
                  e.stopPropagation();
                }}
                placeholder={openAIConfigured ? "Message" : "Messages service not configured"}
                className="message-input"
                rows={1}
                disabled={isLoading}
                style={{
                  fontSize: '16px !important', // Prevent zoom on iOS
                  touchAction: 'manipulation', // Prevent double-tap zoom
                  userSelect: 'text', // Ensure text selection works
                  WebkitUserSelect: 'text', // Safari support
                  WebkitAppearance: 'none', // Remove iOS styling
                  outline: 'none', // Remove focus outline that might cause issues
                  border: '1px solid #d0d0d0',
                  borderRadius: '20px',
                  padding: '8px 16px'
                }}
              />
              <button
                onClick={sendMessage}
                className="send-button"
                disabled={!newMessage.trim() || isLoading}
              >
                <span>↑</span>
              </button>
            </div>
            {!openAIConfigured && (
              <div className="error-message" style={{ marginTop: '8px' }}>
                Connect the secure OpenAI backend or set the API key to send messages.
              </div>
            )}
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
