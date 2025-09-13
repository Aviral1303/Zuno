
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Target, 
  Shield, 
  RefreshCw, 
  TrendingUp,
  Smartphone
} from 'lucide-react';

const features = [
  {
    icon: MessageSquare,
    title: "Multi-Modal Shopping",
    description: "Chat, speak, or type your needs. Our AI understands context and preferences across all communication modes.",
    color: "from-purple-500 to-pink-500"
  },
  {
    icon: Target,
    title: "Personalized Deals",
    description: "AI-curated deals based on your shopping history, preferences, and budget. Never miss a perfect match again.",
    color: "from-blue-500 to-cyan-500"
  },
  {
    icon: Shield,
    title: "Secure Payments",
    description: "Bank-grade security with encrypted transactions. Your financial data is always protected.",
    color: "from-green-500 to-emerald-500"
  },
  {
    icon: RefreshCw,
    title: "Subscription Management",
    description: "Automatically manage recurring purchases, renewals, and cancellations. Set it and forget it.",
    color: "from-orange-500 to-yellow-500"
  },
  {
    icon: TrendingUp,
    title: "Smart Analytics",
    description: "Track spending patterns, savings achievements, and get insights to optimize your shopping behavior.",
    color: "from-indigo-500 to-purple-500"
  },
  {
    icon: Smartphone,
    title: "Cross-Device Sync",
    description: "Seamlessly continue your shopping journey across all your devices. Your AI remembers everything.",
    color: "from-rose-500 to-pink-500"
  }
];

export default function FeatureCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIndex((prevIndex) => (prevIndex + 1) % features.length);
    }, 4000);

    return () => clearInterval(timer);
  }, []);

  return (
    <section className="py-24 px-6 relative overflow-hidden bg-slate-900">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Redefining Shopping
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {" "}Experiences
            </span>
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Discover how our AI-powered platform transforms every aspect of your shopping journey
          </p>
        </motion.div>

        {/* Mobile Carousel */}
        <div className="md:hidden relative h-96">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentIndex}
              initial={{ opacity: 0, x: 100 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -100 }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0"
            >
              <FeatureCard feature={features[currentIndex]} />
            </motion.div>
          </AnimatePresence>
          
          {/* Dots indicator */}
          <div className="flex justify-center space-x-2 mt-8">
            {features.map((_, index) => (
              <button
                key={index}
                onClick={() => setCurrentIndex(index)}
                className={`w-3 h-3 rounded-full transition-all duration-300 ${
                  index === currentIndex ? 'bg-purple-500 w-8' : 'bg-white/30'
                }`}
              />
            ))}
          </div>
        </div>

        {/* Desktop Grid */}
        <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
            >
              <FeatureCard feature={feature} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ feature }) {
  const IconComponent = feature.icon;
  
  return (
    <div className="group h-full relative">
      <motion.div 
        className="absolute -inset-1 bg-gradient-to-r from-purple-600 to-blue-500 rounded-3xl blur-lg opacity-0 group-hover:opacity-60 transition-all duration-300"
        initial={{ opacity: 0 }}
        whileHover={{ opacity: 0.6 }}
      />
      <div className="relative bg-white/5 backdrop-blur-lg rounded-3xl p-8 border border-white/10 h-full transition-all duration-300 hover:bg-white/10">
        <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
          <IconComponent className="w-8 h-8 text-white" />
        </div>
        
        <h3 className="text-2xl font-bold text-white mb-4 group-hover:text-transparent group-hover:bg-gradient-to-r group-hover:from-purple-400 group-hover:to-blue-400 group-hover:bg-clip-text transition-all duration-300">
          {feature.title}
        </h3>
        
        <p className="text-white/70 leading-relaxed">
          {feature.description}
        </p>
      </div>
    </div>
  );
}
