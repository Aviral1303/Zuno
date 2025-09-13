import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  MessageSquare, 
  Settings,
  Bell,
  Search,
  Filter
} from "lucide-react";

import ModernStatsGrid from "../components/dashboard/ModernStatsGrid";
import MinimalDealsSection from "../components/dashboard/MinimalDealsSection";

export default function Dashboard() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Clean header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8"
        >
          <div className="mb-4 lg:mb-0">
            <h1 className="text-3xl font-light text-gray-900 mb-2">
              {getGreeting()}
            </h1>
            <p className="text-gray-600">
              Here's what Zuno found for you today
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input 
                type="text"
                placeholder="Search products..."
                className="pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent w-64"
              />
            </div>
            <Button variant="outline" size="icon" className="rounded-full border-gray-200">
              <Filter className="w-4 h-4" />
            </Button>
            <Link to={createPageUrl("Chat")}>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-full">
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask Zuno
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats */}
        <ModernStatsGrid />

        {/* Main content */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <MinimalDealsSection />
            </motion.div>
            
            {/* Spending insights */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-8 bg-white rounded-3xl p-8 shadow-sm border border-gray-100"
            >
              <h3 className="text-xl font-light text-gray-900 mb-6">Spending insights</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                  <div>
                    <p className="font-medium text-gray-900">Electronics</p>
                    <p className="text-sm text-gray-500">Your top category this month</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">$1,240</p>
                    <p className="text-xs text-emerald-600">15% below budget</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl">
                  <div>
                    <p className="font-medium text-gray-900">Best saving opportunity</p>
                    <p className="text-sm text-gray-500">Weekend tech sales</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">Save $180</p>
                    <p className="text-xs text-gray-500">on average</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
            >
              <h3 className="font-medium text-gray-900 mb-4">Recent activity</h3>
              <div className="space-y-3">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <span className="text-gray-600">Found new deal: MacBook Pro</span>
                  <span className="text-gray-400 ml-auto">2m</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <span className="text-gray-600">Price drop alert: iPhone 15</span>
                  <span className="text-gray-400 ml-auto">1h</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span className="text-gray-600">Subscription renewed: Spotify</span>
                  <span className="text-gray-400 ml-auto">3h</span>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
              className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-3xl p-6 text-white"
            >
              <h3 className="font-medium mb-2">Zuno Pro</h3>
              <p className="text-indigo-100 text-sm mb-4">
                Get advanced insights and priority deal access
              </p>
              <Button variant="secondary" className="w-full bg-white text-gray-900 hover:bg-gray-100">
                Upgrade now
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}