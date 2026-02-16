/**
 * BaseMeteorologicaPage — Admin page for managing solar irradiance data.
 * 
 * Redesigned for clarity:
 * - Dashboard summary at top (total points, active providers, health status)
 * - Provider cards with visual progress and clear status
 * - Auto-cleanup of stuck versions
 * - Simplified language for non-technical admins
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Database, Globe, Loader2, Sun, Trash2, Zap, ShieldAlert,
  CheckCircle2, AlertTriangle, MapPin, BarChart3, Clock, Layers,
} from "lucide-react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProviderCard } from "./base-meteorologica/ProviderCard";
import type { DatasetConfig, DatasetRow, VersionRow } from "./base-meteorologica/types";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Provider definitions ─────────────────────────────────
const DATASETS: DatasetConfig[] = [
  {
    code: "INPE_2017_SUNDATA",
    label: "Atlas Brasileiro 2ª Ed. (INPE 2017)",
    type: "csv",
    icon: Sun,
    description: "Base oficial brasileira de irradiância solar — dados de GHI, DHI e DNI para todo o Brasil.",
  },
  {
    code: "INPE_2009_10KM",
    label: "Atlas Solar Brasil 10km (INPE 2009)",
    type: "csv",
    icon: Globe,
    description: "Grade com resolução de 10km sobre o território brasileiro.",
  },
  {
    code: "NASA_POWER_GLOBAL",
    label: "NASA POWER — Dados Globais",
    type: "api",
    icon: Zap,
    description: "Dados globais de irradiância via API da NASA (cobertura mundial).",
  },
];

// ── Auth Guard ───────────────────────────────────────────
function useAdminGuard() {
  const [state, setState] = useState<"loading" | "authorized" | "denied">("loading");
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setState("denied"); return; }
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      const isAdmin = roles?.some((r: any) => ["admin", "super_admin", "gerente"].includes(r.role));
      setState(isAdmin ? "authorized" : "denied");
    })();
  }, []);
  return state;
}

// ── Main Page ────────────────────────────────────────────
export function BaseMeteorologicaPage() {
  const auth = useAdminGuard();
  const [datasets, setDatasets] = useState<DatasetRow[]>([]);
  const [versions, setVersions] = useState<VersionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [cleanedUp, setCleanedUp] = useState(false);

  // Purge state
  const [purgeTarget, setPurgeTarget] = useState<string>("ALL");
  const [purgeConfirm, setPurgeConfirm] = useState("");
  const [purging, setPurging] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [dsRes, verRes] = await Promise.all([
      supabase.from("irradiance_datasets").select("id, code, name").order("code"),
      supabase.from("irradiance_dataset_versions").select("*").order("created_at", { ascending: false }),
    ]);
    if (dsRes.data) setDatasets(dsRes.data);
    if (verRes.data) setVersions(verRes.data as VersionRow[]);
    setLoading(false);
  }, []);

  // Auto-cleanup stuck versions on first load
  useEffect(() => {
    if (auth === "authorized" && !cleanedUp) {
      (async () => {
        try {
          const { data, error } = await supabase.rpc("cleanup_stuck_irradiance_versions" as any);
          if (!error && data && (data as number) > 0) {
            toast.info(`${data} versão(ões) travada(s) foram limpas automaticamente.`);
          }
        } catch { /* ignore */ }
        setCleanedUp(true);
        loadData();
      })();
    } else if (auth === "authorized" && cleanedUp) {
      loadData();
    }
  }, [auth, cleanedUp, loadData]);

  const getDatasetId = (code: string) => datasets.find(d => d.code === code)?.id;
  const getVersionsFor = (code: string) => {
    const dsId = getDatasetId(code);
    return dsId ? versions.filter(v => v.dataset_id === dsId) : [];
  };
  const getActiveVersion = (code: string) => getVersionsFor(code).find(v => v.status === "active");
  const getProcessingVersion = (code: string) => getVersionsFor(code).find(v => v.status === "processing");

  // Purge via canonical RPC
  const handlePurge = async () => {
    if (purgeConfirm !== "LIMPAR") return;
    setPurging(true);
    try {
      if (purgeTarget === "ALL") {
        for (const ds of datasets) {
          await supabase.rpc("purge_irradiance_dataset", { _dataset_id: ds.id });
        }
        toast.success("Todos os dados meteorológicos foram limpos.");
      } else {
        const dsId = getDatasetId(purgeTarget);
        if (!dsId) throw new Error("Dataset não encontrado");
        const { data, error } = await supabase.rpc("purge_irradiance_dataset", { _dataset_id: dsId });
        if (error) throw error;
        const r = data as any;
        toast.success(`${purgeTarget}: ${r?.points_deleted ?? 0} pontos removidos.`);
      }
      setPurgeConfirm("");
      loadData();
    } catch (e: any) {
      toast.error("Erro ao limpar", { description: e.message });
    } finally {
      setPurging(false);
    }
  };

  if (auth === "loading" || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (auth === "denied") {
    return (
      <Card className="max-w-md mx-auto mt-20 border-destructive/20">
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <ShieldAlert className="h-8 w-8 text-destructive" />
          <p className="text-sm font-medium">Acesso restrito</p>
          <p className="text-xs text-muted-foreground text-center">
            Esta página é exclusiva para administradores do sistema.
          </p>
        </CardContent>
      </Card>
    );
  }

  // ── Compute dashboard metrics ──
  const activeProviders = DATASETS.filter(ds => getActiveVersion(ds.code)).length;
  const totalPoints = versions
    .filter(v => v.status === "active")
    .reduce((sum, v) => sum + (v.row_count ?? 0), 0);
  const lastUpdated = versions.find(v => v.status === "active")?.created_at;
  const hasProcessing = DATASETS.some(ds => getProcessingVersion(ds.code));
  const healthPct = Math.round((activeProviders / DATASETS.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Database}
        title="Base de Dados Meteorológicos"
        description="Gerencie os dados de irradiância solar usados para calcular a geração prevista dos sistemas fotovoltaicos."
        actions={
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="gap-1.5">
                <Trash2 className="h-3.5 w-3.5" />
                Limpar Dados
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar dados meteorológicos</AlertDialogTitle>
                <AlertDialogDescription className="space-y-3">
                  <p>Esta ação remove todos os pontos, versões e cache do provider selecionado. Isso afetará o cálculo de geração solar.</p>
                  <div className="space-y-2">
                    <Label className="text-xs">Fonte de dados</Label>
                    <Select value={purgeTarget} onValueChange={setPurgeTarget}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DATASETS.map(d => (
                          <SelectItem key={d.code} value={d.code} className="text-xs">{d.label}</SelectItem>
                        ))}
                        <SelectItem value="ALL" className="text-xs font-semibold text-destructive">TODOS os dados</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Digite <span className="font-mono font-bold">LIMPAR</span> para confirmar</Label>
                    <Input
                      value={purgeConfirm}
                      onChange={e => setPurgeConfirm(e.target.value)}
                      placeholder="LIMPAR"
                      className="h-8 text-xs font-mono"
                    />
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="text-xs">Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handlePurge}
                  disabled={purgeConfirm !== "LIMPAR" || purging}
                  className="bg-destructive text-destructive-foreground text-xs"
                >
                  {purging ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Confirmar limpeza"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        }
      />

      {/* ── Dashboard Summary ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardCard
          icon={<BarChart3 className="h-4 w-4" />}
          label="Status Geral"
          value={
            activeProviders === DATASETS.length
              ? "Operacional"
              : activeProviders > 0
                ? "Parcial"
                : "Sem dados"
          }
          detail={`${activeProviders}/${DATASETS.length} fontes ativas`}
          color={activeProviders === DATASETS.length ? "text-success" : activeProviders > 0 ? "text-warning" : "text-destructive"}
          progress={healthPct}
        />
        <DashboardCard
          icon={<MapPin className="h-4 w-4" />}
          label="Pontos Geográficos"
          value={totalPoints.toLocaleString("pt-BR")}
          detail="pontos de irradiância carregados"
          color={totalPoints > 0 ? "text-primary" : "text-muted-foreground"}
        />
        <DashboardCard
          icon={<Clock className="h-4 w-4" />}
          label="Última Atualização"
          value={lastUpdated
            ? formatDistanceToNow(new Date(lastUpdated), { addSuffix: true, locale: ptBR })
            : "Nunca"
          }
          detail={lastUpdated ? new Date(lastUpdated).toLocaleDateString("pt-BR") : "Nenhum dado importado"}
          color={lastUpdated ? "text-foreground" : "text-muted-foreground"}
        />
        <DashboardCard
          icon={<Layers className="h-4 w-4" />}
          label="Versões"
          value={String(versions.length)}
          detail={
            hasProcessing
              ? "⏳ Importação em andamento"
              : `${versions.filter(v => v.status === "active").length} ativa(s)`
          }
          color={hasProcessing ? "text-warning" : "text-foreground"}
        />
      </div>

      {/* ── Alert when no data ── */}
      {totalPoints === 0 && (
        <Card className="border-warning/30 bg-warning/5 rounded-xl">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Nenhum dado de irradiância carregado</p>
              <p className="text-xs text-muted-foreground mt-1">
                O sistema precisa de dados meteorológicos para calcular a geração prevista dos sistemas solares.
                Importe dados de pelo menos uma fonte abaixo para habilitar os cálculos.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* ── Section Title ── */}
      <div>
        <h3 className="text-sm font-semibold text-foreground">Fontes de Dados</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Cada fonte fornece dados de irradiância solar de diferentes provedores. Você pode ter múltiplas fontes ativas simultaneamente.
        </p>
      </div>

      {/* ── Provider Cards ── */}
      <div className="grid gap-5">
        {DATASETS.map(ds => (
          <ProviderCard
            key={ds.code}
            config={ds}
            datasetId={getDatasetId(ds.code)}
            versions={getVersionsFor(ds.code)}
            activeVersion={getActiveVersion(ds.code)}
            processingVersion={getProcessingVersion(ds.code)}
            onReload={loadData}
          />
        ))}
      </div>
    </div>
  );
}

// ── Dashboard Card Component ──
function DashboardCard({
  icon,
  label,
  value,
  detail,
  color,
  progress,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
  color: string;
  progress?: number;
}) {
  return (
    <Card className="rounded-xl">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
        {progress !== undefined && (
          <Progress value={progress} className="h-1.5" />
        )}
        <p className="text-[11px] text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

export default BaseMeteorologicaPage;