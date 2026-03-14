import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Globe, 
  Menu, 
  X, 
  Home, 
  BarChart3, 
  Map as MapIcon, 
  Brain, 
  Zap, 
  Info,
  ArrowRight
} from "lucide-react";
import { triggerAnalysisFromDraft } from "@/lib/analysisCommand";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "Home", href: "/", icon: Home },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Maps", href: "/maps", icon: MapIcon },
  { label: "AI Insights", href: "/insights", icon: Brain },
  { label: "Simulation", href: "/simulation", icon: Zap },
  { label: "About", href: "/about", icon: Info },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
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
      className={cn(
        "fixed top-4 left-1/2 -translate-x-1/2 z-50 w-[95%] max-w-6xl transition-all duration-300",
        scrolled ? "top-2" : "top-4"
      )}
    >
      <motion.header
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full"
      >
        <nav className="rounded-full px-4 py-2 flex items-center justify-between relative bg-background/70 backdrop-blur-xl border border-white/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] font-['Inter']">
          {/* Logo Section */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0 group">
            <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center transition-all group-hover:scale-110 group-hover:shadow-[0_0_15px_rgba(var(--primary),0.5)]">
              <Globe className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-bold text-[15px] text-foreground hidden sm:block tracking-tight">GeoAI Tirupati</span>
          </Link>

          {/* Desktop/Tablet Navigation */}
          <div className="hidden lg:flex items-center absolute left-1/2 -translate-x-1/2">
            <NavigationMenu>
              <NavigationMenuList className="gap-1">
                {navItems.map((item) => {
                  const active = location.pathname === item.href;
                  return (
                    <NavigationMenuItem key={item.href}>
                      <Link to={item.href}>
                        <NavigationMenuLink
                          className={cn(
                            navigationMenuTriggerStyle(),
                            "h-10 px-4 rounded-full bg-transparent transition-all duration-300 flex items-center gap-2 group",
                            active 
                              ? "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground shadow-md" 
                              : "text-muted-foreground hover:bg-white/10 hover:text-foreground"
                          )}
                        >
                          <item.icon className={cn("w-4 h-4", active ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary")} />
                          <span className="font-medium">{item.label}</span>
                        </NavigationMenuLink>
                      </Link>
                    </NavigationMenuItem>
                  );
                })}
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Desktop/Tablet CTA + Mobile Menu Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={onStartAnalysis}
              className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-full text-sm font-semibold hover:shadow-lg active:scale-95 transition-all group"
            >
              Start Analysis
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>

            {/* Mobile/Tablet Menu Button - Visible only for Mobile/Tablet users */}
            <div className="lg:hidden">
              <Sheet>
                <SheetTrigger asChild>
                  <button className="flex items-center gap-2 bg-muted/50 backdrop-blur-md px-5 py-2.5 rounded-full border border-border/50 hover:bg-muted/80 transition-all active:scale-95 shadow-sm group">
                    <Menu className="w-5 h-5 text-foreground/80 group-hover:text-foreground transition-colors" />
                    <span className="text-sm font-bold text-foreground/80 group-hover:text-foreground tracking-wide uppercase transition-colors">Menu</span>
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[300px] sm:w-[350px] bg-background/95 backdrop-blur-xl border-l border-white/10">
                  <SheetHeader className="text-left mb-8">
                    <SheetTitle className="flex items-center gap-2">
                       <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                        <Globe className="w-4 h-4 text-primary-foreground" />
                      </div>
                      <span className="font-bold">GeoAI Navigation</span>
                    </SheetTitle>
                  </SheetHeader>
                  <div className="flex flex-col gap-2">
                    {navItems.map((item) => {
                      const active = location.pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          to={item.href}
                          className={cn(
                            "flex items-center gap-3 px-4 py-3.5 rounded-2xl text-[15px] font-medium transition-all",
                            active
                              ? "bg-primary text-primary-foreground shadow-lg"
                              : "text-muted-foreground hover:bg-white/5 hover:text-foreground border border-transparent hover:border-white/10"
                          )}
                        >
                          <item.icon className={cn("w-5 h-5", active ? "text-primary-foreground" : "text-muted-foreground")} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                  <div className="mt-auto pt-8 border-t border-white/10 mt-8">
                    <button
                      onClick={onStartAnalysis}
                      className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-4 rounded-2xl font-bold shadow-xl active:scale-95 transition-all"
                    >
                      Start New Analysis
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </nav>
      </motion.header>
    </div>
  );
}
