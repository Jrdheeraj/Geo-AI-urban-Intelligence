import HeroSection from "@/components/HeroSection";
import FeaturesSection from "@/components/FeaturesSection";
import AchievementsSection from "@/components/AchievementsSection";
import Footer from "@/components/Footer";
import MapsPage from "./MapsPage";
import AnalyticsPage from "./AnalyticsPage";
import InsightsPage from "./InsightsPage";
import SimulationPage from "./SimulationPage";
import AboutPage from "./AboutPage";

export default function Index() {
  return (
    <main className="overflow-x-hidden">
      <div className="print:hidden">
        <HeroSection />
        <FeaturesSection />
      </div>
      <AnalyticsPage />
      <div className="print:hidden">
        <MapsPage />
        <InsightsPage />
        <SimulationPage />
        <AboutPage />
        <AchievementsSection />
        <Footer />
      </div>
    </main>
  );
}
