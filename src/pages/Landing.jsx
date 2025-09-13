import React from "react";
import HeroSection from "../components/landing/HeroSection";
import AIAgentsSection from "../components/landing/AIAgentsSection";
import FeatureCarousel from "../components/landing/FeatureCarousel";
import TrustSection from "../components/landing/TrustSection";

export default function Landing() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <AIAgentsSection />
      <FeatureCarousel />
      <TrustSection />
    </div>
  );
}