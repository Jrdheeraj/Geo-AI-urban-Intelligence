import { motion } from "framer-motion";
import { Satellite, BarChart3, Brain, Layers, Shield, Zap } from "lucide-react";

const features = [
  {
    icon: Satellite,
    title: "Satellite Imagery Analysis",
    description: "Process multi-temporal satellite data to track urban expansion with pixel-level accuracy.",
  },
  {
    icon: Layers,
    title: "Land Use Classification",
    description: "AI-powered LULC mapping across 5 categories: Forest, Water, Agriculture, Barren, Built-up.",
  },
  {
    icon: BarChart3,
    title: "Change Detection",
    description: "Quantify land-use transitions with detailed matrices and percentage breakdowns.",
  },
  {
    icon: Brain,
    title: "AI-Powered Insights",
    description: "Get intelligent recommendations and risk assessments for urban planning decisions.",
  },
  {
    icon: Shield,
    title: "Risk Assessment",
    description: "Identify critical transitions like forest-to-urban and water body loss with alert systems.",
  },
  {
    icon: Zap,
    title: "Future Simulation",
    description: "Project urban growth under multiple scenarios including green zone enforcement.",
  },
];

export default function FeaturesSection() {
  return (
    <section className="py-24 px-4 dotted-grid">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Features</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Complete Urban Intelligence Suite
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to analyze, monitor, and predict urban growth patterns.
          </p>
        </motion.div>

        <div className="border-y border-dashed border-border py-12">
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-x-10 gap-y-16">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="text-center max-w-sm mx-auto"
            >
              <f.icon className="w-14 h-14 text-foreground mx-auto mb-5" />
              <h3 className="text-2xl font-semibold text-foreground mb-3 leading-tight">{f.title}</h3>
              <p className="text-muted-foreground text-base leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
          </div>
        </div>
      </div>
    </section>
  );
}
