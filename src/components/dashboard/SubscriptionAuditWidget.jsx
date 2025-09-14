import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Calendar, 
  CreditCard, 
  AlertTriangle, 
  CheckCircle2, 
  TrendingUp,
  Mail,
  Trash2,
  RefreshCw,
  DollarSign
} from "lucide-react";
import { Button } from "@/components/ui/button";

const SubscriptionAuditWidget = ({ auditData = null }) => {
  const [subscriptionCandidates, setSubscriptionCandidates] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [summary, setSummary] = useState({
    totalCandidates: 0,
    monthlyCost: 0,
    annualCost: 0,
    potentialSavings: 0
  });

  useEffect(() => {
    if (auditData && auditData.candidates) {
      setSubscriptionCandidates(auditData.candidates);
      calculateSummary();
    }
  }, [auditData]);

  const calculateSummary = () => {
    if (!auditData || !auditData.candidates) {
      setSummary({
        totalCandidates: 0,
        monthlyCost: 0,
        annualCost: 0,
        potentialSavings: 0
      });
      return;
    }

    const candidates = auditData.candidates;
    const totalCandidates = candidates.length;
    
    // Estimate monthly cost (simplified calculation)
    const monthlyCost = candidates.reduce((sum, candidate) => {
      // Rough estimate: $10-50 per subscription
      return sum + 25; // Average estimate
    }, 0);

    const annualCost = monthlyCost * 12;
    const potentialSavings = annualCost * 0.3; // Assume 30% savings from cancellation

    setSummary({
      totalCandidates,
      monthlyCost,
      annualCost,
      potentialSavings
    });
  };

  const getSubscriptionType = (key) => {
    if (key.includes('prod::')) {
      return 'Product Subscription';
    } else if (key.includes('merchant::')) {
      return 'Service Subscription';
    }
    return 'Unknown';
  };

  const getMerchantName = (key) => {
    const parts = key.split('::');
    if (parts.length >= 2) {
      return parts[1] || 'Unknown';
    }
    return 'Unknown';
  };

  const getProductName = (key) => {
    const parts = key.split('::');
    if (parts.length >= 3) {
      return parts[2] || 'Unknown Product';
    }
    return 'Unknown Product';
  };

  const getFrequencyText = (avgGapDays) => {
    if (avgGapDays <= 7) return 'Weekly';
    if (avgGapDays <= 14) return 'Bi-weekly';
    if (avgGapDays <= 35) return 'Monthly';
    if (avgGapDays <= 70) return 'Bi-monthly';
    return 'Quarterly';
  };

  const getRiskLevel = (occurrences, avgGapDays) => {
    if (occurrences >= 6 && avgGapDays <= 35) return 'high';
    if (occurrences >= 3 && avgGapDays <= 35) return 'medium';
    return 'low';
  };

  const getRiskColor = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return 'text-red-600 bg-red-100';
      case 'medium':
        return 'text-yellow-600 bg-yellow-100';
      case 'low':
        return 'text-green-600 bg-green-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getRiskIcon = (riskLevel) => {
    switch (riskLevel) {
      case 'high':
        return <AlertTriangle className="w-4 h-4" />;
      case 'medium':
        return <TrendingUp className="w-4 h-4" />;
      case 'low':
        return <CheckCircle2 className="w-4 h-4" />;
      default:
        return <Calendar className="w-4 h-4" />;
    }
  };

  const generateCancelEmail = async (candidate) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const merchantName = getMerchantName(candidate.key);
      const productName = getProductName(candidate.key);
      
      const response = await fetch(`${baseUrl}/subscriptions/cancel_draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          merchant_name: merchantName,
          product_name: productName,
          external_user_id: 'zuno_user_123'
        })
      });
      
      const data = await response.json();
      if (data.subject && data.body) {
        // Create mailto link
        const subject = encodeURIComponent(data.subject);
        const body = encodeURIComponent(data.body);
        const mailtoLink = `mailto:support@${merchantName.toLowerCase().replace(/\s+/g, '')}.com?subject=${subject}&body=${body}`;
        window.open(mailtoLink);
      }
    } catch (error) {
      console.error('Failed to generate cancel email:', error);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-red-600 rounded-2xl flex items-center justify-center">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Subscription Audit</h3>
            <p className="text-sm text-gray-500">Detect recurring payments</p>
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

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Candidates</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            {summary.totalCandidates}
          </div>
          <div className="text-xs text-gray-500">potential subscriptions</div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-violet-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Monthly Cost</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            ${summary.monthlyCost}
          </div>
          <div className="text-xs text-gray-500">estimated</div>
        </div>

        <div className="bg-gradient-to-br from-orange-50 to-red-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="w-4 h-4 text-orange-600" />
            <span className="text-sm font-medium text-gray-700">Annual Cost</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            ${summary.annualCost}
          </div>
          <div className="text-xs text-gray-500">estimated</div>
        </div>

        <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Savings</span>
          </div>
          <div className="text-xl font-bold text-gray-900">
            ${summary.potentialSavings.toFixed(0)}
          </div>
          <div className="text-xs text-gray-500">if optimized</div>
        </div>
      </div>

      {/* Subscription Candidates */}
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-3">
          Detected Subscriptions ({subscriptionCandidates.length})
        </h4>
        
        <div className="space-y-3">
          <AnimatePresence>
            {subscriptionCandidates.map((candidate, index) => {
              const riskLevel = getRiskLevel(candidate.occurrences, candidate.avg_gap_days);
              const merchantName = getMerchantName(candidate.key);
              const productName = getProductName(candidate.key);
              const subscriptionType = getSubscriptionType(candidate.key);
              
              return (
                <motion.div
                  key={candidate.key}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-gray-400 to-gray-600 rounded-xl flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h5 className="font-medium text-gray-900">
                        {productName !== 'Unknown Product' ? productName : merchantName}
                      </h5>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        <span>{merchantName}</span>
                        <span>•</span>
                        <span>{subscriptionType}</span>
                        <span>•</span>
                        <span>{getFrequencyText(candidate.avg_gap_days)}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">
                          {candidate.occurrences} occurrences
                        </span>
                        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getRiskColor(riskLevel)}`}>
                          {getRiskIcon(riskLevel)}
                          {riskLevel} risk
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateCancelEmail(candidate)}
                      className="flex items-center gap-1"
                    >
                      <Mail className="w-3 h-3" />
                      Cancel
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Dismiss
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {subscriptionCandidates.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p>No subscription candidates detected</p>
              <p className="text-sm">Run an audit to detect recurring payments</p>
            </div>
          )}
        </div>

        {auditData && auditData.total_transactions && (
          <div className="mt-4 p-3 bg-blue-50 rounded-xl">
            <p className="text-sm text-blue-800">
              <strong>Analysis complete:</strong> Analyzed {auditData.total_transactions} transactions 
              and found {subscriptionCandidates.length} potential subscription patterns.
            </p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default SubscriptionAuditWidget;
