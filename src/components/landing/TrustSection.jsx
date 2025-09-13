
import React from 'react';
import { motion } from 'framer-motion';
import { Shield, Lock, Verified, Award, Users, Globe } from 'lucide-react';

const trustBadges = [
  {
    icon: Shield,
    title: "Bank-Grade Security",
    description: "256-bit SSL encryption"
  },
  {
    icon: Lock,
    title: "Privacy Protected",
    description: "GDPR & CCPA compliant"
  },
  {
    icon: Verified,
    title: "Verified Partners",
    description: "1000+ trusted retailers"
  },
  {
    icon: Award,
    title: "Award Winning",
    description: "2024 AI Innovation Award"
  }
];

const stats = [
  { label: "Happy Customers", value: "50K+", icon: Users },
  { label: "Countries Served", value: "25+", icon: Globe },
  { label: "Money Saved", value: "$10M+", icon: Award },
  { label: "Deals Found", value: "1M+", icon: Verified }
];

export default function TrustSection() {
  return (
    <section className="py-24 px-6 relative bg-slate-900">
      <div className="absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-slate-900 to-transparent opacity-50" />
      <div className="max-w-7xl mx-auto relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Trusted by
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              {" "}Thousands
            </span>
          </h2>
          <p className="text-xl text-white/70 max-w-3xl mx-auto">
            Your security and trust are our highest priority. Here's how we keep your data safe and your experience exceptional.
          </p>
        </motion.div>

        {/* Trust Badges */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {trustBadges.map((badge, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 text-center transition-all duration-300 hover:bg-white/10 hover:scale-105">
                <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <badge.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="font-bold text-white mb-2">{badge.title}</h3>
                <p className="text-white/70 text-sm">{badge.description}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="bg-white/5 backdrop-blur-lg rounded-3xl p-8 md:p-12 border border-white/10"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">
                  {stat.value}
                </div>
                <div className="text-white/70 text-sm font-medium">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
