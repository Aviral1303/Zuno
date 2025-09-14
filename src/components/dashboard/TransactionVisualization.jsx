import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  CreditCard, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  Filter,
  RefreshCw,
  ExternalLink,
  ShoppingBag
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDummyTransactions } from "@/lib/analytics";

const TransactionVisualization = ({ transactions = [], merchants = [] }) => {
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [selectedMerchant, setSelectedMerchant] = useState('all');
  const [timeRange, setTimeRange] = useState('30'); // days
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalSpent: 0,
    transactionCount: 0,
    averageTransaction: 0,
    topMerchant: '',
    spendingTrend: 0
  });

  useEffect(() => {
    calculateSummary();
  }, [filteredTransactions]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, selectedMerchant, timeRange]);

  const filterTransactions = () => {
    const now = new Date();
    const daysAgo = new Date(now.getTime() - (parseInt(timeRange) * 24 * 60 * 60 * 1000));
    
    const source = transactions && transactions.length ? transactions : getDummyTransactions();
    let filtered = source.filter(txn => {
      const txnDate = new Date(txn.datetime || txn.ts);
      return txnDate >= daysAgo;
    });

    if (selectedMerchant !== 'all') {
      const merchantId = parseInt(selectedMerchant);
      filtered = filtered.filter(txn => {
        const merchant = txn.merchant;
        return merchant && merchant.id === merchantId;
      });
    }

    // Limit to top 4 for dashboard card, based on newest first
    const top = [...filtered].sort((a, b) => new Date(b.datetime || b.ts) - new Date(a.datetime || a.ts)).slice(0, 4);
    setFilteredTransactions(top);
  };

  const calculateSummary = () => {
    if (filteredTransactions.length === 0) {
      setSummary({
        totalSpent: 0,
        transactionCount: 0,
        averageTransaction: 0,
        topMerchant: '',
        spendingTrend: 0
      });
      return;
    }

    const totalSpent = filteredTransactions.reduce((sum, txn) => {
      return sum + parseFloat(txn.price?.total || txn.price?.amount || 0);
    }, 0);

    const transactionCount = filteredTransactions.length;
    const averageTransaction = totalSpent / transactionCount;

    // Find top merchant
    const merchantSpending = {};
    filteredTransactions.forEach(txn => {
      const merchant = txn.merchant?.name || 'Unknown';
      const amount = parseFloat(txn.price?.total || txn.price?.amount || 0);
      merchantSpending[merchant] = (merchantSpending[merchant] || 0) + amount;
    });

    const topMerchant = Object.entries(merchantSpending)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '';

    // Calculate spending trend (compare first half vs second half of period)
    const midPoint = Math.floor(filteredTransactions.length / 2);
    const firstHalf = filteredTransactions.slice(0, midPoint);
    const secondHalf = filteredTransactions.slice(midPoint);

    const firstHalfSpending = firstHalf.reduce((sum, txn) => 
      sum + parseFloat(txn.price?.total || txn.price?.amount || 0), 0);
    const secondHalfSpending = secondHalf.reduce((sum, txn) => 
      sum + parseFloat(txn.price?.total || txn.price?.amount || 0), 0);

    const spendingTrend = firstHalfSpending > 0 ? 
      ((secondHalfSpending - firstHalfSpending) / firstHalfSpending) * 100 : 0;

    setSummary({
      totalSpent,
      transactionCount,
      averageTransaction,
      topMerchant,
      spendingTrend
    });
  };

  const getMerchantName = (merchantId) => {
    const merchant = merchants.find(m => m.id === merchantId);
    return merchant?.name || 'Unknown';
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const formatAmount = (amount) => {
    return `$${parseFloat(amount).toFixed(2)}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-2xl flex items-center justify-center">
            <CreditCard className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Transaction Analysis</h3>
            <p className="text-sm text-gray-500">Spending insights and trends</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLoading(!isLoading)}
          className="flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-500" />
          <select
            value={selectedMerchant}
            onChange={(e) => setSelectedMerchant(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Merchants</option>
            {merchants.map(merchant => (
              <option key={merchant.id} value={merchant.id}>
                {merchant.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-gray-500" />
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="365">Last year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-gray-700">Total Spent</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatAmount(summary.totalSpent)}
          </div>
          <div className="text-xs text-gray-500">
            {summary.transactionCount} transactions
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Average</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {formatAmount(summary.averageTransaction)}
          </div>
          <div className="text-xs text-gray-500">per transaction</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Top Merchant</span>
          </div>
          <div className="text-lg font-bold text-gray-900 truncate">
            {summary.topMerchant || 'N/A'}
          </div>
          <div className="text-xs text-gray-500">most frequent</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            {summary.spendingTrend >= 0 ? (
              <TrendingUp className="w-4 h-4 text-orange-600" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-600" />
            )}
            <span className="text-sm font-medium text-gray-700">Trend</span>
          </div>
          <div className={`text-xl font-bold ${summary.spendingTrend >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
            {summary.spendingTrend >= 0 ? '+' : ''}{summary.spendingTrend.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">vs first half</div>
        </div>
      </div>

      {/* Transaction List */}
      <div className="space-y-3">
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Recent Transactions ({filteredTransactions.length})
        </h4>
        
        <AnimatePresence>
          {filteredTransactions.slice(0, 10).map((transaction, index) => (
            <motion.div
              key={`${transaction.datetime}-${index}`}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-gray-100 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-xl flex items-center justify-center">
                  <ShoppingBag className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h5 className="font-medium text-gray-900">
                    {transaction.products?.[0]?.name || transaction.description || 'Purchase'}
                  </h5>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <span>{getMerchantName(transaction.merchant?.id)}</span>
                    <span>•</span>
                    <span>{formatDate(transaction.datetime || transaction.ts)}</span>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <div className="font-semibold text-gray-900">
                  {formatAmount(transaction.price?.total || transaction.price?.amount || 0)}
                </div>
                {transaction.price?.adjustments && transaction.price.adjustments.length > 0 && (
                  <div className="text-xs text-green-600">
                    {transaction.price.adjustments.filter(a => a.type === 'DISCOUNT').length} discount(s)
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filteredTransactions.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <CreditCard className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No transactions found for the selected period</p>
          </div>
        )}

        {filteredTransactions.length > 10 && (
          <div className="text-center pt-4">
            <Button variant="outline" size="sm">
              View All Transactions
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TransactionVisualization;
