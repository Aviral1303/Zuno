import React from "react";
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { 
  Home, 
  MessageCircle, 
  BarChart3, 
  UserCircle, 
  Target,
  TrendingUp,
  Gift,
  Calendar,
  CreditCard,
  Search
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

// Import all pages
import Landing from "./pages/Landing";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import DealHunter from "./pages/DealHunter";
import PriceTracker from "./pages/PriceTracker";
import GiftPlanner from "./pages/GiftPlanner";
import BudgetAdvisor from "./pages/BudgetAdvisor";
import Subscriptions from "./pages/Subscriptions";

const navigationItems = [
  {
    title: "Home",
    url: createPageUrl("Landing"),
    icon: Home,
  },
  {
    title: "Dashboard", 
    url: createPageUrl("Dashboard"),
    icon: BarChart3,
  },
  {
    title: "Profile",
    url: createPageUrl("Profile"),
    icon: UserCircle,
  }
];

const aiAgents = [
  {
    title: "Deal Hunter",
    url: createPageUrl("DealHunter"),
    icon: Target,
    description: "Find personalized deals"
  },
  {
    title: "Price Tracker",
    url: createPageUrl("PriceTracker"),
    icon: TrendingUp,
    description: "Monitor price changes"
  },
  {
    title: "Concierge Chat",
    url: createPageUrl("Chat"),
    icon: MessageCircle,
    description: "AI shopping assistant"
  },
  {
    title: "Gift Planner",
    url: createPageUrl("GiftPlanner"),
    icon: Gift,
    description: "Smart gift recommendations"
  },
  {
    title: "Spending Tracker",
    url: createPageUrl("BudgetAdvisor"),
    icon: CreditCard,
    description: "Spending insights"
  },
  {
    title: "Budget Analyzer",
    url: createPageUrl("Subscriptions"),
    icon: Calendar,
    description: "Manage recurring payments"
  }
];

// Layout component that wraps pages with sidebar
function Layout({ children }) {
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  if (isLandingPage) {
    return children;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-100">
      <style>
        {`
          :root {
            --background: 0 0% 98%;
            --foreground: 0 0% 12%;
            --primary: 262 83% 58%;
            --primary-foreground: 210 40% 98%;
            --secondary: 210 40% 96%;
            --secondary-foreground: 222.2 84% 4.9%;
            --muted: 210 40% 96%;
            --muted-foreground: 215.4 16.3% 46.9%;
            --accent: 210 40% 96%;
            --accent-foreground: 222.2 84% 4.9%;
            --border: 214.3 31.8% 91.4%;
            --input: 214.3 31.8% 91.4%;
            --ring: 262 83% 58%;
            --radius: 0.75rem;
          }
          
          .glass-nav {
            backdrop-filter: blur(20px);
            background: rgba(255, 255, 255, 0.95);
            border: 1px solid rgba(0, 0, 0, 0.08);
          }
        `}
      </style>
      
      <SidebarProvider>
        <div className="flex min-h-screen w-full">
          <Sidebar className="border-r border-gray-200/60 glass-nav shadow-lg w-72">
            <SidebarHeader className="border-b border-gray-200/60 p-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-white font-bold text-lg">Z</span>
                </div>
                <div>
                  <h2 className="font-bold text-gray-900 text-lg">Zuno</h2>
                  <p className="text-xs text-gray-500">AI Shopping Intelligence</p>
                </div>
              </div>
            </SidebarHeader>
            
            <SidebarContent className="p-4">
              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
                  Navigation
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {navigationItems.map((item) => (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton 
                          asChild 
                          className={`mb-2 rounded-2xl transition-all duration-300 ${
                            location.pathname === item.url 
                              ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30 hover:bg-indigo-700' 
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <Link to={item.url} className="flex items-center gap-3 px-4 py-3">
                            <item.icon className="w-5 h-5" />
                            <span className="font-medium">{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-2 mb-2">
                  AI Agents
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {aiAgents.map((agent) => (
                      <SidebarMenuItem key={agent.title}>
                        <SidebarMenuButton 
                          asChild 
                          className={`mb-2 rounded-2xl transition-all duration-300 ${
                            location.pathname === agent.url 
                              ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 hover:bg-purple-700' 
                              : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                          }`}
                        >
                          <Link to={agent.url} className="flex items-start gap-3 px-4 py-3">
                            <agent.icon className="w-5 h-5 mt-0.5" />
                            <div>
                              <span className="font-medium text-sm">{agent.title}</span>
                              <p className="text-xs opacity-70">{agent.description}</p>
                            </div>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>
          </Sidebar>

          <main className="flex-1 flex flex-col">
            <div className="flex-1 overflow-auto">
              {children}
            </div>
          </main>
        </div>
      </SidebarProvider>
    </div>
  );
}

// Main App component with routing
export default function App() {
  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/deal-hunter" element={<DealHunter />} />
          <Route path="/price-tracker" element={<PriceTracker />} />
          <Route path="/gift-planner" element={<GiftPlanner />} />
          <Route path="/budget-advisor" element={<BudgetAdvisor />} />
          <Route path="/subscriptions" element={<Subscriptions />} />
        </Routes>
      </Layout>
    </Router>
  );
}