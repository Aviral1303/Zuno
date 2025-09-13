import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Send, 
  RotateCcw,
  Settings,
  Sparkles
} from "lucide-react";
import { ChatMessage } from "@/entities/ChatMessage";

import ChatBubble from "../components/chat/ChatBubble";
import VoiceToggle from "../components/chat/VoiceToggle";
import TypingIndicator from "../components/chat/TypingIndicator";

export default function Chat() {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showReasoning, setShowReasoning] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    loadMessages();
    // Welcome message
    setTimeout(() => {
      const welcomeMessage = {
        message: "Hi! I'm your Zuno shopping concierge. I can help you find deals, track prices, manage subscriptions, and plan gifts. What can I help you with today?",
        sender: "ai",
        message_type: "text"
      };
      setMessages([welcomeMessage]);
    }, 500);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const loadMessages = async () => {
    try {
      const chatMessages = await ChatMessage.list('-created_date');
      setMessages(chatMessages);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim()) return;

    const userMessage = {
      message: inputMessage,
      sender: "user",
      message_type: "text"
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage("");
    setIsTyping(true);

    // Save user message
    try {
      await ChatMessage.create(userMessage);
    } catch (error) {
      console.error("Error saving message:", error);
    }

    // Simulate AI thinking time
    setTimeout(() => {
      setShowReasoning(true);
    }, 500);

    // Simulate AI response
    setTimeout(async () => {
      setIsTyping(false);
      setShowReasoning(false);

      let aiResponse;
      const lowerInput = inputMessage.toLowerCase();

      if (lowerInput.includes('deal') || lowerInput.includes('laptop') || lowerInput.includes('macbook')) {
        aiResponse = {
          message: "Great! I found some excellent laptop deals for you. Here's a top recommendation based on your preferences:",
          sender: "ai",
          message_type: "deal_recommendation"
        };
      } else if (lowerInput.includes('gift') || lowerInput.includes('birthday')) {
        aiResponse = {
          message: "I'd be happy to help you find the perfect gift! Based on the recipient's interests and your budget, here are some personalized suggestions. Would you like me to set up automatic gift reminders for important dates?",
          sender: "ai",
          message_type: "text"
        };
      } else if (lowerInput.includes('subscription') || lowerInput.includes('cancel')) {
        aiResponse = {
          message: "I can help you manage all your subscriptions! Currently, you have 5 active subscriptions totaling $47/month. Would you like me to show you which ones you haven't used recently or help you find better deals?",
          sender: "ai",
          message_type: "text"
        };
      } else {
        aiResponse = {
          message: "I understand you're looking for shopping assistance. I can help you with finding deals, comparing prices, managing subscriptions, planning gifts, and tracking your spending. What specific area would you like to focus on?",
          sender: "ai",
          message_type: "text"
        };
      }

      setMessages(prev => [...prev, aiResponse]);
      
      try {
        await ChatMessage.create(aiResponse);
      } catch (error) {
        console.error("Error saving AI message:", error);
      }
    }, 3000);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleListening = () => {
    setIsListening(!isListening);
    if (!isListening) {
      // Simulate voice recognition
      setTimeout(() => {
        setInputMessage("Find me the best laptop deals under $2000");
        setIsListening(false);
      }, 2000);
    }
  };

  const clearChat = () => {
    setMessages([{
      message: "Chat cleared. How can I help you today?",
      sender: "ai",
      message_type: "text"
    }]);
  };

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-6 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Zuno Concierge</h1>
              <p className="text-gray-500 text-sm">Your AI shopping assistant</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={clearChat}
              className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-2xl"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="border-gray-200 text-gray-600 hover:bg-gray-100 rounded-2xl"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <AnimatePresence>
            {messages.map((message, index) => (
              <ChatBubble 
                key={index} 
                message={message} 
                index={index}
              />
            ))}
          </AnimatePresence>
          
          <AnimatePresence>
            {isTyping && (
              <TypingIndicator showReasoning={showReasoning} />
            )}
          </AnimatePresence>
          
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 p-6 shadow-lg">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4">
            <VoiceToggle 
              isListening={isListening}
              onToggleListening={toggleListening}
            />
            
            <div className="flex-1 relative">
              <Input
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me about deals, gifts, subscriptions..."
                className="bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 rounded-2xl pr-12 focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
              
              {isListening && (
                <motion.div
                  className="absolute right-4 top-1/2 -translate-y-1/2"
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  <div className="w-3 h-3 bg-indigo-500 rounded-full" />
                </motion.div>
              )}
            </div>

            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isTyping}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl px-6"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          
          <p className="text-gray-400 text-xs text-center mt-3">
            Zuno AI can make mistakes. Please verify important information.
          </p>
        </div>
      </div>
    </div>
  );
}