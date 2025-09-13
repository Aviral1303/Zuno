import React from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Gift, 
  Target,
  Sparkles
} from 'lucide-react';

const stats = [
  {
    title: "Total Savings",
    value: "$2,847",
    change: "+23%",
    trend: "up",
    icon: DollarSign,
    color: "from-green-500 to-emerald-500"
  },
  {
    title: "Active Deals",
    value: "12",
    change: "3 new",
    trend: "up",
    icon: Target,
    color: "from-blue-500 to-cyan-500"
  },
  {
    title: "Orders This Month",
    value: "8",
    change: "+2 from last month",
    trend: "up",
    icon: ShoppingBag,
    color: "from-purple-500 to-pink-500"
  },
  {
    title: "Upcoming Gifts",
    value: "3",
    change: "2 this week",
    trend: "neutral",
    icon: Gift,
    color: "from-orange-500 to-yellow-500"
  }
];

export default function StatsGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {stats.map((stat, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: index * 0.1 }}
          className="group"
        >
          <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-6 border border-white/10 transition-all duration-300 hover:bg-white/10 hover:scale-105">
            <div className="flex items-center justify-between mb-4">
              <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}>
                <stat.icon className="w-6 h-6 text-white" />
              </div>
              {stat.trend === 'up' && (
                <TrendingUp className="w-5 h-5 text-green-400" />
              )}
            </div>
            
            <div className="text-3xl font-bold text-white mb-2">
              {stat.value}
            </div>
            
            <div className="text-sm text-white/70 mb-2">
              {stat.title}
            </div>
            
            <div className={`text-sm font-medium ${
              stat.trend === 'up' ? 'text-green-400' : 'text-white/60'
            }`}>
              {stat.change}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}