import { Users, Zap, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardsProps {
  totalLeads: number;
  totalKwh: number;
  uniqueEstados: number;
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  }),
};

export function StatsCards({ totalLeads, totalKwh, uniqueEstados }: StatsCardsProps) {
  const stats = [
    {
      label: "Total de Leads",
      value: totalLeads.toLocaleString(),
      icon: Users,
      borderColor: "border-l-primary",
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: "kWh Total",
      value: totalKwh.toLocaleString(),
      icon: Zap,
      borderColor: "border-l-success",
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      label: "Estados",
      value: uniqueEstados.toString(),
      icon: MapPin,
      borderColor: "border-l-secondary",
      iconBg: "bg-secondary/10",
      iconColor: "text-secondary",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {stats.map((stat, i) => (
        <motion.div key={stat.label} custom={i} initial="hidden" animate="visible" variants={cardVariants}>
          <Card className={`border-l-[3px] ${stat.borderColor} bg-card shadow-sm hover:shadow-md transition-shadow`}>
            <CardContent className="flex items-center gap-4 p-5">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${stat.iconBg}`}>
                <stat.icon className={`w-5 h-5 ${stat.iconColor}`} />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}
