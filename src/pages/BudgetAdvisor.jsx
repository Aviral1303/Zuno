import React from "react";
import { motion } from "framer-motion";
import { CreditCard } from "lucide-react";

export default function BudgetAdvisor() {
  return (
    <div className="min-h-screen bg-white p-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-3xl flex items-center justify-center mx-auto mb-6">
            <CreditCard className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-light text-gray-900 mb-4">Budget Advisor</h1>
          <p className="text-xl text-gray-600">Smart spending insights and budget optimization</p>
        </motion.div>
        
        <div className="bg-gray-50 rounded-3xl p-12 text-center">
          <h2 className="text-2xl text-gray-600 mb-4">Coming Soon</h2>
          <p className="text-gray-500">Advanced budget analysis and spending recommendations are in development.</p>
        </div>
      </div>
    </div>
  );
}