import React from 'react';
import { motion } from 'framer-motion';
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Target,
  TrendingUp,
  MessageCircle,
  Gift,
  CreditCard,
  Calendar,
  ArrowRight,
  Sparkles
} from "lucide-react";

const aiAgents = [
  {
    name: "Deal Hunter",
    description: "AI that scours the web 24/7 to find personalized deals matching your preferences and budget",
    icon: Target,
    color: "from-emerald-500 to-green-600",
    url: "DealHunter",
    features: ["Real-time price monitoring", "Personalized recommendations", "Deal quality scoring"]
  },
  {
    name: "Price Tracker",
    description: "Monitor price changes across thousands of retailers with predictive analytics",
    icon: TrendingUp,
    color: "from-blue-500 to-cyan-600", 
    url: "PriceTracker",
    features: ["Price history analysis", "Drop predictions", "Best buy timing"]
  },
  {
    name: "Concierge Chat",
    description: "Your personal shopping assistant available 24/7 via voice or text",
    icon: MessageCircle,
    color: "from-purple-500 to-indigo-600",
    url: "Chat", 
    features: ["Natural conversation", "Voice commands", "Context awareness"]
  },
  {
    name: "Gift Planner",
    description: "Never forget important dates with AI-curated gift suggestions for everyone",
    icon: Gift,
    color: "from-pink-500 to-rose-600",
    url: "GiftPlanner",
    features: ["Occasion reminders", "Personalized suggestions", "Budget optimization"]
  },
  {
    name: "Spending Tracker",
    description: "A tool that helps you track your spending and save money",
    icon: CreditCard,
    color: "from-orange-500 to-amber-600",
    url: "BudgetAdvisor", 
    features: ["Spending analysis", "Budget optimization", "Savings goals"]
  },
  {
    name: "Budget Analyzer",
    description: "Smart spending insights and recommendations to optimize your shopping budget",
    icon: Calendar,
    color: "from-violet-500 to-purple-600",
    url: "Subscriptions",
    features: ["Auto-renewal management", "Cost optimization", "Usage tracking"]
  }
];

export default function AIAgentsSection() {
  return (
    <section className="py-24 px-6 relative overflow-hidden">
      {/* subtle background gradient blobs */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-24 -left-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-30 bg-gradient-to-br from-indigo-200 to-purple-200" />
        <div className="absolute -bottom-24 -right-24 w-[420px] h-[420px] rounded-full blur-3xl opacity-30 bg-gradient-to-br from-emerald-200 to-cyan-200" />
      </div>
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="w-6 h-6 text-indigo-600" />
            <span className="text-indigo-600 font-semibold">AI Agents</span>
          </div>
          <h2 className="text-5xl font-light text-gray-900 mb-6">
            Your personal
            <span className="font-medium"> shopping team</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Each AI agent specializes in different aspects of your shopping journey, 
            working together to save you time and money.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {aiAgents.map((agent, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              viewport={{ once: true }}
              className="group"
            >
              <div className="rounded-3xl p-8 h-full border border-gray-100 backdrop-blur-md bg-white/70 hover:bg-white/90 shadow-sm hover:shadow-xl transition-all duration-300">
                <div className={`w-16 h-16 bg-gradient-to-r ${agent.color} rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <agent.icon className="w-8 h-8 text-white" />
                </div>
                
                <h3 className="text-2xl font-semibold text-gray-900 mb-4">
                  {agent.name}
                </h3>
                
                <p className="text-gray-600 leading-relaxed mb-6">
                  {agent.description}
                </p>

                <ul className="space-y-2 mb-8">
                  {agent.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-gray-600">
                      <div className="w-1.5 h-1.5 bg-indigo-600/80 group-hover:bg-indigo-600 rounded-full"></div>
                      {feature}
                    </li>
                  ))}
                </ul>

                <Link to={createPageUrl(agent.url)}>
                  <Button 
                    variant="outline" 
                    className="w-full rounded-2xl group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all duration-300"
                  >
                    Try {agent.name}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <Link to={createPageUrl("Dashboard")}>
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-3xl shadow-lg">
              Access Full Dashboard
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  );
}