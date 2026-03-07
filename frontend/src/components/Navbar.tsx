import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Menu, X } from "lucide-react";
import { triggerAnalysisFromDraft } from "@/lib/analysisCommand";

const navItems = [
  { label: "Home", href: "/" },
  { label: "Analytics", href: "/analytics" },
  { label: "Maps", href: "/maps" },
  { label: "AI Insights", href: "/insights" },
  { label: "Simulation", href: "/simulation" },
  { label: "About", href: "/about" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const onStartAnalysis = () => {
    triggerAnalysisFromDraft();
    if (location.pathname !== "/analytics") navigate("/analytics");
  };

  return (
    <div
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-5xl transition-all duration-300 ${
        scrolled ? "top-2" : "top-4"
      }`}
    >
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full"
      >
      <nav className="floating-nav rounded-full px-4 py-2.5 flex items-center justify-between relative">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
            <Globe className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-bold text-sm text-foreground hidden sm:block">GeoAI Urban Intelligence</span>
        </Link>

        <div className="hidden md:flex items-center gap-1 bg-muted rounded-full px-1.5 py-1 absolute left-1/2 -translate-x-1/2 whitespace-nowrap">
          {navItems.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`relative px-3.5 py-1.5 text-sm font-medium rounded-full transition-all duration-200 whitespace-nowrap ${
                  active
                    ? "text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && (
                  <motion.div
                    layoutId="nav-pill"
                    className="absolute inset-0 bg-primary rounded-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 whitespace-nowrap">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onStartAnalysis}
            className="hidden sm:inline-flex items-center gap-2 bg-cta text-cta-foreground px-4 py-2 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            Start Analysis
            <span className="text-xs">-&gt;</span>
          </button>
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden p-2 rounded-full hover:bg-muted transition-colors"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="md:hidden mt-2 floating-nav rounded-2xl p-4 space-y-1"
          >
            {navItems.map((item) => (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`block px-4 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  location.pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                {item.label}
              </Link>
            ))}
            <button
              onClick={() => {
                setMobileOpen(false);
                onStartAnalysis();
              }}
              className="block w-full text-center bg-cta text-cta-foreground px-4 py-2.5 rounded-xl text-sm font-semibold mt-2"
            >
              Start Analysis -&gt;
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      </motion.header>
    </div>
  );
}
