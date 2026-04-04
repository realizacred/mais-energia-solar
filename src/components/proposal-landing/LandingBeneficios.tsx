import { TrendingUp, Clock, Leaf, DollarSign } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { motion } from "framer-motion";

interface LandingBeneficiosProps {
  economiaMensal: number;
  paybackMeses: number;
  potenciaKwp: number;
}

export function LandingBeneficios({ economiaMensal, paybackMeses, potenciaKwp }: LandingBeneficiosProps) {
  const economiaAnual = economiaMensal * 12;
  const economia25Anos = economiaMensal * 12 * 25;
  const co2EvitadoTonAno = potenciaKwp * 1.3; // ~1.3 ton CO2/kWp/ano

  const paybackText = paybackMeses >= 12
    ? `${Math.floor(paybackMeses / 12)} anos e ${paybackMeses % 12} meses`
    : `${paybackMeses} meses`;

  const fadeUp = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.6 },
  };

  const benefits = [
    {
      icon: DollarSign,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      title: formatBRL(economiaAnual),
      subtitle: "Economia por ano",
      desc: "Reduza drasticamente sua conta de energia elétrica desde o primeiro mês.",
    },
    {
      icon: Clock,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      title: paybackText,
      subtitle: "Retorno do investimento",
      desc: "Após o payback, toda a economia é lucro direto no seu bolso.",
    },
    {
      icon: TrendingUp,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      title: formatBRL(economia25Anos),
      subtitle: "Economia em 25 anos",
      desc: "Considerando a vida útil do sistema, o retorno é extraordinário.",
    },
    {
      icon: Leaf,
      color: "text-green-400",
      bg: "bg-green-500/10",
      title: `${co2EvitadoTonAno.toFixed(1)} ton`,
      subtitle: "CO₂ evitado por ano",
      desc: "Contribua para um planeta mais sustentável com energia limpa.",
    },
  ];

  return (
    <section className="py-20 sm:py-28 px-4 bg-[#0a0a0a] relative">
      <div className="max-w-4xl mx-auto">
        <motion.div {...fadeUp} className="text-center mb-14">
          <p className="text-emerald-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Benefícios
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold text-white">
            Por que investir em energia solar?
          </h2>
        </motion.div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {benefits.map((b, i) => (
            <motion.div key={i} {...fadeUp} transition={{ ...fadeUp.transition, delay: i * 0.1 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-colors"
            >
              <div className={`w-12 h-12 rounded-xl ${b.bg} flex items-center justify-center mb-4`}>
                <b.icon className={`h-6 w-6 ${b.color}`} />
              </div>
              <p className="text-2xl font-bold text-white mb-1">{b.title}</p>
              <p className={`text-sm font-semibold ${b.color} mb-2`}>{b.subtitle}</p>
              <p className="text-sm text-white/50 leading-relaxed">{b.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
