import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  TrendingUp, 
  TrendingDown, 
  Bell, 
  Eye, 
  Trash2, 
  PlusCircle,
  AlertTriangle,
  CheckCircle2,
  ExternalLink
} from "lucide-react";
import { Button } from "@/components/ui/button";

const PriceTrackingWidget = ({ watches = [], matches = [] }) => {
  const [priceWatches, setPriceWatches] = useState([]);
  const [priceMatches, setPriceMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState({
    activeWatches: 0,
    totalMatches: 0,
    potentialSavings: 0,
    alertsThisWeek: 0
  });

  useEffect(() => {
    setPriceWatches(watches);
    setPriceMatches(matches);
    calculateSummary();
  }, [watches, matches]);

  const calculateSummary = () => {
    const activeWatches = watches.length;
    const totalMatches = matches.length;
    
    // Calculate potential savings from matches
    const potentialSavings = matches.reduce((sum, match) => {
      const watch = watches.find(w => w.id === match.watch_id);
      if (watch && watch.target_price_cents && match.found_price_cents) {
        const savings = (watch.target_price_cents - match.found_price_cents) / 100;
        return sum + Math.max(0, savings);
      }
      return sum;
    }, 0);

    // Calculate alerts this week
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const alertsThisWeek = matches.filter(match => 
      new Date(match.created_at) >= weekAgo
    ).length;

    setSummary({
      activeWatches,
      totalMatches,
      potentialSavings,
      alertsThisWeek
    });
  };

  const getPriceChangeIcon = (watch, match) => {
    if (!watch.target_price_cents || !match.found_price_cents) return null;
    
    const change = match.found_price_cents - watch.target_price_cents;
    if (change < 0) {
      return <TrendingDown className="w-4 h-4 text-green-600" />;
    } else if (change > 0) {
      return <TrendingUp className="w-4 h-4 text-red-600" />;
    }
    return null;
  };

  const getPriceChangeColor = (watch, match) => {
    if (!watch.target_price_cents || !match.found_price_cents) return 'text-gray-600';
    
    const change = match.found_price_cents - watch.target_price_cents;
    if (change < 0) return 'text-green-600';
    if (change > 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const formatPrice = (cents) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getMatchStatus = (watch, match) => {
    if (!watch.target_price_cents || !match.found_price_cents) return 'unknown';
    
    const foundPrice = match.found_price_cents;
    const targetPrice = watch.target_price_cents;
    
    if (foundPrice <= targetPrice) return 'target-hit';
    if (foundPrice <= targetPrice * 1.1) return 'near-target';
    return 'above-target';
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'target-hit':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle2 className="w-3 h-3" />
            Target Hit
          </span>
        );
      case 'near-target':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <AlertTriangle className="w-3 h-3" />
            Close
          </span>
        );
      case 'above-target':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            <TrendingUp className="w-3 h-3" />
            Above Target
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 max-h-[760px] overflow-y-auto"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Price Tracking</h3>
            <p className="text-sm text-gray-500">Monitor price drops and alerts</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLoading(!isLoading)}
          className="flex items-center gap-2"
        >
          <PlusCircle className="w-4 h-4" />
          Add Watch
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Active Watches</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {summary.activeWatches}
          </div>
          <div className="text-xs text-gray-500">items tracked</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Total Alerts</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {summary.totalMatches}
          </div>
          <div className="text-xs text-gray-500">price drops found</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Potential Savings</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            ${summary.potentialSavings.toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">if you bought at target</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">This Week</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {summary.alertsThisWeek}
          </div>
          <div className="text-xs text-gray-500">new alerts</div>
        </div>
      </div>

      {/* Active Watches */}
      <div className="mb-6">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Active Watches ({priceWatches.length})
        </h4>
        
        <div className="space-y-3">
          <AnimatePresence>
            {priceWatches.slice(0, 4).map((watch, index) => (
              <motion.div
                key={watch.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-xl flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h5 className="font-medium text-gray-900">
                      {watch.note || watch.canonical_id || 'Tracked Item'}
                    </h5>
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <span>{watch.canonical_id}</span>
                      <span>•</span>
                      <span>Added {formatDate(watch.created_at)}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="font-semibold text-gray-900">
                      {watch.target_price_cents ? formatPrice(watch.target_price_cents) : 'No target'}
                    </div>
                    <div className="text-xs text-gray-500">target price</div>
                  </div>
                  <Button variant="outline" size="sm" className="flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" />
                    View
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {priceWatches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Eye className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No price watches yet</p>
              <p className="text-sm">Add items to track from Deal Hunter</p>
            </div>
          )}
        </div>
      </div>

      {/* Recent Alerts */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Recent Alerts ({priceMatches.length})
        </h4>
        
        <div className="space-y-3">
          <AnimatePresence>
            {priceMatches.slice(0, 4).map((match, index) => {
              const watch = priceWatches.find(w => w.id === match.watch_id);
              const status = getMatchStatus(watch, match);
              
              return (
                <motion.div
                  key={match.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-emerald-600 rounded-xl flex items-center justify-center">
                      <Bell className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">
                        {watch?.note || 'Price Alert'}
                      </h5>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{formatDate(match.created_at)}</span>
                        {getStatusBadge(status)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className={`font-semibold ${getPriceChangeColor(watch, match)}`}>
                        {formatPrice(match.found_price_cents)}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        {getPriceChangeIcon(watch, match)}
                        <span>found price</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="flex items-center gap-1">
                      <ExternalLink className="w-3 h-3" />
                      Buy Now
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {priceMatches.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Bell className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No price alerts yet</p>
              <p className="text-sm">Alerts will appear when prices drop</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default PriceTrackingWidget;
