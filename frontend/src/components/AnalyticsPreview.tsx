import { motion } from "framer-motion";
import { TrendingUp, TreePine, Droplets, Building2, Wheat } from "lucide-react";

const stats = [
  { label: "Forest Coverage", value: "34.2%", change: "-2.1%", icon: TreePine, color: "text-green-500" },
  { label: "Water Bodies", value: "8.7%", change: "-0.3%", icon: Droplets, color: "text-foreground" },
  { label: "Built-up Area", value: "28.5%", change: "+4.8%", icon: Building2, color: "text-red-500" },
  { label: "Agriculture", value: "22.1%", change: "-1.9%", icon: Wheat, color: "text-yellow-500" },
];

export default function AnalyticsPreview() {
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
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">Analytics</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Real-time Urban Metrics
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Track land-use changes across multiple years with detailed statistical analysis.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  stat.change.startsWith("+")
                    ? "bg-red-50 text-red-600"
                    : "bg-green-50 text-green-600"
                }`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stat.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
            </motion.div>
          ))}
        </div>

        {/* Transition matrix preview */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 glass-card p-6 md:p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-semibold text-foreground">Transition Matrix Preview</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="text-left py-2 px-3 text-muted-foreground font-medium">From \ To</th>
                  {["Forest", "Water", "Agriculture", "Barren", "Built-up"].map((c) => (
                    <th key={c} className="py-2 px-3 text-muted-foreground font-medium text-center">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  ["Forest", "92.1", "0.3", "2.8", "1.2", "3.6"],
                  ["Water", "0.5", "95.2", "1.1", "0.8", "2.4"],
                  ["Agriculture", "1.2", "0.4", "88.5", "3.1", "6.8"],
                  ["Barren", "0.8", "0.2", "2.4", "85.3", "11.3"],
                  ["Built-up", "0.1", "0.1", "0.3", "0.5", "99.0"],
                ].map((row) => (
                  <tr key={row[0]} className="border-t border-border">
                    <td className="py-2.5 px-3 font-medium text-foreground">{row[0]}</td>
                    {row.slice(1).map((val, j) => {
                      const n = parseFloat(val);
                      const intensity = n > 90 ? "bg-primary/20" : n > 5 ? "bg-destructive/15" : n > 2 ? "bg-yellow-100" : "";
                      return (
                        <td key={j} className={`py-2.5 px-3 text-center text-foreground ${intensity} rounded`}>
                          {val}%
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
