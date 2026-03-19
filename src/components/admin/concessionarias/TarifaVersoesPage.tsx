import { useState, useEffect, useCallback, useMemo } from "react";
import {
  History, Plus, CheckCircle2, Archive, Eye, RotateCcw, FileText,
  ChevronDown, ChevronRight, AlertTriangle, Zap, Clock, User,
  ArrowLeftRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { cn } from "@/lib/utils";

// ─── Types ───

interface TarifaVersao {
  id: string;
  tenant_id: string;
  created_at: string;
  created_by: string | null;
  origem: string;
  notas: string | null;
  status: string;
  total_registros: number;
  total_concessionarias: number;
  arquivo_nome: string | null;
  activated_at: string | null;
  activated_by: string | null;
}

interface TarifaRegistro {
  id: string;
  concessionaria_id: string;
  subgrupo: string;
  modalidade_tarifaria: string | null;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
  te_ponta: number | null;
  te_fora_ponta: number | null;
  tusd_ponta: number | null;
  tusd_fora_ponta: number | null;
  demanda_consumo_rs: number | null;
  demanda_geracao_rs: number | null;
  origem: string | null;
  is_active: boolean | null;
  versao_id: string | null;
  concessionaria_nome?: string;
}

interface DiffEntry {
  concessionaria: string;
  subgrupo: string;
  modalidade: string | null;
  campo: string;
  anterior: number | null;
  novo: number | null;
  variacao: number; // percentage
}

// ─── Helpers ───

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
}

function formatVal(v: number | null) {
  if (v == null) return "—";
  return v.toFixed(4);
}

function StatusBadgeInline({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground border-border" },
    ativa: { label: "Ativa", className: "bg-success/10 text-success border-success/20" },
    arquivada: { label: "Arquivada", className: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status] || { label: status, className: "bg-muted text-muted-foreground border-border" };
  return <Badge variant="outline" className={cn("text-[10px]", s.className)}>{s.label}</Badge>;
}

function OrigemBadgeInline({ origem }: { origem: string }) {
  const map: Record<string, string> = { sync: "Sync ANEEL", manual: "Manual", import: "Importação CSV" };
  return <Badge variant="outline" className="text-[9px] font-mono bg-muted text-muted-foreground border-border">{map[origem] || origem}</Badge>;
}

// ─── Component ───

export function TarifaVersoesPage() {
  const { toast } = useToast();
  const [versoes, setVersoes] = useState<TarifaVersao[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedVersao, setSelectedVersao] = useState<TarifaVersao | null>(null);
  const [registros, setRegistros] = useState<TarifaRegistro[]>([]);
  const [loadingRegistros, setLoadingRegistros] = useState(false);

  // Dialogs
  const [activateDialog, setActivateDialog] = useState<TarifaVersao | null>(null);
  const [rollbackDialog, setRollbackDialog] = useState<TarifaVersao | null>(null);
  const [diffDialog, setDiffDialog] = useState<{ versaoA: TarifaVersao; versaoB: TarifaVersao } | null>(null);
  const [diffEntries, setDiffEntries] = useState<DiffEntry[]>([]);
  const [loadingDiff, setLoadingDiff] = useState(false);

  // ─── Fetch versions ───
  const fetchVersoes = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("tarifa_versoes")
      .select("id, tenant_id, origem, status, notas, arquivo_nome, total_registros, total_concessionarias, sync_run_id, activated_at, activated_by, created_at, created_by")
      .order("created_at", { ascending: false });
    if (!error && data) setVersoes(data as TarifaVersao[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchVersoes(); }, [fetchVersoes]);

  const versaoAtiva = useMemo(() => versoes.find(v => v.status === "ativa"), [versoes]);

  // ─── Fetch registros for version ───
  const fetchRegistros = useCallback(async (versaoId: string) => {
    setLoadingRegistros(true);
    const { data } = await supabase
      .from("concessionaria_tarifas_subgrupo")
      .select("*, concessionarias!inner(nome)")
      .eq("versao_id", versaoId)
      .order("subgrupo");
    if (data) {
      setRegistros(data.map((r: any) => ({
        ...r,
        concessionaria_nome: r.concessionarias?.nome || "—",
      })));
    }
    setLoadingRegistros(false);
  }, []);

  const handleSelectVersao = (v: TarifaVersao) => {
    setSelectedVersao(v);
    fetchRegistros(v.id);
  };

  // ─── Activate version ───
  const handleActivate = async () => {
    if (!activateDialog) return;
    try {
      // 1. Archive current active version
      if (versaoAtiva && versaoAtiva.id !== activateDialog.id) {
        await supabase
          .from("tarifa_versoes")
          .update({ status: "arquivada" })
          .eq("id", versaoAtiva.id);

        // Deactivate registros of old version
        await supabase
          .from("concessionaria_tarifas_subgrupo")
          .update({ is_active: false })
          .eq("versao_id", versaoAtiva.id);
      }

      // 2. Activate new version
      const { error } = await supabase
        .from("tarifa_versoes")
        .update({
          status: "ativa",
          activated_at: new Date().toISOString(),
        })
        .eq("id", activateDialog.id);

      if (error) throw error;

      // 3. Activate registros of new version
      await supabase
        .from("concessionaria_tarifas_subgrupo")
        .update({ is_active: true })
        .eq("versao_id", activateDialog.id);

      toast({ title: "Versão ativada com sucesso", description: `Versão de ${formatDate(activateDialog.created_at)} agora é a versão ativa.` });
      fetchVersoes();
    } catch (err: any) {
      toast({ title: "Erro ao ativar versão", description: err.message, variant: "destructive" });
    }
    setActivateDialog(null);
  };

  // ─── Rollback ───
  const handleRollback = async () => {
    if (!rollbackDialog) return;
    setActivateDialog(rollbackDialog);
    setRollbackDialog(null);
    await handleActivate();
  };

  // ─── Diff between two versions ───
  const handleDiff = async (versaoA: TarifaVersao, versaoB: TarifaVersao) => {
    setDiffDialog({ versaoA, versaoB });
    setLoadingDiff(true);
    try {
      const [resA, resB] = await Promise.all([
        supabase
          .from("concessionaria_tarifas_subgrupo")
          .select("*, concessionarias!inner(nome)")
          .eq("versao_id", versaoA.id),
        supabase
          .from("concessionaria_tarifas_subgrupo")
          .select("*, concessionarias!inner(nome)")
          .eq("versao_id", versaoB.id),
      ]);

      const mapA = new Map<string, any>();
      for (const r of (resA.data || [])) {
        mapA.set(`${r.concessionaria_id}|${r.subgrupo}|${r.modalidade_tarifaria}`, { ...r, concessionaria_nome: (r as any).concessionarias?.nome });
      }

      const entries: DiffEntry[] = [];
      const campos = ["tarifa_energia", "tarifa_fio_b", "te_ponta", "te_fora_ponta", "tusd_ponta", "tusd_fora_ponta", "demanda_consumo_rs", "demanda_geracao_rs"];
      const campoLabels: Record<string, string> = {
        tarifa_energia: "Tarifa Energia", tarifa_fio_b: "Fio B",
        te_ponta: "TE Ponta", te_fora_ponta: "TE F.Ponta",
        tusd_ponta: "TUSD Ponta", tusd_fora_ponta: "TUSD F.Ponta",
        demanda_consumo_rs: "Dem. Consumo", demanda_geracao_rs: "Dem. Geração",
      };

      for (const rB of (resB.data || [])) {
        const key = `${rB.concessionaria_id}|${rB.subgrupo}|${rB.modalidade_tarifaria}`;
        const rA = mapA.get(key);
        const concNome = (rB as any).concessionarias?.nome || "—";

        for (const campo of campos) {
          const vA = rA ? rA[campo] : null;
          const vB = (rB as any)[campo];
          if (vA !== vB && (vA != null || vB != null)) {
            const variacao = vA && vB ? ((vB - vA) / vA) * 100 : 0;
            entries.push({
              concessionaria: concNome,
              subgrupo: rB.subgrupo,
              modalidade: rB.modalidade_tarifaria,
              campo: campoLabels[campo] || campo,
              anterior: vA,
              novo: vB,
              variacao: Math.round(variacao * 100) / 100,
            });
          }
        }
      }

      setDiffEntries(entries);
    } catch (err) {
      console.error("Diff error:", err);
    }
    setLoadingDiff(false);
  };

  // ─── Stats ───
  const stats = useMemo(() => ({
    total: versoes.length,
    ativa: versoes.filter(v => v.status === "ativa").length,
    rascunho: versoes.filter(v => v.status === "rascunho").length,
    arquivada: versoes.filter(v => v.status === "arquivada").length,
  }), [versoes]);

  return (
    <div className="space-y-6">
      {/* Header — §26 */}
      <PageHeader
        icon={History}
        title="Versões de Tarifa"
        description="Gerencie versões tarifárias com histórico completo, diff e rollback."
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted"><FileText className="w-4 h-4 text-muted-foreground" /></div>
            <div><p className="text-lg font-bold">{stats.total}</p><p className="text-[10px] text-muted-foreground">Total</p></div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-success/10"><CheckCircle2 className="w-4 h-4 text-success" /></div>
            <div><p className="text-lg font-bold text-success">{stats.ativa}</p><p className="text-[10px] text-muted-foreground">Ativa</p></div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-warning/10"><Clock className="w-4 h-4 text-warning" /></div>
            <div><p className="text-lg font-bold">{stats.rascunho}</p><p className="text-[10px] text-muted-foreground">Rascunho</p></div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-muted"><Archive className="w-4 h-4 text-muted-foreground" /></div>
            <div><p className="text-lg font-bold">{stats.arquivada}</p><p className="text-[10px] text-muted-foreground">Arquivadas</p></div>
          </CardContent>
        </Card>
      </div>

      {/* Version list + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left: Version list */}
        <Card className="lg:col-span-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Histórico de Versões</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              {loading ? (
                <div className="p-4 space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="space-y-2 p-3">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              ) : versoes.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                  <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-4">
                    <History className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-base font-semibold text-foreground mb-1">Nenhuma versão criada</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    Importe tarifas para criar a primeira versão.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {versoes.map(v => (
                    <div
                      key={v.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectVersao(v)}
                      onKeyDown={e => { if (e.key === "Enter" || e.key === " ") handleSelectVersao(v); }}
                      className={cn(
                        "w-full text-left p-3 transition-colors hover:bg-muted/30 cursor-pointer",
                        selectedVersao?.id === v.id && "bg-primary/5 border-l-2 border-primary",
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{formatDate(v.created_at)}</span>
                        <StatusBadgeInline status={v.status} />
                      </div>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <OrigemBadgeInline origem={v.origem} />
                        <span>{v.total_registros} registros</span>
                        <span>·</span>
                        <span>{v.total_concessionarias} conc.</span>
                      </div>
                      {v.notas && (
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1">{v.notas}</p>
                      )}
                      {v.arquivo_nome && (
                        <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-mono truncate">{v.arquivo_nome}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Right: Detail */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span>Detalhes da Versão</span>
              {selectedVersao && (
                <div className="flex items-center gap-1.5">
                  {versaoAtiva && selectedVersao.id !== versaoAtiva.id && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      onClick={() => handleDiff(versaoAtiva, selectedVersao)}
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      Diff vs Ativa
                    </Button>
                  )}
                  {selectedVersao.status !== "ativa" && (
                    <Button
                      size="sm"
                      className="h-7 text-[10px] gap-1"
                      onClick={() => setActivateDialog(selectedVersao)}
                    >
                      <CheckCircle2 className="w-3 h-3" />
                      Ativar
                    </Button>
                  )}
                  {selectedVersao.status === "arquivada" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-[10px] gap-1 text-warning"
                      onClick={() => setRollbackDialog(selectedVersao)}
                    >
                      <RotateCcw className="w-3 h-3" />
                      Rollback
                    </Button>
                  )}
                </div>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedVersao ? (
              <div className="h-[400px] flex items-center justify-center text-sm text-muted-foreground">
                <div className="text-center">
                  <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-4 mx-auto">
                    <Eye className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-base font-semibold text-foreground mb-1">Selecione uma versão</p>
                  <p className="text-sm text-muted-foreground">Clique em uma versão à esquerda para ver seus detalhes.</p>
                </div>
              </div>
            ) : (
              <ScrollArea className="h-[460px]">
                <div className="space-y-4 pr-2">
                  {/* Meta */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground text-[10px]">Status</p>
                      <StatusBadgeInline status={selectedVersao.status} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px]">Origem</p>
                      <OrigemBadgeInline origem={selectedVersao.origem} />
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px]">Criada em</p>
                      <p className="font-medium text-foreground">{formatDate(selectedVersao.created_at)}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-[10px]">Ativada em</p>
                      <p className="font-medium text-foreground">{formatDate(selectedVersao.activated_at)}</p>
                    </div>
                  </div>

                  {selectedVersao.notas && (
                    <div className="p-2 bg-muted/40 rounded text-xs text-foreground">{selectedVersao.notas}</div>
                  )}

                  <Separator />

                  {/* Registros */}
                  <div>
                    <p className="text-xs font-semibold mb-2 text-foreground">
                      Registros ({registros.length})
                    </p>
                    {loadingRegistros ? (
                      <div className="space-y-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                          <Skeleton key={i} className="h-10 w-full rounded-lg" />
                        ))}
                      </div>
                    ) : registros.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-3">
                          <FileText className="h-5 w-5 text-muted-foreground/50" />
                        </div>
                        <p className="text-xs text-muted-foreground">Nenhum registro vinculado a esta versão.</p>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {registros.map(r => (
                          <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border border-border bg-card text-[11px] hover:bg-muted/30 transition-colors">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="font-mono font-bold text-xs bg-primary/10 text-primary border-primary/20">{r.subgrupo}</Badge>
                              {r.modalidade_tarifaria && (
                                <Badge variant="outline" className="text-[8px] bg-info/10 text-info border-info/20">{r.modalidade_tarifaria}</Badge>
                              )}
                              <span className="text-muted-foreground">{r.concessionaria_nome}</span>
                            </div>
                            <div className="flex items-center gap-3 text-muted-foreground">
                              {r.subgrupo.startsWith("A") ? (
                                <>
                                  <span>TE P: {formatVal(r.te_ponta)}</span>
                                  <span>TUSD P: {formatVal(r.tusd_ponta)}</span>
                                </>
                              ) : (
                                <>
                                  <span>Energia: {formatVal(r.tarifa_energia)}</span>
                                  <span>Fio B: {formatVal(r.tarifa_fio_b)}</span>
                                </>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Activate Dialog ─── */}
      <AlertDialog open={!!activateDialog} onOpenChange={() => setActivateDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-primary" />
              Ativar esta versão?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              {versaoAtiva ? (
                <>A versão atual ({formatDate(versaoAtiva.created_at)}) será <strong>arquivada</strong> e esta se tornará a versão ativa para cálculos.</>
              ) : (
                <>Esta versão se tornará a versão ativa para todos os cálculos de propostas.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleActivate}>Ativar Versão</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Rollback Dialog ─── */}
      <AlertDialog open={!!rollbackDialog} onOpenChange={() => setRollbackDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-warning">
              <RotateCcw className="w-5 h-5" />
              Rollback para versão anterior?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">
              Isso vai <strong>arquivar</strong> a versão ativa atual e <strong>reativar</strong> a versão de {rollbackDialog && formatDate(rollbackDialog.created_at)}.
              Todas as propostas passarão a usar os valores desta versão.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-warning text-warning-foreground hover:bg-warning/90"
              onClick={() => {
                if (rollbackDialog) {
                  setActivateDialog(rollbackDialog);
                  setRollbackDialog(null);
                }
              }}
            >
              Confirmar Rollback
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Diff Dialog ─── */}
      <Dialog open={!!diffDialog} onOpenChange={() => setDiffDialog(null)}>
        <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ArrowLeftRight className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Diferenças entre Versões
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {diffDialog && (
                  <>
                    <span className="font-medium">Ativa</span> ({formatDate(diffDialog.versaoA.created_at)}) →{" "}
                    <span className="font-medium">Selecionada</span> ({formatDate(diffDialog.versaoB.created_at)})
                  </>
                )}
              </p>
            </div>
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-y-auto p-5">
            {loadingDiff ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full rounded-lg" />
                ))}
              </div>
            ) : diffEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <h3 className="text-base font-semibold text-foreground mb-1">Sem diferenças</h3>
                <p className="text-sm text-muted-foreground">Nenhuma diferença encontrada entre as versões.</p>
              </div>
            ) : (
              <div className="space-y-1">
                <div className="grid grid-cols-6 gap-2 text-[10px] font-semibold text-muted-foreground px-2 py-1 border-b border-border">
                  <span>Concessionária</span>
                  <span>Subgrupo</span>
                  <span>Campo</span>
                  <span className="text-right">Anterior</span>
                  <span className="text-right">Novo</span>
                  <span className="text-right">Variação</span>
                </div>
                {diffEntries.map((d, i) => (
                  <div key={i} className="grid grid-cols-6 gap-2 text-[11px] px-2 py-1.5 rounded hover:bg-muted/30 transition-colors">
                    <span className="truncate text-foreground">{d.concessionaria}</span>
                    <span className="font-mono text-foreground">{d.subgrupo}{d.modalidade ? ` ${d.modalidade}` : ""}</span>
                    <span className="text-foreground">{d.campo}</span>
                    <span className="text-right font-mono text-muted-foreground">{formatVal(d.anterior)}</span>
                    <span className="text-right font-mono text-foreground">{formatVal(d.novo)}</span>
                    <span className={cn(
                      "text-right font-mono font-medium",
                      d.variacao > 0 && "text-destructive",
                      d.variacao < 0 && "text-success",
                      d.variacao === 0 && "text-muted-foreground",
                    )}>
                      {d.variacao > 0 ? "+" : ""}{d.variacao}%
                    </span>
                  </div>
                ))}
                <Separator className="my-2" />
                <p className="text-[10px] text-muted-foreground px-2">
                  {diffEntries.length} campo(s) com diferença detectada.
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
