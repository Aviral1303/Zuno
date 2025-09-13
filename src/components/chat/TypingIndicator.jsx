import React from 'react';
import { motion } from 'framer-motion';
import { Bot, Sparkles } from 'lucide-react';

export default function TypingIndicator({ showReasoning = false }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="flex gap-3 mb-6"
    >
      {/* Avatar */}
      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-gradient-to-r from-emerald-500 to-teal-500">
        <Bot className="w-5 h-5 text-white" />
      </div>

      {/* Typing Content */}
      <div className="max-w-2xl">
        <div className="bg-white/10 backdrop-blur-lg text-white border border-white/20 rounded-2xl p-4">
          {showReasoning ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-purple-400">
                <Sparkles className="w-4 h-4" />
                <span className="text-sm font-medium">AI is thinking...</span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                  Analyzing your preferences
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse" />
                  Searching for best deals
                </div>
                <div className="flex items-center gap-2 text-white/80 text-sm">
                  <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                  Comparing prices across retailers
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm">AI is typing</span>
              <div className="flex gap-1">
                {[...Array(3)].map((_, i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 bg-white/60 rounded-full"
                    animate={{
                      scale: [1, 1.5, 1],
                      opacity: [0.5, 1, 0.5],
                    }}
                    transition={{
                      duration: 1,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}