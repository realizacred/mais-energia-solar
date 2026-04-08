/**
 * KitsLanding.tsx
 * 
 * Landing page pública para seleção de kits de propostas.
 * Rota: /kits/:token
 * 
 * Página pública — exceção RB-02 documentada.
 * RB-17: sem console.log ativo.
 */

import { useState, useRef, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { Sun, Zap, TrendingUp, Clock, Package, CreditCard, CheckCircle2, Loader2, AlertTriangle, ChevronRight, Menu, X, Home, Wrench, BarChart3, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { formatBRL } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useGrupoKitPublic } from "@/hooks/usePropostaGrupoToken";
import { normalizeProposalSnapshot, type NormalizedProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";
import ReactSignatureCanvas from "react-signature-canvas";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import canvasConfetti from "canvas-confetti";
import { motion, AnimatePresence } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { CenarioData } from "@/components/proposal-landing/sections/types";

/* ─── Types ─────────────────────────────────────────── */

interface KitData {
  proposta_id: string;
  nome_kit: string;
  status: string;
  versao: {
    id: string;
    versao_numero: number;
    valor_total: number;
    economia_mensal: number;
    payback_meses: number;
    potencia_kwp: number;
    snapshot: Record<string, unknown>;
  } | null;
  cenarios: CenarioData[];
}

/* ─── Sections enum ─────────────────────────────────── */
const SECTIONS = ["inicio", "equipamentos", "financeiro", "pagamento"] as const;
type Section = typeof SECTIONS[number];
const SECTION_LABELS: Record<Section, string> = {
  inicio: "Início",
  equipamentos: "Equipamentos",
  financeiro: "Análise Financeira",
  pagamento: "Pagamento",
};
const SECTION_ICONS: Record<Section, typeof Home> = {
  inicio: Home,
  equipamentos: Wrench,
  financeiro: BarChart3,
  pagamento: Wallet,
};

/* ─── Main Component ────────────────────────────────── */

export default function KitsLanding() {
  const { token } = useParams<{ token: string }>();
  const { data, isLoading, error } = useGrupoKitPublic(token);

  const [selectedKitId, setSelectedKitId] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<Section>("inicio");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);
  const [acceptName, setAcceptName] = useState("");
  const [acceptDoc, setAcceptDoc] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [selectedCenarioId, setSelectedCenarioId] = useState<string | null>(null);
  const sigRef = useRef<ReactSignatureCanvas>(null);

  const sectionRefs = {
    inicio: useRef<HTMLDivElement>(null),
    equipamentos: useRef<HTMLDivElement>(null),
    financeiro: useRef<HTMLDivElement>(null),
    pagamento: useRef<HTMLDivElement>(null),
  };

  // Data from API
  const kits: KitData[] = data?.kits || [];
  const grupo = data?.grupo;
  const brand = data?.brand;
  const tenant = data?.tenant;
  const cliente = data?.cliente;
  const consultor = data?.consultor;

  // Auto-select first kit
  const selectedKit = useMemo(() => {
    if (kits.length === 0) return null;
    const found = kits.find(k => k.proposta_id === selectedKitId);
    if (found) return found;
    setSelectedKitId(kits[0]?.proposta_id);
    return kits[0];
  }, [kits, selectedKitId]);

  const snapshot = useMemo(() => {
    if (!selectedKit?.versao?.snapshot) return null;
    return normalizeProposalSnapshot(selectedKit.versao.snapshot as Record<string, unknown>);
  }, [selectedKit]);

  const cenarios = selectedKit?.cenarios || [];

  // Auto-select default cenário
  const selectedCenario = useMemo(() => {
    if (cenarios.length === 0) return null;
    const found = cenarios.find(c => c.id === selectedCenarioId);
    if (found) return found;
    const def = cenarios.find(c => c.is_default) || cenarios[0];
    if (def) setSelectedCenarioId(def.id);
    return def || null;
  }, [cenarios, selectedCenarioId]);

  const scrollTo = useCallback((section: Section) => {
    setActiveSection(section);
    setMobileMenuOpen(false);
    sectionRefs[section].current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Payback chart data
  const paybackData = useMemo(() => {
    if (!selectedKit?.versao) return [];
    const v = selectedKit.versao;
    const econMensal = v.economia_mensal || 0;
    const investimento = v.valor_total || 0;
    const points = [];
    for (let ano = 0; ano <= 25; ano++) {
      const economiaAcumulada = econMensal * 12 * ano;
      points.push({
        ano,
        economia: Math.round(economiaAcumulada),
        investimento: Math.round(investimento),
      });
    }
    return points;
  }, [selectedKit]);

  // Accept handler
  const handleAccept = async () => {
    if (!selectedKit || !grupo) return;
    if (!acceptName.trim() || !acceptDoc.trim()) {
      toast({ title: "Preencha nome e documento", variant: "destructive" });
      return;
    }
    if (sigRef.current?.isEmpty()) {
      toast({ title: "Assine no campo acima", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
      // Get or create token for this proposta
      const { data: tokenData } = await (supabase as any)
        .from("proposta_aceite_tokens")
        .select("token")
        .eq("proposta_id", selectedKit.proposta_id)
        .limit(1)
        .single();

      if (tokenData?.token) {
        // RB-47: Use proposal-public-action
        const { error: transitionErr } = await supabase.functions.invoke("proposal-public-action", {
          body: {
            token: tokenData.token,
            action: "aceitar",
            nome: acceptName,
            documento: acceptDoc,
            assinatura_base64: sigRef.current?.toDataURL(),
            cenario_id: selectedCenarioId,
            user_agent: navigator.userAgent,
          },
        });
        if (transitionErr) throw transitionErr;
      }

      // Update grupo with accepted kit
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
      await fetch(`${supabaseUrl}/rest/v1/proposta_grupo_tokens?id=eq.${grupo.id}`, {
        method: "PATCH",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ kit_aceito_id: selectedKit.proposta_id }),
      });

      setAccepted(true);
      setShowAcceptModal(false);
      canvasConfetti({ particleCount: 200, spread: 100, origin: { y: 0.6 } });
    } catch (err: any) {
      console.error("[KitsLanding] Accept error:", err);
      toast({ title: "Erro ao aceitar", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  // ─── Loading ───
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Sun className="w-12 h-12 text-primary animate-spin mx-auto" />
          <p className="text-muted-foreground">Carregando propostas...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
            <p className="text-muted-foreground">
              {(error as any)?.message || "Este link expirou ou não existe."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (accepted || grupo?.kit_aceito_id) {
    const aceito = kits.find(k => k.proposta_id === (grupo?.kit_aceito_id || selectedKit?.proposta_id));
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6 max-w-md"
        >
          <CheckCircle2 className="w-20 h-20 text-success mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">Proposta Aceita!</h1>
          <p className="text-muted-foreground">
            Você escolheu o <strong>{aceito?.nome_kit || "kit selecionado"}</strong>.
            Entraremos em contato em breve.
          </p>
          {tenant && (
            <p className="text-sm text-muted-foreground">
              {tenant.nome} • {tenant.telefone}
            </p>
          )}
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* ─── Sidebar (desktop) ─── */}
      <aside className="hidden lg:flex flex-col w-64 border-r border-border bg-card fixed inset-y-0 left-0 z-40">
        {/* Logo */}
        <div className="p-5 border-b border-border">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt={tenant?.nome || ""} className="h-10 object-contain" />
          ) : (
            <div className="flex items-center gap-2">
              <Sun className="w-6 h-6 text-primary" />
              <span className="font-bold text-foreground">{tenant?.nome || "Solar"}</span>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {SECTIONS.map(s => {
            const Icon = SECTION_ICONS[s];
            return (
              <button
                key={s}
                onClick={() => scrollTo(s)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  activeSection === s
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {SECTION_LABELS[s]}
              </button>
            );
          })}
        </nav>

        {/* Selected kit summary */}
        {selectedKit && (
          <div className="p-4 border-t border-border space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kit selecionado</p>
            <p className="text-sm font-bold text-foreground">{selectedKit.nome_kit}</p>
            <p className="text-2xl font-bold text-primary tracking-tight">
              {formatBRL(selectedKit.versao?.valor_total || 0)}
            </p>
            <Button className="w-full" onClick={() => setShowAcceptModal(true)}>
              Aceitar Proposta
            </Button>
          </div>
        )}
      </aside>

      {/* ─── Mobile header ─── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          {brand?.logo_url ? (
            <img src={brand.logo_url} alt="" className="h-8 object-contain" />
          ) : (
            <span className="font-bold text-foreground text-sm">{tenant?.nome || "Solar"}</span>
          )}
          <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-border overflow-hidden"
            >
              <nav className="p-2 space-y-1">
                {SECTIONS.map(s => {
                  const Icon = SECTION_ICONS[s];
                  return (
                    <button
                      key={s}
                      onClick={() => scrollTo(s)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm",
                        activeSection === s ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {SECTION_LABELS[s]}
                    </button>
                  );
                })}
              </nav>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Main Content ─── */}
      <main className="flex-1 lg:ml-64 pt-14 lg:pt-0">
        {/* ═══ INÍCIO ═══ */}
        <section ref={sectionRefs.inicio} className="p-6 sm:p-10 bg-gradient-to-br from-primary/5 to-background min-h-[50vh] flex items-center">
          <div className="max-w-3xl mx-auto w-full space-y-8">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm font-semibold text-primary uppercase tracking-wider">
                {grupo?.titulo || "Proposta Solar"}
              </p>
              <h1 className="text-3xl sm:text-4xl font-bold text-foreground mt-2 leading-tight">
                Tudo começa por você!
              </h1>
              {cliente && (
                <p className="text-lg text-muted-foreground mt-3">
                  {cliente.nome}{cliente.cidade ? ` • ${cliente.cidade}/${cliente.estado}` : ""}
                </p>
              )}
            </motion.div>

            {/* KPIs */}
            {selectedKit?.versao && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="grid grid-cols-2 sm:grid-cols-4 gap-4"
              >
                {[
                  { icon: Sun, label: "Potência", value: `${selectedKit.versao.potencia_kwp?.toFixed(1) || "0"} kWp`, color: "text-warning" },
                  { icon: Zap, label: "Geração mensal", value: `${Math.round(snapshot?.geracaoMensalEstimada || 0)} kWh`, color: "text-success" },
                  { icon: TrendingUp, label: "Economia anual", value: formatBRL((selectedKit.versao.economia_mensal || 0) * 12), color: "text-primary" },
                  { icon: Clock, label: "Payback", value: `${selectedKit.versao.payback_meses || "—"} meses`, color: "text-info" },
                ].map((kpi, i) => (
                  <Card key={i} className="border-border bg-card/80 backdrop-blur">
                    <CardContent className="p-4 text-center">
                      <kpi.icon className={cn("w-6 h-6 mx-auto mb-2", kpi.color)} />
                      <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                      <p className="text-xs text-muted-foreground mt-1">{kpi.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </motion.div>
            )}
          </div>
        </section>

        {/* ═══ EQUIPAMENTOS ═══ */}
        <section ref={sectionRefs.equipamentos} className="p-6 sm:p-10 bg-background">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-foreground">Escolha seu Kit</h2>
            <p className="text-sm text-muted-foreground">
              Compare as opções e selecione o kit ideal para você
            </p>

            {/* Kit cards */}
            <div className={cn(
              "grid gap-4",
              kits.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
            )}>
              {kits.map((kit, i) => {
                const isSelected = kit.proposta_id === selectedKit?.proposta_id;
                const snap = kit.versao?.snapshot ? normalizeProposalSnapshot(kit.versao.snapshot as Record<string, unknown>) : null;
                const modulos = snap?.itens.filter(it => ["modulo", "modulos"].includes(it.categoria)) || [];
                const inversores = snap?.itens.filter(it => ["inversor", "inversores"].includes(it.categoria)) || [];

                return (
                  <motion.div
                    key={kit.proposta_id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                  >
                    <Card
                      className={cn(
                        "cursor-pointer transition-all duration-200",
                        isSelected
                          ? "border-primary border-2 shadow-md ring-2 ring-primary/20"
                          : "border-border hover:border-primary/40 hover:shadow-sm"
                      )}
                      onClick={() => setSelectedKitId(kit.proposta_id)}
                    >
                      <CardContent className="p-5 space-y-4">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                          <h3 className="text-base font-semibold text-foreground">{kit.nome_kit}</h3>
                          {isSelected && (
                            <Badge className="bg-primary text-primary-foreground text-[10px]">
                              Selecionado
                            </Badge>
                          )}
                        </div>

                        {/* Price */}
                        <p className="text-2xl font-bold text-primary tracking-tight">
                          {formatBRL(kit.versao?.valor_total || 0)}
                        </p>

                        {/* Equipment details */}
                        <div className="space-y-2 text-sm">
                          {modulos.map((m, j) => (
                            <div key={j} className="flex justify-between text-foreground">
                              <span className="text-muted-foreground">{m.quantidade}x Módulo</span>
                              <span className="font-medium">{m.fabricante} {m.modelo}</span>
                            </div>
                          ))}
                          {inversores.map((inv, j) => (
                            <div key={j} className="flex justify-between text-foreground">
                              <span className="text-muted-foreground">{inv.quantidade}x Inversor</span>
                              <span className="font-medium">{inv.fabricante} {inv.modelo}</span>
                            </div>
                          ))}
                        </div>

                        {/* Quick stats */}
                        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border">
                          <div>
                            <p className="text-xs text-muted-foreground">Potência</p>
                            <p className="text-sm font-bold text-foreground">
                              {kit.versao?.potencia_kwp?.toFixed(1)} kWp
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">Payback</p>
                            <p className="text-sm font-bold text-foreground">
                              {kit.versao?.payback_meses || "—"} meses
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>

            {/* Services */}
            {snapshot && snapshot.servicos.filter(s => s.incluso_no_preco).length > 0 && (
              <Card className="bg-success/5 border-success/20">
                <CardContent className="p-4">
                  <p className="text-sm font-semibold text-success mb-2">✓ Inclusos na proposta:</p>
                  {snapshot.servicos.filter(s => s.incluso_no_preco).map(s => (
                    <p key={s.id} className="text-sm text-success/80 ml-3">• {s.descricao}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </section>

        {/* ═══ ANÁLISE FINANCEIRA ═══ */}
        <section ref={sectionRefs.financeiro} className="p-6 sm:p-10 bg-muted/30">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-foreground">Análise Financeira</h2>

            {selectedKit?.versao && (
              <>
                {/* Metrics */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card>
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl font-bold text-success tracking-tight">
                        {formatBRL((selectedKit.versao.economia_mensal || 0) * 12 * 25)}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Economia em 25 anos</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl font-bold text-primary tracking-tight">
                        {selectedKit.versao.payback_meses || "—"} meses
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Payback</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-5 text-center">
                      <p className="text-2xl font-bold text-warning tracking-tight">
                        +8%
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">Valorização do imóvel</p>
                    </CardContent>
                  </Card>
                </div>

                {/* Chart */}
                {paybackData.length > 0 && (
                  <Card>
                    <CardContent className="p-5">
                      <p className="text-base font-semibold text-foreground mb-4">Retorno do Investimento</p>
                      <div className="h-[250px] sm:h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={paybackData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                              dataKey="ano"
                              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={(v) => `${v}a`}
                            />
                            <YAxis
                              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                            />
                            <Tooltip
                              formatter={(v: number) => formatBRL(v)}
                              labelFormatter={(v) => `Ano ${v}`}
                              contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 8,
                              }}
                            />
                            <Area
                              type="monotone"
                              dataKey="economia"
                              stroke="hsl(var(--success))"
                              fill="hsl(var(--success) / 0.1)"
                              name="Economia acumulada"
                            />
                            <Area
                              type="monotone"
                              dataKey="investimento"
                              stroke="hsl(var(--destructive))"
                              fill="hsl(var(--destructive) / 0.05)"
                              name="Investimento"
                              strokeDasharray="5 5"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}
          </div>
        </section>

        {/* ═══ PAGAMENTO ═══ */}
        <section ref={sectionRefs.pagamento} className="p-6 sm:p-10 bg-background">
          <div className="max-w-4xl mx-auto space-y-6">
            <h2 className="text-xl font-bold text-foreground">Formas de Pagamento</h2>

            {cenarios.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {cenarios.map(c => (
                  <Card
                    key={c.id}
                    className={cn(
                      "cursor-pointer transition-all",
                      selectedCenarioId === c.id
                        ? "border-primary border-2 shadow-md"
                        : "border-border hover:border-primary/40"
                    )}
                    onClick={() => setSelectedCenarioId(c.id)}
                  >
                    <CardContent className="p-5 space-y-2">
                      <p className="text-base font-semibold text-foreground">{c.nome}</p>
                      <p className="text-2xl font-bold text-primary tracking-tight">
                        {formatBRL(c.preco_final)}
                      </p>
                      {c.num_parcelas > 0 && (
                        <p className="text-sm text-muted-foreground">
                          {c.num_parcelas}x de {formatBRL(c.valor_parcela)}
                        </p>
                      )}
                      {c.entrada_valor > 0 && (
                        <p className="text-xs text-muted-foreground">
                          Entrada: {formatBRL(c.entrada_valor)}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <p className="text-2xl font-bold text-primary">
                    {formatBRL(selectedKit?.versao?.valor_total || 0)}
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">Valor do investimento</p>
                </CardContent>
              </Card>
            )}

            {/* CTA */}
            <div className="text-center pt-6">
              <Button
                size="xl"
                className="text-lg px-12"
                onClick={() => setShowAcceptModal(true)}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                Aceitar Proposta
              </Button>
              {consultor && (
                <p className="text-xs text-muted-foreground mt-3">
                  Consultor: {consultor.full_name} {consultor.phone ? `• ${consultor.phone}` : ""}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ─── Mobile bottom bar ─── */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{selectedKit?.nome_kit}</p>
              <p className="text-lg font-bold text-primary">{formatBRL(selectedKit?.versao?.valor_total || 0)}</p>
            </div>
            <Button size="sm" onClick={() => setShowAcceptModal(true)}>
              Aceitar
            </Button>
          </div>
        </div>

        {/* Spacer for mobile bottom bar */}
        <div className="lg:hidden h-20" />
      </main>

      {/* ─── Accept Modal ─── */}
      <AnimatePresence>
        {showAcceptModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => !submitting && setShowAcceptModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-card rounded-2xl p-6 w-[90vw] max-w-md max-h-[90vh] overflow-y-auto space-y-4 border border-border shadow-xl"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-foreground">Confirmar Aceite</h3>
              <p className="text-sm text-muted-foreground">
                Kit: <strong>{selectedKit?.nome_kit}</strong> — {formatBRL(selectedKit?.versao?.valor_total || 0)}
              </p>

              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Nome completo</Label>
                  <Input
                    value={acceptName}
                    onChange={e => setAcceptName(e.target.value)}
                    placeholder="Seu nome"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CPF/CNPJ</Label>
                  <CpfCnpjInput value={acceptDoc} onChange={setAcceptDoc} />
                </div>
                <div className="space-y-2">
                  <Label>Assinatura</Label>
                  <div className="border border-border rounded-lg bg-white" style={{ touchAction: "none" }}>
                    <ReactSignatureCanvas
                      ref={sigRef}
                      canvasProps={{
                        width: 340,
                        height: 150,
                        className: "w-full rounded-lg",
                      }}
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={() => sigRef.current?.clear()}
                  >
                    Limpar assinatura
                  </Button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowAcceptModal(false)}
                  disabled={submitting}
                >
                  Cancelar
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleAccept}
                  disabled={submitting}
                >
                  {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                  Confirmar Aceite
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
