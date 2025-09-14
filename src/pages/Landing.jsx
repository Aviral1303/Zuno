import React from "react";
import HeroSection from "../components/landing/HeroSection";
import AIAgentsSection from "../components/landing/AIAgentsSection";
import FeatureCarousel from "../components/landing/FeatureCarousel";
import TrustSection from "../components/landing/TrustSection";
import HomeDeals from "../components/landing/HomeDeals";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <AIAgentsSection />
      <FeatureCarousel />
      <HomeDeals />
      <TrustSection />
    </div>
  );
}