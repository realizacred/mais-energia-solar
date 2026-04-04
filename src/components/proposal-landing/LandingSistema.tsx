import { Cpu, LayoutGrid, MapPin, Ruler } from "lucide-react";
import { motion } from "framer-motion";
import type { NormalizedKitItem } from "@/domain/proposal/normalizeProposalSnapshot";

interface LandingSistemaProps {
  potenciaKwp: number;
  geracaoMensal: number;
  consumoTotal: number;
  itens: NormalizedKitItem[];
  tipoTelhado: string;
  cidade: string;
  estado: string;
}

export function LandingSistema({
  potenciaKwp,
  geracaoMensal,
  consumoTotal,
  itens,
  tipoTelhado,
  cidade,
  estado,
}: LandingSistemaProps) {
  const modulos = itens.filter(i => i.categoria === "modulo" || i.categoria === "modulos");
  const inversores = itens.filter(i => i.categoria === "inversor" || i.categoria === "inversores");

  const modulo = modulos[0];
  const inversor = inversores[0];
  const totalModulos = modulos.reduce((sum, m) => sum + m.quantidade, 0);

  const fadeUp = {
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: "-60px" },
    transition: { duration: 0.6 },
  };

  return (
    <section className="py-20 sm:py-28 px-4 bg-[#0d1117] relative">
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">
        <motion.div {...fadeUp} className="text-center mb-14">
          <p className="text-amber-400 text-sm font-semibold tracking-widest uppercase mb-3">
            Sistema Proposto
          </p>
          <h2 className="text-2xl sm:text-4xl font-bold text-white">
            Seu sistema solar personalizado
          </h2>
        </motion.div>

        {/* Equipment cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-10">
          {modulo && (
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.1 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <LayoutGrid className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">Módulos</p>
                  <p className="text-white font-semibold">{totalModulos} unidades</p>
                </div>
              </div>
              <p className="text-sm text-white/60">{modulo.fabricante} {modulo.modelo}</p>
              <p className="text-xs text-white/40 mt-1">{modulo.potencia_w}W por módulo</p>
            </motion.div>
          )}

          {inversor && (
            <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.2 }}
              className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Cpu className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-white/40 uppercase tracking-wider">Inversor</p>
                  <p className="text-white font-semibold">{inversor.quantidade}x</p>
                </div>
              </div>
              <p className="text-sm text-white/60">{inversor.fabricante} {inversor.modelo}</p>
              {inversor.potencia_w > 0 && (
                <p className="text-xs text-white/40 mt-1">{(inversor.potencia_w / 1000).toFixed(1)} kW</p>
              )}
            </motion.div>
          )}
        </div>

        {/* Stats row */}
        <motion.div {...fadeUp} transition={{ ...fadeUp.transition, delay: 0.3 }}
          className="grid grid-cols-2 sm:grid-cols-4 gap-3"
        >
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{potenciaKwp.toFixed(1)}</p>
            <p className="text-[11px] text-white/40 mt-1">kWp total</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{geracaoMensal.toLocaleString("pt-BR")}</p>
            <p className="text-[11px] text-white/40 mt-1">kWh/mês gerado</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <p className="text-xl font-bold text-white">{consumoTotal.toLocaleString("pt-BR")}</p>
            <p className="text-[11px] text-white/40 mt-1">kWh/mês consumo</p>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <MapPin className="h-3.5 w-3.5 text-white/40" />
            </div>
            <p className="text-sm font-semibold text-white">{cidade || "—"}</p>
            <p className="text-[11px] text-white/40">{estado || ""} · {tipoTelhado || "—"}</p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
