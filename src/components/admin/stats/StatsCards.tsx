import { Users, Zap, MapPin } from "lucide-react";
import { motion } from "framer-motion";

interface StatsCardsProps {
  totalLeads: number;
  totalKwh: number;
  uniqueEstados: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

export function StatsCards({ totalLeads, totalKwh, uniqueEstados }: StatsCardsProps) {
  const stats = [
    {
      label: "Total de Leads",
      value: totalLeads.toLocaleString(),
      icon: Users,
      accentFrom: "from-primary",
      accentTo: "to-primary-glow",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
      borderColor: "border-primary/20",
    },
    {
      label: "kWh Total",
      value: totalKwh.toLocaleString(),
      icon: Zap,
      accentFrom: "from-success",
      accentTo: "to-success/70",
      iconBg: "bg-success/10",
      iconColor: "text-success",
      borderColor: "border-success/20",
    },
    {
      label: "Estados",
      value: uniqueEstados.toString(),
      icon: MapPin,
      accentFrom: "from-secondary",
      accentTo: "to-secondary-glow",
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
      borderColor: "border-secondary/20",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          custom={i}
          initial="hidden"
          animate="visible"
          variants={cardVariants}
          className={`group relative overflow-hidden rounded-xl border-2 bg-card p-5 transition-all duration-200 ease-out hover:border-border/80 ${stat.borderColor}`}
          style={{ boxShadow: "var(--shadow-sm)" }}
          onMouseEnter={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-md)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.boxShadow = "var(--shadow-sm)"; e.currentTarget.style.transform = "translateY(0)"; }}
        >

          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stat.iconBg}`}>
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
            
          </div>
        </motion.div>
      ))}
    </div>
  );
}
