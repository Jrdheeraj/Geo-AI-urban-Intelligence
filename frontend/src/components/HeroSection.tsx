import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, Map } from "lucide-react";
import { triggerAnalysisFromDraft } from "@/lib/analysisCommand";

export default function HeroSection() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const ensurePlayback = async () => {
      try {
        video.muted = true;
        await video.play();
      } catch {
        // Browser may block initial autoplay; retry after user interaction.
      }
    };

    void ensurePlayback();

    const retryPlayback = () => void ensurePlayback();
    window.addEventListener("click", retryPlayback, { once: true });
    window.addEventListener("touchstart", retryPlayback, { once: true });

    return () => {
      window.removeEventListener("click", retryPlayback);
      window.removeEventListener("touchstart", retryPlayback);
    };
  }, []);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Video background */}
      <div className="absolute inset-0 z-0">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          className="w-full h-full object-cover"
          style={{ willChange: "transform" }}
        >
          <source src="/videos/earth-rotating.mp4" type="video/mp4" />
        </video>
        <div className="absolute inset-0 bg-black/25" />
      </div>

      {/* Content */}
      <div className="relative z-10 text-center px-4 max-w-4xl mx-auto pt-20">
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="text-4xl sm:text-5xl md:text-[56px] font-bold leading-tight tracking-tight text-white mb-6"
        >
          GeoAI Urban Growth
          <br />
          <span className="text-white">Intelligence Platform</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="text-lg md:text-xl text-white max-w-2xl mx-auto mb-10 leading-relaxed"
        >
          Monitor land-use change, detect urban expansion, and simulate future
          development using satellite imagery and machine learning.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4"
        >
          <a
            href="#analytics"
            onClick={(e) => {
              e.preventDefault();
              triggerAnalysisFromDraft();
              const el = document.getElementById("analytics");
              if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
              window.history.pushState(null, "", "#analytics");
            }}
            className="inline-flex items-center gap-2 bg-cta text-cta-foreground px-7 py-3.5 rounded-full text-base font-semibold hover:opacity-90 transition-opacity"
          >
            Start Analysis
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="#maps"
            onClick={(e) => {
              e.preventDefault();
              const el = document.getElementById("maps");
              if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
              window.history.pushState(null, "", "#maps");
            }}
            className="inline-flex items-center gap-2 bg-card/80 backdrop-blur-sm border border-border text-foreground px-7 py-3.5 rounded-full text-base font-semibold hover:bg-card transition-colors"
          >
            <Map className="w-4 h-4" />
            Explore Maps
          </a>
        </motion.div>
      </div>
    </section>
  );
}
