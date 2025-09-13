import React from 'react';
import { motion } from 'framer-motion';
import { 
  ShoppingBag,
  TrendingDown,
  Gift,
  Bell,
  CheckCircle,
  Clock
} from 'lucide-react';

const activities = [
  {
    id: 1,
    type: "deal_found",
    title: "New deal found for MacBook Pro",
    description: "20% off - matches your wishlist",
    time: "2 minutes ago",
    icon: TrendingDown,
    color: "text-green-400"
  },
  {
    id: 2,
    type: "order_delivered",
    title: "Order delivered successfully",
    description: "Nike Air Max 90 - Rate your experience",
    time: "1 hour ago",
    icon: CheckCircle,
    color: "text-blue-400"
  },
  {
    id: 3,
    type: "gift_reminder",
    title: "Gift reminder",
    description: "Mom's birthday in 3 days - View suggestions",
    time: "3 hours ago",
    icon: Gift,
    color: "text-purple-400"
  },
  {
    id: 4,
    type: "price_drop",
    title: "Price drop alert",
    description: "Dyson V15 Detect - Now $549 (was $749)",
    time: "5 hours ago",
    icon: TrendingDown,
    color: "text-orange-400"
  },
  {
    id: 5,
    type: "subscription_renewal",
    title: "Subscription renewal",
    description: "Spotify Premium - Auto-renewed for $9.99",
    time: "1 day ago",
    icon: Clock,
    color: "text-cyan-400"
  }
];

export default function ActivityFeed() {
  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
      <h3 className="text-2xl font-bold text-white mb-6">Recent Activity</h3>
      
      <div className="space-y-4 max-h-96 overflow-y-auto scrollbar-hide">
        {activities.map((activity, index) => (
          <motion.div
            key={activity.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: index * 0.1 }}
            className="flex items-start gap-4 p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-colors duration-200 cursor-pointer"
          >
            <div className={`w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center ${activity.color}`}>
              <activity.icon className="w-5 h-5" />
            </div>
            
            <div className="flex-1 min-w-0">
              <h4 className="text-white font-medium mb-1">
                {activity.title}
              </h4>
              <p className="text-white/70 text-sm mb-2">
                {activity.description}
              </p>
              <p className="text-white/50 text-xs">
                {activity.time}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}