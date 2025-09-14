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
  Filter,
  RefreshCw,
  TrendingUp,
  DollarSign,
  CreditCard,
  Target
} from "lucide-react";

import ModernStatsGrid from "../components/dashboard/ModernStatsGrid";
import MinimalDealsSection from "../components/dashboard/MinimalDealsSection";
import Spendometer from "../components/dashboard/Spendometer";
import TransactionVisualization from "../components/dashboard/TransactionVisualization";
import PriceTrackingWidget from "../components/dashboard/PriceTrackingWidget";
import AIInteractionPanel from "../components/dashboard/AIInteractionPanel";
import SubscriptionAuditWidget from "../components/dashboard/SubscriptionAuditWidget";
import DealRecommendationsWidget from "../components/dashboard/DealRecommendationsWidget";
import { summarizeTransactions, loadBudgetSnapshot } from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";

export default function Dashboard() {
  const { user, profile } = useAuth?.() || {};
  const [currentTime, setCurrentTime] = useState(new Date());
  const [merchants, setMerchants] = useState([]);
  const [syncResult, setSyncResult] = useState(null);
  const [optResult, setOptResult] = useState(null);
  const [auditResult, setAuditResult] = useState(null);
  const [watchAddResult, setWatchAddResult] = useState(null);
  const [watchList, setWatchList] = useState([]);
  const [matches, setMatches] = useState([]);
  
  // New state for comprehensive dashboard integration
  const [transactions, setTransactions] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [dashboardStats, setDashboardStats] = useState({
    totalSpent: 0,
    monthlyBudget: 2000,
    activeWatches: 0,
    subscriptionCandidates: 0,
    potentialSavings: 0
  });
  const [spendingSummary, setSpendingSummary] = useState(null);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Load all dashboard data on component mount
  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    setIsLoading(true);
    try {
      await Promise.all([
        loadMerchants(),
        loadTransactions(),
        loadPriceWatches(),
        loadPriceMatches(),
        runSubscriptionAudit(),
        loadUserProfile()
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const getGreeting = () => {
    const hour = currentTime.getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';

  const loadMerchants = async () => {
    try {
      const res = await fetch(`${baseUrl}/knot/merchants`);
      const data = await res.json();
      setMerchants(data.merchants || []);
    } catch (e) {
      console.error('loadMerchants failed', e);
    }
  };

  const loadTransactions = async () => {
    try {
      // Use the backend's dummy Amazon transactions endpoint for consistency
      const res = await fetch(`${baseUrl}/knot/amazon/transactions?external_user_id=zuno_user_123&limit=50&mock=1`);
      const data = await res.json();
      const allTransactions = (data && data.data && data.data.transactions) ? data.data.transactions : [];
      setTransactions(allTransactions);

      // Ingest transactions into RAG store for personalized Deal Hunter queries
      try {
        await fetch(`${baseUrl}/rag/ingest_transactions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ external_user_id: 'zuno_user_123', transactions: allTransactions })
        });
      } catch (e) {
        console.warn('RAG ingest failed', e);
      }

      // Summarize spending patterns for current month
      const summary = summarizeTransactions(allTransactions);
      setSpendingSummary(summary);

      // Prefer snapshot from Budget/Spending tracker if present
      const snap = loadBudgetSnapshot();
      const total = (snap && typeof snap.totalMonth === 'number') ? snap.totalMonth : summary.totalSpentMonth;
      setDashboardStats(prev => ({
        ...prev,
        totalSpent: total,
      }));
    } catch (e) {
      console.error('loadTransactions failed', e);
    }
  };

  const loadUserProfile = async () => {
    try {
      // This would typically load from Supabase auth context
      // For now, we'll use mock data
      const mockProfile = {
        monthly_budget: 2000,
        income_amount: 5000,
        shopping_preferences: ['electronics', 'home', 'fashion']
      };
      setUserProfile(mockProfile);
      
      setDashboardStats(prev => ({
        ...prev,
        monthlyBudget: mockProfile.monthly_budget
      }));
    } catch (e) {
      console.error('loadUserProfile failed', e);
    }
  };

  const runSync = async (merchantId = 44) => {
    try {
      const res = await fetch(`${baseUrl}/knot/transactions/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_id: merchantId, external_user_id: 'abc', limit: 5 })
      });
      const data = await res.json();
      setSyncResult(data);
    } catch (e) {
      console.error('runSync failed', e);
    }
  };

  const runOptimize = async (merchantId = 44) => {
    try {
      const res = await fetch(`${baseUrl}/optimize/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant_id: merchantId, amount_cents: 5000 })
      });
      const data = await res.json();
      setOptResult(data);
    } catch (e) {
      console.error('runOptimize failed', e);
    }
  };

  const runSubscriptionAudit = async () => {
    try {
      const res = await fetch(`${baseUrl}/subscriptions/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ external_user_id: 'zuno_user_123', merchants: [44,12,45], limit: 50, lookback_days: 365 })
      });
      const data = await res.json();
      setAuditResult(data);
      
      // Update dashboard stats
      setDashboardStats(prev => ({
        ...prev,
        subscriptionCandidates: data.candidates?.length || 0
      }));
    } catch (e) {
      console.error('runSubscriptionAudit failed', e);
    }
  };

  const loadPriceWatches = async () => {
    try {
      const res = await fetch(`${baseUrl}/price-protection/list?external_user_id=zuno_user_123`);
      const data = await res.json();
      setWatchList(data.watches || []);
      
      // Update dashboard stats
      setDashboardStats(prev => ({
        ...prev,
        activeWatches: data.watches?.length || 0
      }));
    } catch (e) {
      console.error('loadPriceWatches failed', e);
    }
  };

  const loadPriceMatches = async () => {
    try {
      const res = await fetch(`${baseUrl}/price-protection/matches?external_user_id=zuno_user_123`);
      const data = await res.json();
      setMatches(data.matches || []);
      
      // Calculate potential savings
      const potentialSavings = (data.matches || []).reduce((sum, match) => {
        const watch = watchList.find(w => w.id === match.watch_id);
        if (watch && watch.target_price_cents && match.found_price_cents) {
          const savings = (watch.target_price_cents - match.found_price_cents) / 100;
          return sum + Math.max(0, savings);
        }
        return sum;
      }, 0);
      
      setDashboardStats(prev => ({
        ...prev,
        potentialSavings
      }));
    } catch (e) {
      console.error('loadPriceMatches failed', e);
    }
  };

  const refreshAllData = async () => {
    setIsLoading(true);
    try {
      await loadDashboardData();
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Enhanced header with refresh button */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8"
        >
          <div className="mb-4 lg:mb-0">
            <h1 className="text-3xl font-light text-gray-900 mb-2">
              {(() => {
                try {
                  const name = (profile && profile.full_name) || (user && user.email && user.email.split('@')[0]) || '';
                  return name ? `Welcome, ${name}` : 'Welcome';
                } catch {
                  return 'Welcome';
                }
              })()}
            </h1>
            <p className="text-gray-600">
              Here's your complete shopping intelligence overview
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
            <Button 
              variant="outline" 
              size="icon" 
              className="rounded-full border-gray-200"
              onClick={refreshAllData}
              disabled={isLoading}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            <Link to={createPageUrl("Chat")}>
              <Button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 rounded-full">
                <MessageSquare className="w-4 h-4 mr-2" />
                Ask Zuno
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Enhanced Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Monthly Spending</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${dashboardStats.totalSpent.toFixed(0)}
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              of ${dashboardStats.monthlyBudget} budget
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center">
                <Target className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Price Watches</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardStats.activeWatches}
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              items being tracked
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Subscriptions</h3>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboardStats.subscriptionCandidates}
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              potential recurring payments
            </div>
          </div>

          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-700">Potential Savings</h3>
                <p className="text-2xl font-bold text-gray-900">
                  ${dashboardStats.potentialSavings.toFixed(0)}
                </p>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              from price alerts
            </div>
          </div>
        </motion.div>

        {/* Central AI Panel */}
        <div className="mb-8">
          <AIInteractionPanel />
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left Column - Main Features */}
          <div className="lg:col-span-2 space-y-8">
            {/* Spendometer */}
            <Spendometer 
              monthlyBudget={dashboardStats.monthlyBudget}
              currentSpending={dashboardStats.totalSpent}
              transactions={transactions}
              overrideTotal={(loadBudgetSnapshot() && loadBudgetSnapshot().totalMonth) || undefined}
              overrideCategories={(loadBudgetSnapshot() && loadBudgetSnapshot().byMerchant) || undefined}
            />

            {/* Transaction Visualization */}
            <TransactionVisualization 
              transactions={transactions}
              merchants={merchants}
            />

            {/* Deal Recommendations - personalized by spending summary */}
            <DealRecommendationsWidget spendingSummary={spendingSummary} />
          </div>

          {/* Right Column - Secondary Features */}
          <div className="space-y-8">
            {/* Price Tracking Widget */}
            <PriceTrackingWidget 
              watches={watchList}
              matches={matches}
            />

            {/* Subscription Audit Widget */}
            <SubscriptionAuditWidget 
              auditData={auditResult}
            />
            

            
          </div>
        </div>
      </div>
    </div>
  );
}