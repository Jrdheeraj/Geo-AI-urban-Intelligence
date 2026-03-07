import { motion } from "framer-motion";
import { Play, TreePine, Shield, TrendingUp } from "lucide-react";
import { Link } from "react-router-dom";

const scenarios = [
  {
    icon: TrendingUp,
    title: "Trend-based Growth",
    description: "Continue current urbanization patterns based on historical transition probabilities.",
    tag: "Default",
  },
  {
    icon: TreePine,
    title: "Agriculture Protection",
    description: "Restrict conversion of agricultural land while allowing growth in barren areas.",
    tag: "Conservation",
  },
  {
    icon: Shield,
    title: "Green Zone Enforcement",
    description: "Enforce strict buffer zones around forests and water bodies.",
    tag: "Eco-Friendly",
  },
];

export default function SimulationPreview() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Simulation</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Predict Future Urban Growth
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Run simulations under different policy scenarios to plan sustainable development.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {scenarios.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.15 }}
              className="glass-card-hover p-6 flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <s.icon className="w-5 h-5 text-primary" />
                </div>
                <span className="text-xs font-medium bg-muted text-muted-foreground px-2.5 py-1 rounded-full">
                  {s.tag}
                </span>
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed flex-1">{s.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="text-center mt-10"
        >
          <Link
            to="/simulation"
            className="inline-flex items-center gap-2 bg-cta text-cta-foreground px-6 py-3 rounded-full text-sm font-semibold hover:opacity-90 transition-opacity"
          >
            <Play className="w-4 h-4" />
            Run Simulation
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
