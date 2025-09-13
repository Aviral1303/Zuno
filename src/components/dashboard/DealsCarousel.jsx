import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Heart,
  Share,
  Clock,
  Star,
  ShoppingCart,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const deals = [
  {
    id: 1,
    product_name: "MacBook Pro 14-inch",
    retailer: "Apple Store",
    original_price: 1999,
    discounted_price: 1599,
    discount_percentage: 20,
    category: "electronics",
    image_url: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=300&fit=crop",
    ai_recommendation_score: 95,
    expires_in: "2 days"
  },
  {
    id: 2,
    product_name: "Nike Air Max 90",
    retailer: "Nike",
    original_price: 120,
    discounted_price: 84,
    discount_percentage: 30,
    category: "fashion",
    image_url: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&h=300&fit=crop",
    ai_recommendation_score: 88,
    expires_in: "5 hours"
  },
  {
    id: 3,
    product_name: "Dyson V15 Detect",
    retailer: "Best Buy",
    original_price: 749,
    discounted_price: 549,
    discount_percentage: 27,
    category: "home",
    image_url: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop",
    ai_recommendation_score: 92,
    expires_in: "1 day"
  }
];

export default function DealsCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);

  const nextDeal = () => {
    setCurrentIndex((prev) => (prev + 1) % deals.length);
  };

  const prevDeal = () => {
    setCurrentIndex((prev) => (prev - 1 + deals.length) % deals.length);
  };

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-3xl p-6 border border-white/10">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-white">AI Curated Deals</h3>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={prevDeal}
            className="text-white hover:bg-white/10 rounded-xl"
          >
            <ChevronLeft className="w-5 h-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={nextDeal}
            className="text-white hover:bg-white/10 rounded-xl"
          >
            <ChevronRight className="w-5 h-5" />
          </Button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-2xl">
        <motion.div
          key={currentIndex}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
        >
          <DealCard deal={deals[currentIndex]} />
        </motion.div>
      </div>

      <div className="flex justify-center space-x-2 mt-4">
        {deals.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-2 h-2 rounded-full transition-all duration-300 ${
              index === currentIndex ? 'bg-purple-500 w-6' : 'bg-white/30'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

function DealCard({ deal }) {
  const savings = deal.original_price - deal.discounted_price;

  return (
    <div className="bg-white/10 rounded-2xl p-6 relative overflow-hidden">
      {/* AI Score Badge */}
      <div className="absolute top-4 right-4 z-10">
        <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white border-none">
          <Star className="w-3 h-3 mr-1" />
          {deal.ai_recommendation_score}% Match
        </Badge>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        <div className="md:w-1/3">
          <img
            src={deal.image_url}
            alt={deal.product_name}
            className="w-full h-48 md:h-32 object-cover rounded-xl"
          />
        </div>

        <div className="md:w-2/3">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h4 className="text-xl font-bold text-white mb-2">
                {deal.product_name}
              </h4>
              <p className="text-white/70">{deal.retailer}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mb-4">
            <div className="text-2xl font-bold text-white">
              ${deal.discounted_price}
            </div>
            <div className="text-white/60 line-through">
              ${deal.original_price}
            </div>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
              {deal.discount_percentage}% OFF
            </Badge>
          </div>

          <div className="flex items-center gap-4 mb-6">
            <div className="text-green-400 font-semibold">
              Save ${savings}
            </div>
            <div className="flex items-center gap-1 text-orange-400">
              <Clock className="w-4 h-4" />
              <span className="text-sm">Expires in {deal.expires_in}</span>
            </div>
          </div>

          <div className="flex gap-3">
            <Button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white flex-1">
              <ShoppingCart className="w-4 h-4 mr-2" />
              Add to Cart
            </Button>
            <Button variant="outline" size="icon" className="border-white/20 text-white hover:bg-white/10">
              <Heart className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="border-white/20 text-white hover:bg-white/10">
              <Share className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}