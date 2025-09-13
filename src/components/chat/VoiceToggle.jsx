import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function VoiceToggle({ isListening, onToggleListening, isPlayingAudio }) {
  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="icon"
        onClick={onToggleListening}
        className={`relative rounded-full transition-all duration-300 ${
          isListening 
            ? 'bg-gradient-to-r from-purple-600 to-blue-600 border-purple-500 text-white' 
            : 'border-white/20 text-white hover:bg-white/10'
        }`}
      >
        {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        
        {isListening && (
          <motion.div
            className="absolute inset-0 rounded-full border-2 border-purple-400"
            animate={{
              scale: [1, 1.3, 1],
              opacity: [0.8, 0, 0.8],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        )}
      </Button>
      
      {isPlayingAudio && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="flex items-center gap-1 text-white/70"
        >
          <Volume2 className="w-4 h-4" />
          <div className="flex gap-1">
            {[...Array(3)].map((_, i) => (
              <motion.div
                key={i}
                className="w-1 h-4 bg-purple-400 rounded-full"
                animate={{
                  height: [4, 16, 4],
                }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  delay: i * 0.1,
                }}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}