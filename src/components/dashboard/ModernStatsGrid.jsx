import React from 'react';
import { motion } from 'framer-motion';
import { 
  TrendingUp, 
  Package, 
  Zap, 
  Target,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';

const metrics = [
  {
    label: "Monthly savings",
    value: "$847",
    change: "+12%",
    trend: "up",
    description: "vs last month"
  },
  {
    label: "Active deals",
    value: "23",
    change: "+5",
    trend: "up", 
    description: "new this week"
  },
  {
    label: "Avg deal quality",
    value: "94%",
    change: "+2%",
    trend: "up",
    description: "match score"
  },
  {
    label: "Time saved",
    value: "4.2h",
    change: "-0.8h",
    trend: "down",
    description: "shopping time"
  }
];

export default function ModernStatsGrid() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      {metrics.map((metric, index) => (
        <motion.div
          key={index}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className={`inline-flex items-center gap-1 text-sm font-medium ${
                metric.trend === 'up' ? 'text-emerald-600' : 'text-red-500'
              }`}>
                {metric.trend === 'up' ? (
                  <ArrowUpRight className="w-4 h-4" />
                ) : (
                  <ArrowDownRight className="w-4 h-4" />
                )}
                {metric.change}
              </span>
            </div>
          </div>
          
          <div className="space-y-1">
            <div className="text-3xl font-light text-gray-900">
              {metric.value}
            </div>
            <div className="text-sm font-medium text-gray-900">
              {metric.label}
            </div>
            <div className="text-xs text-gray-500">
              {metric.description}
            </div>
          </div>
        </motion.div>
      ))}
    </div>
  );
}