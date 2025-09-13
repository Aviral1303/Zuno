import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ExternalLink,
  Clock,
  Star,
  ArrowRight
} from 'lucide-react';

const featuredDeals = [
  {
    id: 1,
    brand: "Apple",
    product: "MacBook Pro 14\"",
    originalPrice: 1999,
    currentPrice: 1599,
    discount: 20,
    timeLeft: "2d left",
    image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300&h=200&fit=crop",
    quality: 95
  },
  {
    id: 2,
    brand: "Nike",
    product: "Air Max 90",
    originalPrice: 120,
    currentPrice: 84,
    discount: 30,
    timeLeft: "5h left",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=300&h=200&fit=crop",
    quality: 88
  }
];

export default function MinimalDealsSection() {
  return (
    <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-light text-gray-900">Curated for you</h2>
          <p className="text-gray-500 text-sm">Personalized deal recommendations</p>
        </div>
        <Button variant="ghost" className="text-gray-600 hover:text-gray-900">
          View all
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>

      <div className="space-y-6">
        {featuredDeals.map((deal, index) => (
          <motion.div
            key={deal.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: index * 0.1 }}
            className="flex items-center gap-6 p-4 hover:bg-gray-50 rounded-2xl transition-colors duration-200"
          >
            <img
              src={deal.image}
              alt={deal.product}
              className="w-20 h-20 object-cover rounded-xl"
            />
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">
                    {deal.brand}
                  </p>
                  <h3 className="font-medium text-gray-900">
                    {deal.product}
                  </h3>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold text-gray-900">
                    ${deal.currentPrice}
                  </div>
                  <div className="text-sm text-gray-500 line-through">
                    ${deal.originalPrice}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Badge variant="secondary" className="bg-emerald-100 text-emerald-700 border-0">
                    {deal.discount}% off
                  </Badge>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Clock className="w-3 h-3" />
                    {deal.timeLeft}
                  </span>
                  <span className="flex items-center gap-1 text-xs text-gray-500">
                    <Star className="w-3 h-3" />
                    {deal.quality}% match
                  </span>
                </div>
                <Button size="sm" variant="ghost" className="text-gray-600 hover:text-gray-900">
                  <ExternalLink className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}