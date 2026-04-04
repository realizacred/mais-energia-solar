import { Sun, Zap, ArrowDown } from "lucide-react";
import { formatBRL } from "@/lib/formatters";
import { motion } from "framer-motion";

interface LandingHeroProps {
  clienteNome: string;
  potenciaKwp: number;
  economiaMensal: number;
  logoUrl: string | null | undefined;
  empresaNome: string | null | undefined;
  consultorNome: string | null | undefined;
}

export function LandingHero({
  clienteNome,
  potenciaKwp,
  economiaMensal,
  logoUrl,
  empresaNome,
  consultorNome,
}: LandingHeroProps) {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-4 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1117] via-[#0a0a0a] to-[#0a0a0a]" />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />
      
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10 mb-8"
      >
        {logoUrl ? (
          <img src={logoUrl} alt={empresaNome || "Empresa"} className="h-12 sm:h-16 object-contain" />
        ) : empresaNome ? (
          <div className="flex items-center gap-2">
            <Sun className="h-8 w-8 text-amber-400" />
            <span className="text-xl font-bold tracking-tight">{empresaNome}</span>
          </div>
        ) : null}
      </motion.div>

      {/* Main content */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative z-10 text-center max-w-2xl mx-auto"
      >
        <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-4">
          Proposta Exclusiva
        </p>
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight mb-6">
          <span className="text-white/90">Olá, </span>
          <span className="bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
            {clienteNome || "Cliente"}
          </span>
        </h1>
        <p className="text-lg sm:text-xl text-white/60 mb-10 leading-relaxed max-w-lg mx-auto">
          Preparamos um sistema solar fotovoltaico sob medida para você.
          {consultorNome && (
            <span className="block mt-2 text-base text-white/40">
              Consultor: {consultorNome}
            </span>
          )}
        </p>

        {/* Highlight numbers */}
        <div className="grid grid-cols-2 gap-4 sm:gap-6 max-w-md mx-auto mb-12">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
            <Zap className="h-6 w-6 text-amber-400 mx-auto mb-2" />
            <p className="text-2xl sm:text-3xl font-bold text-white">{potenciaKwp.toFixed(1)}</p>
            <p className="text-xs text-white/50 mt-1">kWp de potência</p>
          </div>
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5">
            <Sun className="h-6 w-6 text-emerald-400 mx-auto mb-2" />
            <p className="text-2xl sm:text-3xl font-bold text-emerald-400">{formatBRL(economiaMensal)}</p>
            <p className="text-xs text-white/50 mt-1">economia/mês</p>
          </div>
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2, duration: 0.6 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ArrowDown className="h-5 w-5 text-white/30" />
        </motion.div>
      </motion.div>
    </section>
  );
}
