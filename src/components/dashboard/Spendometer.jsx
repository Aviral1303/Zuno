import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, TrendingDown, AlertCircle, Target } from "lucide-react";

const Spendometer = ({ monthlyBudget = 2000, currentSpending = 0, transactions = [], overrideTotal, overrideCategories }) => {
  const [spendingData, setSpendingData] = useState({
    current: 0,
    projected: 0,
    categories: {},
    trends: []
  });

  useEffect(() => {
    // Calculate spending data from transactions
    const calculateSpending = () => {
      // If an override is provided (from Budget Analyzer), prefer it
      if (typeof overrideTotal === 'number') {
        const categories = {};
        if (overrideCategories && typeof overrideCategories === 'object') {
          Object.entries(overrideCategories).forEach(([k, v]) => {
            categories[k] = Number(v) || 0;
          });
        }
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const daysElapsed = now.getDate();
        const daysInMonth = endOfMonth.getDate();
        const projected = (overrideTotal / Math.max(1, daysElapsed)) * daysInMonth;
        setSpendingData({ current: overrideTotal, projected, categories, trends: [] });
        return;
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      
      // Filter transactions for current month
      const monthlyTransactions = transactions.filter(txn => {
        const txnDate = new Date(txn.datetime || txn.ts);
        return txnDate >= startOfMonth && txnDate <= endOfMonth;
      });

      // Calculate current spending
      const current = monthlyTransactions.reduce((sum, txn) => {
        const amount = parseFloat(txn.price?.total || txn.price?.amount || 0);
        return sum + amount;
      }, 0);

      // Calculate projected spending (based on days elapsed)
      const daysElapsed = now.getDate();
      const daysInMonth = endOfMonth.getDate();
      const projected = (current / daysElapsed) * daysInMonth;

      // Calculate spending by category
      const categories = {};
      monthlyTransactions.forEach(txn => {
        const merchant = txn.merchant?.name || 'Unknown';
        const amount = parseFloat(txn.price?.total || txn.price?.amount || 0);
        categories[merchant] = (categories[merchant] || 0) + amount;
      });

      // Calculate daily trends (last 7 days)
      const trends = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
        const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
        
        const daySpending = transactions.filter(txn => {
          const txnDate = new Date(txn.datetime || txn.ts);
          return txnDate >= dayStart && txnDate < dayEnd;
        }).reduce((sum, txn) => sum + parseFloat(txn.price?.total || txn.price?.amount || 0), 0);
        
        trends.push({
          date: dayStart.toISOString().split('T')[0],
          amount: daySpending
        });
      }

      setSpendingData({ current, projected, categories, trends });
    };

    calculateSpending();
  }, [transactions]);
  // Recompute from override changes as well
  useEffect(() => {
    if (typeof overrideTotal === 'number') {
      const categories = {};
      if (overrideCategories && typeof overrideCategories === 'object') {
        Object.entries(overrideCategories).forEach(([k, v]) => {
          categories[k] = Number(v) || 0;
        });
      }
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      const daysElapsed = now.getDate();
      const daysInMonth = endOfMonth.getDate();
      const projected = (overrideTotal / Math.max(1, daysElapsed)) * daysInMonth;
      setSpendingData({ current: overrideTotal, projected, categories, trends: [] });
    }
  }, [overrideTotal, overrideCategories]);

  const spendingPercentage = (spendingData.current / monthlyBudget) * 100;
  const projectedPercentage = (spendingData.projected / monthlyBudget) * 100;
  const remainingBudget = monthlyBudget - spendingData.current;
  const isOverBudget = spendingData.current > monthlyBudget;
  const isNearBudget = spendingPercentage > 80;

  const getStatusColor = () => {
    if (isOverBudget) return "text-red-600";
    if (isNearBudget) return "text-yellow-600";
    return "text-green-600";
  };

  const getStatusIcon = () => {
    if (isOverBudget) return <AlertCircle className="w-5 h-5" />;
    if (isNearBudget) return <TrendingUp className="w-5 h-5" />;
    return <Target className="w-5 h-5" />;
  };

  const getStatusMessage = () => {
    if (isOverBudget) return `Over budget by $${Math.abs(remainingBudget).toFixed(2)}`;
    if (isNearBudget) return `Close to budget limit`;
    return `On track with budget`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Spendometer</h3>
            <p className="text-sm text-gray-500">Monthly budget tracking</p>
          </div>
        </div>
        <div className={`flex items-center gap-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm font-medium">{getStatusMessage()}</span>
        </div>
      </div>

      {/* Main Spending Circle */}
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-48 h-48">
          <svg className="w-48 h-48 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              className="text-gray-200"
            />
            {/* Progress circle */}
            <motion.circle
              cx="50"
              cy="50"
              r="40"
              stroke="currentColor"
              strokeWidth="8"
              fill="none"
              strokeLinecap="round"
              className={isOverBudget ? "text-red-500" : isNearBudget ? "text-yellow-500" : "text-emerald-500"}
              strokeDasharray={`${2 * Math.PI * 40}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 40 }}
              animate={{ 
                strokeDashoffset: 2 * Math.PI * 40 * (1 - Math.min(spendingPercentage, 100) / 100)
              }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          
          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-2xl font-bold text-gray-900">
              ${spendingData.current.toFixed(0)}
            </div>
            <div className="text-sm text-gray-500">
              of ${monthlyBudget.toFixed(0)}
            </div>
            <div className={`text-xs font-medium ${getStatusColor()}`}>
              {spendingPercentage.toFixed(1)}%
            </div>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Projected</span>
          </div>
          <div className="text-lg font-semibold text-gray-900">
            ${spendingData.projected.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">
            {projectedPercentage.toFixed(1)}% of budget
          </div>
        </div>
        
        <div className="bg-gray-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Remaining</span>
          </div>
          <div className={`text-lg font-semibold ${remainingBudget >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
            ${Math.abs(remainingBudget).toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">
            {remainingBudget >= 0 ? 'left to spend' : 'over budget'}
          </div>
        </div>
      </div>

      {/* Top Categories */}
      {Object.keys(spendingData.categories).length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-semibold text-gray-700 mb-3">Top Categories</h4>
          <div className="space-y-2">
            {Object.entries(spendingData.categories)
              .sort(([,a], [,b]) => b - a)
              .slice(0, 3)
              .map(([category, amount]) => (
                <div key={category} className="flex items-center justify-between">
                  <span className="text-sm text-gray-600 truncate">{category}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 rounded-full h-2">
                      <motion.div
                        className="bg-emerald-500 h-2 rounded-full"
                        initial={{ width: 0 }}
                        animate={{ width: `${(amount / spendingData.current) * 100}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-16 text-right">
                      ${amount.toFixed(0)}
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* Daily Trends */}
      {spendingData.trends.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">7-Day Trend</h4>
          <div className="flex items-end gap-1 h-16">
            {spendingData.trends.map((trend, index) => {
              const maxAmount = Math.max(...spendingData.trends.map(t => t.amount));
              const height = maxAmount > 0 ? (trend.amount / maxAmount) * 100 : 0;
              
              return (
                <motion.div
                  key={trend.date}
                  className="flex-1 bg-emerald-500 rounded-t-sm"
                  initial={{ height: 0 }}
                  animate={{ height: `${height}%` }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>{spendingData.trends[0]?.date}</span>
            <span>{spendingData.trends[spendingData.trends.length - 1]?.date}</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default Spendometer;
