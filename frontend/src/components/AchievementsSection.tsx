import { motion } from "framer-motion";

const achievements = [
  { value: "2", label: "Cities Analyzed" },
  { value: "5+", label: "LULC Classes" },
  { value: "10yr", label: "Temporal Coverage" },
  { value: "95%+", label: "Classification Accuracy" },
];

export default function AchievementsSection() {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card p-10 md:p-14"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-foreground text-center mb-12">
            Platform at a Glance
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {achievements.map((a, i) => (
              <motion.div
                key={a.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-3xl md:text-4xl font-bold text-primary">{a.value}</p>
                <p className="text-sm text-muted-foreground mt-2">{a.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
