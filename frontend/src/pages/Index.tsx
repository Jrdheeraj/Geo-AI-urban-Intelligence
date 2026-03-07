import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import AnalyticsPreview from "@/components/AnalyticsPreview";
import AIInsightsPreview from "@/components/AIInsightsPreview";
import SimulationPreview from "@/components/SimulationPreview";
import AchievementsSection from "@/components/AchievementsSection";
import Footer from "@/components/Footer";

export default function Index() {
  return (
    <main>
      <HeroSection />
      <FeaturesSection />
      <AnalyticsPreview />
      <AIInsightsPreview />
      <SimulationPreview />
      <AchievementsSection />
      <Footer />
    </main>
  );
}
