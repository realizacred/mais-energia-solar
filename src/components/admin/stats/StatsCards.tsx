import { Users, Zap, MapPin, TrendingUp, ArrowUpRight } from "lucide-react";
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
          className={`group relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${stat.borderColor}`}
        >
          {/* Top accent bar */}
          <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.accentFrom} ${stat.accentTo} rounded-t-2xl`} />

          {/* Decorative glow */}
          <div className={`absolute -top-8 -right-8 w-24 h-24 ${stat.iconBg} rounded-full blur-2xl opacity-0 group-hover:opacity-60 transition-opacity duration-500`} />

          <div className="relative flex items-center gap-4">
            <div className={`stat-card-icon ${stat.iconBg}`}>
              <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
                {stat.value}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground/60 transition-colors" />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
