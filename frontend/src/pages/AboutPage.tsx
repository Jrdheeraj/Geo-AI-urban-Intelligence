import { motion } from "framer-motion";
import { Globe, Code, Database, Satellite } from "lucide-react";
import Footer from "@/components/Footer";

const techStack = [
  { icon: Code, label: "React + TypeScript", desc: "Modern frontend framework" },
  { icon: Database, label: "FastAPI Backend", desc: "High-performance Python API" },
  { icon: Satellite, label: "Satellite Imagery", desc: "Multi-temporal remote sensing" },
  { icon: Globe, label: "Leaflet Maps", desc: "Interactive geospatial visualization" },
];

export default function AboutPage() {
  return (
    <main className="pt-24 pb-0 min-h-screen">
      <div className="max-w-4xl mx-auto px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <h1 className="text-4xl font-bold text-foreground mb-4">About GeoAI Platform</h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            A comprehensive urban intelligence platform that leverages satellite imagery and machine learning
            to monitor, analyze, and predict urban growth patterns for sustainable city planning.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5 mb-16">
          {techStack.map((t, i) => (
            <motion.div
              key={t.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="glass-card-hover p-6"
            >
              <t.icon className="w-6 h-6 text-primary mb-3" />
              <h3 className="font-semibold text-foreground mb-1">{t.label}</h3>
              <p className="text-sm text-muted-foreground">{t.desc}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-8 text-center mb-12"
        >
          <h2 className="text-2xl font-bold text-foreground mb-3">Supported Cities</h2>
          <p className="text-muted-foreground mb-6">Currently analyzing urban growth in two key cities of Andhra Pradesh.</p>
          <div className="flex items-center justify-center gap-4">
            <span className="bg-primary/10 text-primary px-5 py-2 rounded-full font-semibold">Tirupati</span>
            <span className="bg-primary/10 text-primary px-5 py-2 rounded-full font-semibold">Madanapalle</span>
          </div>
        </motion.div>
      </div>
      <Footer />
    </main>
  );
}
