import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Sparkles, ShoppingBag } from "lucide-react";

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

export default function HomeDeals() {
  const [deals, setDeals] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchDeals = async () => {
    setIsLoading(true);
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5001';
      const response = await fetch(`${baseUrl}/dealhunter/claude_search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: 'best tech and home deals today', max_results: 6 })
      });
      const data = await response.json();
      if (data.ok && Array.isArray(data.items) && data.items.length > 0) {
        setDeals(data.items);
      } else {
        setDeals(getMockDeals());
      }
    } catch (e) {
      console.error('Failed to fetch home deals:', e);
      setDeals(getMockDeals());
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  return (
    <section className="py-16 px-6 bg-white">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-emerald-500 to-green-600 rounded-2xl flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h3 className="text-2xl font-light text-gray-900">Trending Deals</h3>
              <p className="text-sm text-gray-500">Live picks from our AI recommender</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={fetchDeals} disabled={isLoading} className="rounded-2xl">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className="bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition-shadow"
                >
                  <div className="relative">
                    {deal.image ? (
                      <img
                        src={deal.image}
                        alt={deal.title}
                        className="w-full h-32 object-cover"
                        onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex'; }}
                      />
                    ) : null}
                    <div className="w-full h-32 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center" style={{ display: deal.image ? 'none' : 'flex' }}>
                      <ShoppingBag className="w-8 h-8 text-gray-400" />
                    </div>
                  </div>
                  <div className="p-4">
                    <h4 className="font-medium text-gray-900 text-sm line-clamp-2 mb-2">{deal.title}</h4>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-lg font-bold text-gray-900">${deal.price_usd?.toFixed(2) || 'N/A'}</span>
                      {deal.merchant_name && (
                        <span className="text-xs text-gray-500">at {deal.merchant_name}</span>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(deal.url, '_blank')}
                      className="w-full flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                      View Deal
                    </Button>
                  </div>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>

        {!isLoading && deals.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>No live deals at the moment. Try again shortly.</p>
          </div>
        )}
      </div>
    </section>
  );
}


