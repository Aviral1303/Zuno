import React from 'react';
import { motion } from 'framer-motion';
import { User, Bot, ShoppingBag, ThumbsUp, ThumbsDown } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function ChatBubble({ message, index, prevSender, timestamp }) {
  const isUser = message.sender === 'user';
  const isDealtRecommendation = message.message_type === 'deal_recommendation';
  const showHeader = !isUser && prevSender !== message.sender;
  const timeText = timestamp ? new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={`flex gap-3 mb-6 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {/* Avatar */}
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 shadow ${
        isUser 
          ? 'bg-gradient-to-br from-indigo-600 to-purple-600' 
          : 'bg-gradient-to-br from-emerald-500 to-teal-500'
      }`}>
        {isUser ? (
          <User className="w-5 h-5 text-white" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      {/* Message Content */}
      <div className={`max-w-2xl ${isUser ? 'items-end' : 'items-start'} flex flex-col`}>
        {showHeader && (
          <div className="text-[10px] uppercase tracking-wider text-gray-400 mb-1">Zuno Concierge</div>
        )}
        <div className={`rounded-2xl p-4 shadow-sm border ${
          isUser 
            ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white ml-auto border-transparent' 
            : 'bg-white text-gray-900 border-gray-200'
        }`}>
          {isDealtRecommendation ? (
            <DealRecommendation message={message} />
          ) : (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.message}</p>
          )}
        </div>
        {!isUser && timeText && (
          <div className="text-[10px] text-gray-400 mt-1">{timeText}</div>
        )}
        
        {!isUser && !isDealtRecommendation && (
          <div className="flex items-center gap-2 mt-2">
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 h-8 rounded-xl">
              <ThumbsUp className="w-3 h-3 mr-1" />
              Helpful
            </Button>
            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-700 hover:bg-gray-100 h-8 rounded-xl">
              <ThumbsDown className="w-3 h-3 mr-1" />
              Not helpful
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function DealRecommendation({ message }) {
  // Mock deal data based on message
  const deal = {
    product: "MacBook Pro 14-inch",
    price: "$1,599",
    originalPrice: "$1,999", 
    discount: "20% OFF",
    retailer: "Apple Store",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300&h=200&fit=crop"
  };

  return (
    <div className="space-y-4">
      <p className="text-sm">{message.message}</p>
      
      <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
        <div className="flex gap-4">
          <img 
            src={deal.image} 
            alt={deal.product}
            className="w-20 h-20 object-cover rounded-xl"
          />
          <div className="flex-1">
            <h4 className="font-semibold text-gray-900 mb-1">{deal.product}</h4>
            <p className="text-gray-600 text-sm mb-2">{deal.retailer}</p>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl font-bold text-gray-900">{deal.price}</span>
              <span className="text-gray-500 line-through text-sm">{deal.originalPrice}</span>
              <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">
                {deal.discount}
              </Badge>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
                <ShoppingBag className="w-3 h-3 mr-1" />
                Buy Now
              </Button>
              <Button size="sm" variant="outline" className="border-gray-200 text-gray-700 hover:bg-gray-100">
                Details
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}