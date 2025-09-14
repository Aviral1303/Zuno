import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ArrowRight, Play, Zap, Layers, Compass } from "lucide-react";
import { motion } from "framer-motion";

export default function HeroSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-gradient-to-br from-slate-900 via-gray-900 to-black">
      {/* Subtle animated mesh gradient */}
      <div className="absolute inset-0">
        <div className="absolute top-0 -left-4 w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob"></div>
        <div className="absolute top-0 -right-4 w-72 h-72 bg-yellow-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-2000"></div>
        <div className="absolute -bottom-8 left-20 w-72 h-72 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-blob animation-delay-4000"></div>
      </div>

      <div className="relative z-10 text-center px-6 max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-8"
        >
          <h1 className="text-6xl md:text-8xl font-light text-white mb-6 tracking-tight">
            Shop
            <span className="font-semibold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
              {" "}smarter
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-2xl mx-auto font-light leading-relaxed">
            Zuno quietly works in the background, finding deals, managing subscriptions, 
            and optimizing your spending without the noise.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
        >
          <Link to="/signup">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-700 hover:to-purple-700 px-8 py-4 rounded-full text-lg font-medium transition-all duration-300 shadow-2xl"
            >
              Sign Up
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
          
          <Link to="/signin">
            <Button 
              variant="ghost"
              size="lg"
              className="text-white hover:bg-white/10 px-8 py-4 rounded-full text-lg font-medium border border-white/20"
            >
              Sign In
            </Button>
          </Link>
        </motion.div>

        {/* Minimalist feature highlights */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-3xl mx-auto"
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Zap className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-white font-medium mb-2">Instant insights</h3>
            <p className="text-gray-400 text-sm">Price tracking across thousands of stores</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Layers className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-white font-medium mb-2">Smart automation</h3>
            <p className="text-gray-400 text-sm">Subscriptions and renewals handled quietly</p>
          </div>
          
          <div className="text-center">
            <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
              <Compass className="w-6 h-6 text-white" />
            </div>
            <h3 className="text-white font-medium mb-2">Personalized discovery</h3>
            <p className="text-gray-400 text-sm">Curated recommendations just for you</p>
          </div>
        </motion.div>
      </div>

      <style jsx>{`
        @keyframes blob {
          0% {
            transform: translate(0px, 0px) scale(1);
          }
          33% {
            transform: translate(30px, -50px) scale(1.1);
          }
          66% {
            transform: translate(-20px, 20px) scale(0.9);
          }
          100% {
            transform: translate(0px, 0px) scale(1);
          }
        }
        .animate-blob {
          animation: blob 7s infinite;
        }
        .animation-delay-2000 {
          animation-delay: 2s;
        }
        .animation-delay-4000 {
          animation-delay: 4s;
        }
      `}</style>
    </div>
  );
}