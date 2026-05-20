
import { useMemo } from "react";
import { 
  Zap, 
  TrendingUp, 
  Clock, 
  Sun, 
  ShieldCheck, 
  ArrowUpRight, 
  Leaf, 
  Settings,
  Package,
  CheckCircle2,
  Calendar
} from "lucide-react";
import { formatBRL, formatNumberBR } from "@/lib/formatters";
import type { NormalizedProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";

interface PropostaLandingDefaultProps {
  snapshot: NormalizedProposalSnapshot;
  brand: any;
  tenantNome: string | null;
  clienteNome: string;
}

export function PropostaLandingDefault({
  snapshot,
  brand,
  tenantNome,
  clienteNome
}: PropostaLandingDefaultProps) {
  const ns = snapshot as any;
  
  // Cores da marca
  const primaryColor = brand?.cor_primaria || "#3b82f6";

  const kpis = useMemo(() => [
    {
      label: "Economia Mensal",
      value: formatBRL(ns.economiaMensal || 0),
      icon: <TrendingUp className="h-5 w-5" />,
      sub: "Redução estimada"
    },
    {
      label: "Potência do Sistema",
      value: `${formatNumberBR(ns.potenciaKwp || 0)} kWp`,
      icon: <Zap className="h-5 w-5" />,
      sub: `${ns.itens?.filter((i: any) => i.categoria === "modulo").reduce((acc: number, i: any) => acc + i.quantidade, 0) || 0} módulos`
    },
    {
      label: "Geração Mensal",
      value: `${formatNumberBR(ns.geracaoMensalEstimada || 0)} kWh`,
      icon: <Sun className="h-5 w-5" />,
      sub: "Média estimada"
    },
    {
      label: "Payback",
      value: `${formatNumberBR(ns.paybackMeses / 12 || 0, 1)} anos`,
      icon: <Clock className="h-5 w-5" />,
      sub: `${ns.paybackMeses || 0} meses`
    }
  ], [ns]);

  return (
    <div className="bg-slate-50 min-h-screen font-sans text-slate-900">
      {/* Hero Section */}
      <section className="relative bg-slate-900 text-white pt-12 pb-24 px-6 overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-primary rounded-full blur-[120px]" />
          <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600 rounded-full blur-[120px]" />
        </div>

        <div className="max-w-5xl mx-auto relative z-10">
          <header className="flex justify-between items-center mb-16">
            {brand?.logo_white_url ? (
              <img src={brand.logo_white_url} alt={tenantNome || ""} className="h-10 object-contain" />
            ) : (
              <span className="text-xl font-black tracking-tighter uppercase">{tenantNome}</span>
            )}
            <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest">
              Proposta Digital
            </div>
          </header>

          <div className="max-w-2xl">
            <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
              Sua jornada para a <span className="text-primary">liberdade energética</span> começa aqui.
            </h1>
            <p className="text-lg text-white/60 mb-8 leading-relaxed">
              Olá, <span className="text-white font-bold">{clienteNome}</span>. Preparamos um projeto exclusivo para sua residência em <span className="text-white font-bold">{ns.locCidade}, {ns.locEstado}</span>.
            </p>
          </div>
        </div>
      </section>

      {/* KPI Section */}
      <section className="px-6 -mt-16 mb-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {kpis.map((kpi, idx) => (
            <div key={idx} className="bg-white p-6 rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-100 group hover:border-primary/30 transition-all">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center text-primary mb-4 group-hover:scale-110 transition-transform">
                {kpi.icon}
              </div>
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">{kpi.label}</p>
              <h3 className="text-2xl font-black text-slate-900 mb-1">{kpi.value}</h3>
              <p className="text-slate-400 text-[10px]">{kpi.sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Economia Section */}
      <section className="px-6 mb-20">
        <div className="max-w-5xl mx-auto bg-white rounded-[40px] p-8 md:p-12 shadow-xl shadow-slate-200/50 border border-slate-100 grid md:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-50 text-green-600 text-[10px] font-bold uppercase tracking-widest mb-6">
              <Leaf className="h-3 w-3" /> Sustentabilidade & Lucro
            </div>
            <h2 className="text-3xl font-black mb-6 leading-tight text-slate-900">
              Economize mais de <span className="text-green-600">{formatBRL((ns.economiaMensal || 0) * 12 * 25)}</span> nos próximos 25 anos.
            </h2>
            <p className="text-slate-500 leading-relaxed mb-8">
              Ao investir em energia solar, você deixa de ser um pagador de contas para se tornar um produtor de energia. O valor economizado pode ser reinvestido em sua família ou negócio.
            </p>
            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-red-500">
                  <TrendingUp className="h-5 w-5 rotate-180" />
                </div>
                <div>
                  <p className="text-xs text-slate-400 font-bold uppercase">Gasto atual (25 anos)</p>
                  <p className="text-lg font-bold text-slate-700 line-through opacity-50">{formatBRL((ns.gastoEnergiaSem || 0) * 12 * 25)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 p-4 rounded-2xl bg-green-50 border border-green-100">
                <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-green-500">
                  <ArrowUpRight className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs text-green-600/70 font-bold uppercase">Gasto com Solar (25 anos)</p>
                  <p className="text-xl font-black text-green-600">{formatBRL((ns.gastoEnergiaCom || 0) * 12 * 25)}</p>
                </div>
              </div>
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square bg-slate-50 rounded-[40px] flex items-center justify-center overflow-hidden border border-slate-100">
               {/* Simulação de gráfico ou imagem ilustrativa */}
               <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-blue-600/5" />
               <Sun className="h-32 w-32 text-primary/10 animate-pulse" />
            </div>
          </div>
        </div>
      </section>

      {/* Equipamentos Section */}
      <section className="px-6 mb-20">
        <div className="max-w-5xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <h2 className="text-3xl font-black text-slate-900 mb-2">Engenharia de Ponta</h2>
              <p className="text-slate-500">Selecionamos os melhores equipamentos do mercado para seu projeto.</p>
            </div>
            <div className="flex items-center gap-2 text-primary font-bold text-sm">
              <ShieldCheck className="h-5 w-5" /> Garantia de Performance
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {ns.itens?.map((item: any, idx: number) => (
              <div key={idx} className="bg-white p-6 rounded-3xl border border-slate-100 flex items-start gap-4 hover:shadow-lg hover:shadow-slate-200/30 transition-all">
                <div className="h-12 w-12 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-400">
                  {item.categoria === "modulo" ? <Settings className="h-6 w-6" /> : <Package className="h-6 w-6" />}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h4 className="font-bold text-slate-900 leading-tight">{item.descricao}</h4>
                    <span className="bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded-full font-bold">x{item.quantidade}</span>
                  </div>
                  <p className="text-xs text-slate-400 mb-3">{item.fabricante} • {item.modelo}</p>
                  <div className="flex items-center gap-4">
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Garantia: <span className="text-slate-900">{item.garantia_anos || 12} anos</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Timeline Section */}
      <section className="px-6 mb-20">
        <div className="max-w-5xl mx-auto bg-slate-900 rounded-[40px] p-8 md:p-12 text-white overflow-hidden relative">
           <div className="absolute top-0 right-0 h-full w-1/3 bg-primary/5 blur-3xl" />
           
           <h2 className="text-3xl font-black mb-12 relative z-10">Próximos Passos</h2>
           
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 relative z-10">
              {[
                { title: "Aceite", desc: "Assinatura digital", icon: <CheckCircle2 /> },
                { title: "Engenharia", desc: "Projeto técnico", icon: <Settings /> },
                { title: "Logística", desc: "Entrega do kit", icon: <Package /> },
                { title: "Instalação", desc: "Montagem física", icon: <Zap /> },
                { title: "Ativação", desc: "Operação total", icon: <Calendar /> }
              ].map((step, idx) => (
                <div key={idx} className="flex flex-col items-center text-center group">
                  <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:border-primary transition-all">
                    {step.icon}
                  </div>
                  <h4 className="font-bold text-sm mb-1">{step.title}</h4>
                  <p className="text-[10px] text-white/40 uppercase tracking-tighter">{step.desc}</p>
                </div>
              ))}
           </div>
        </div>
      </section>

      {/* Trust Section */}
      <section className="px-6 pb-20">
        <div className="max-w-5xl mx-auto text-center">
           <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-8">Por que confiar na {tenantNome}</p>
           <div className="flex flex-wrap justify-center gap-8 md:gap-16 opacity-40 grayscale">
              <div className="flex items-center gap-2 font-black italic text-2xl tracking-tighter">ISO 9001</div>
              <div className="flex items-center gap-2 font-black italic text-2xl tracking-tighter">INMETRO</div>
              <div className="flex items-center gap-2 font-black italic text-2xl tracking-tighter">ANEEL</div>
           </div>
        </div>
      </section>
    </div>
  );
}
