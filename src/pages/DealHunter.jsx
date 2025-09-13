import React from "react";
import { motion } from "framer-motion";
import { Target, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DealHunter() {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-emerald-500 to-green-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Target className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-4">Deal Hunter</h1>
          <p className="text-xl text-gray-600">AI-powered deal discovery tailored to your preferences</p>
        </motion.div>
        
        <div className="bg-gray-50 rounded-3xl p-12 text-center">
          <h2 className="text-2xl text-gray-600 mb-4">Coming Soon</h2>
          <p className="text-gray-500">This AI agent is being developed to provide you with the most relevant deals.</p>
        </div>
      </div>
    </div>
  );
}