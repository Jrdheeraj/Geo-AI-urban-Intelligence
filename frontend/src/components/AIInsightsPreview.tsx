import { motion } from "framer-motion";
import { AlertTriangle, Lightbulb, TrendingDown, Shield, Workflow, Leaf } from "lucide-react";

const insights = [
  {
    icon: AlertTriangle,
    title: "Critical Forest Loss",
    description: "3.6% of forest cover transitioned to built-up areas between 2018-2023, primarily in the northern corridor.",
    severity: "high" as const,
  },
  {
    icon: TrendingDown,
    title: "Water Body Reduction",
    description: "Lake area decreased by 12 hectares due to encroachment. Immediate intervention recommended.",
    severity: "high" as const,
  },
  {
    icon: Lightbulb,
    title: "Smart Growth Corridor",
    description: "Eastern agricultural belt shows ideal conditions for planned urban expansion with minimal ecological impact.",
    severity: "medium" as const,
  },
  {
    icon: Shield,
    title: "Green Zone Enforcement",
    description: "Implementing buffer zones around forest boundaries could prevent 68% of projected deforestation.",
    severity: "low" as const,
  },
  {
    icon: Workflow,
    title: "Inefficient Processes",
    description: "Manual monitoring workflows slow planning cycles and delay policy interventions.",
    severity: "high" as const,
  },
  {
    icon: Leaf,
    title: "Restoration Opportunity",
    description: "Degraded barren patches show high potential for ecological restoration programs.",
    severity: "medium" as const,
  },
];

const severityChip = {
  high: "Problem",
  medium: "Watch",
  low: "Solution",
};

const severityChipStyle = {
  high: "bg-red-100 text-red-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-emerald-100 text-emerald-700",
};

export default function AIInsightsPreview() {
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
          <span className="text-sm font-semibold text-primary uppercase tracking-wider">AI Insights</span>
          <h2 className="text-3xl md:text-4xl font-bold text-foreground mt-3 mb-4">
            Intelligent Risk Assessment
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            ML-driven insights to guide urban planning decisions and protect natural resources.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5 items-stretch">
          {insights.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="glass-card p-0 overflow-hidden rounded-[24px] h-[470px] flex flex-col border border-border/90"
            >
              <div className="h-[180px] bg-muted border-b border-border flex items-center justify-center relative shrink-0">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.7),transparent_40%),radial-gradient(circle_at_80%_80%,rgba(17,24,39,0.06),transparent_45%)]" />
                <item.icon className="relative w-14 h-14 text-foreground/75" />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <span
                  className={`inline-flex w-fit text-xs font-semibold px-3 py-1 rounded-full mb-4 ${severityChipStyle[item.severity]}`}
                >
                  {severityChip[item.severity]}
                </span>
                <h3 className="text-[34px] font-semibold text-foreground mb-3 leading-tight min-h-[80px]">
                  {item.title}
                </h3>
                <p className="text-muted-foreground text-[17px] leading-relaxed min-h-[126px]">
                  {item.description}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
