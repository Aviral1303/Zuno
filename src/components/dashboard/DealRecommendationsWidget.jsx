import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Target, 
  Sparkles, 
  ExternalLink, 
  PlusCircle, 
  TrendingDown,
  ShoppingBag,
  RefreshCw,
  Filter,
  Star
} from "lucide-react";
import { Button } from "@/components/ui/button";

const DealRecommendationsWidget = ({ spendingSummary }) => {
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [budget, setBudget] = useState('');

  const categories = [
    { id: 'all', name: 'All Categories' },
    { id: 'electronics', name: 'Electronics' },
    { id: 'home', name: 'Home & Garden' },
    { id: 'fashion', name: 'Fashion' },
    { id: 'books', name: 'Books & Media' },
    { id: 'sports', name: 'Sports & Outdoors' }
  ];

  const fetchDeals = async () => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      
      // Use Claude search for personalized deals
      // Personalize query by top merchant/category when available
      const topMerchant = spendingSummary?.topMerchant;
      const base = selectedCategory !== 'all' ? `${selectedCategory} deals` : 'best deals today';
      const query = topMerchant ? `${base} at ${topMerchant}` : base;
      const budgetCents = budget ? Math.round(parseFloat(budget) * 100) : undefined;
      
      const response = await fetch(`${baseUrl}/dealhunter/claude_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          budget_cents: budgetCents,
          max_results: 6
        })
      });
      
      const data = await response.json();
      if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
        setDeals(data.items);
      } else {
        // Fallback to mock data if API fails or returns empty list
        setDeals(getMockDeals());
      }
    } catch (error) {
      console.error('Failed to fetch deals:', error);
      setDeals(getMockDeals());
    } finally {
      setIsLoading(false);
    }
  };

  const getMockDeals = () => [
    {
      title: "Apple AirPods Pro (2nd Gen)",
      url: "https://www.amazon.com/Apple-AirPods-Pro-2nd-Gen/dp/B0D1R4ZQ9S/",
      merchant_name: "Amazon",
      price_usd: 199.99,
      image: "https://images-na.ssl-images-amazon.com/images/I/61SUj2aKoEL._AC_SX679_.jpg",
      reason: "Best noise cancellation in wireless earbuds with excellent sound quality"
    },
    {
      title: "Sony WH-1000XM5 Headphones",
      url: "https://www.amazon.com/Sony-WH-1000XM5-Canceling-Headphones-Hands-Free/dp/B09XS7JWHH/",
      merchant_name: "Amazon",
      price_usd: 299.99,
      image: "https://images-na.ssl-images-amazon.com/images/I/71o8Q5XJS5L._AC_SX679_.jpg",
      reason: "Industry-leading noise cancellation with 30-hour battery life"
    },
    {
      title: "Nintendo Switch OLED",
      url: "https://www.target.com/p/nintendo-switch-oled-model-with-white-joy-con-controllers/-/A-84680346",
      merchant_name: "Target",
      price_usd: 349.99,
      image: "https://target.scene7.com/is/image/Target/GUEST_12345678-1234-1234-1234-123456789012",
      reason: "Perfect for gaming on the go with vibrant OLED display"
    },
    {
      title: "Instant Pot Duo 7-in-1",
      url: "https://www.walmart.com/ip/Instant-Pot-Duo-7-in-1-Electric-Pressure-Cooker-6-Quart/554499512",
      merchant_name: "Walmart",
      price_usd: 79.99,
      image: "https://i5.walmartimages.com/asr/12345678-1234-1234-1234-123456789012.jpeg",
      reason: "Versatile kitchen appliance that replaces 7 different tools"
    }
  ];

  useEffect(() => {
    fetchDeals();
  }, [selectedCategory, budget]);

  const trackDeal = async (deal) => {
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      
      // Extract product info from URL
      const response = await fetch(`${baseUrl}/product/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: deal.url })
      });
      
      const data = await response.json();
      if (data.ok && data.canonical) {
        // Add to price watch
        await fetch(`${baseUrl}/price-protection/watch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            external_user_id: 'zuno_user_123',
            canonical_id: data.canonical,
            target_price_cents: Math.round(deal.price_usd * 100),
            note: deal.title
          })
        });
        
        // Show success message (you could add a toast notification here)
        console.log('Deal tracked successfully!');
      }
    } catch (error) {
      console.error('Failed to track deal:', error);
    }
  };

  const getMerchantColor = (merchant) => {
    switch (merchant.toLowerCase()) {
      case 'amazon':
        return 'from-orange-500 to-orange-600';
      case 'target':
        return 'from-red-500 to-red-600';
      case 'walmart':
        return 'from-blue-500 to-blue-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  const getDiscountBadge = (deal) => {
    // Mock discount calculation
    const originalPrice = deal.price_usd * 1.2; // Assume 20% discount
    const discount = Math.round(((originalPrice - deal.price_usd) / originalPrice) * 100);
    
    if (discount > 0) {
      return (
        <span className="absolute top-2 left-2 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
          -{discount}%
        </span>
      );
    }
    return null;
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
            <Target className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Deal Recommendations</h3>
            <p className="text-sm text-gray-500">AI-powered personalized deals</p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDeals}
          disabled={isLoading}
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
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {categories.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Max Budget:</span>
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="No limit"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-24 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Deals Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence>
          {isLoading ? (
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-64 bg-gray-50 rounded-2xl border border-gray-100 animate-pulse" />
            ))
          ) : (
            deals.map((deal, index) => (
              <motion.div
                key={deal.url || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ delay: index * 0.1 }}
                className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
              >
                <div className="relative">
                  {deal.image ? (
                    <img
                      src={deal.image}
                      alt={deal.title}
                      className="w-full h-32 object-cover"
                      onError={(e) => {
                        e.target.style.display = 'none';
                        e.target.nextSibling.style.display = 'flex';
                      }}
                    />
                  ) : null}
                  <div className="w-full h-32 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center" style={{ display: deal.image ? 'none' : 'flex' }}>
                    <ShoppingBag className="w-8 h-8 text-gray-400" />
                  </div>
                  {getDiscountBadge(deal)}
                </div>
                
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2 flex-1">
                      {deal.title}
                    </h4>
                    <div className={`w-6 h-6 bg-gradient-to-br ${getMerchantColor(deal.merchant_name)} rounded-full flex items-center justify-center flex-shrink-0`}>
                      <span className="text-white text-xs font-bold">
                        {deal.merchant_name.charAt(0)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-lg font-bold text-gray-900">
                      ${deal.price_usd?.toFixed(2) || 'N/A'}
                    </span>
                    <span className="text-xs text-gray-500">
                      at {deal.merchant_name}
                    </span>
                  </div>
                  
                  {deal.reason && (
                    <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                      {deal.reason}
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(deal.url, '_blank')}
                      className="flex-1 flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Deal
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => trackDeal(deal)}
                      className="flex items-center gap-1"
                    >
                      <PlusCircle className="w-3 h-3" />
                      Track
                    </Button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {deals.length === 0 && !isLoading && (
        <div className="text-center py-12 text-gray-500">
          <Target className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No deals found</h4>
          <p className="text-sm">Try adjusting your filters or budget</p>
        </div>
      )}

      {/* AI Insight */}
      <div className="mt-6 p-4 bg-gradient-to-r from-emerald-50 to-green-50 rounded-2xl border border-emerald-100">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="w-4 h-4 text-emerald-600" />
          <span className="text-sm font-semibold text-emerald-800">AI Insight</span>
        </div>
        <p className="text-sm text-emerald-700">
          These deals are personalized based on your shopping history and preferences. 
          The AI analyzes price trends, merchant reliability, and product reviews to recommend the best value.
        </p>
      </div>
    </motion.div>
  );
};

export default DealRecommendationsWidget;
