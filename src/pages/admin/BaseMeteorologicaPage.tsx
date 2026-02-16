/**
 * BaseMeteorologicaPage — Canonical admin page for managing irradiance providers & versions.
 *
 * Architecture:
 *   - ALL mutations go through canonical RPCs (create_irradiance_version, activate_irradiance_version, etc.)
 *   - No critical logic in frontend — only orchestration
 *   - CSV parsing is client-side but insert goes through server-side RPC
 *   - Audit trail via database triggers on irradiance_dataset_versions
 *
 * Components:
 *   - ProviderCard: per-dataset card with status, actions, CSV import, lookup test
 *   - CsvImportPanel: file selection, validation, chunked upload
 *   - LookupTester: tests canonical RPC get_irradiance_for_simulation
 *   - VersionHistory: displays version list with status badges
 */

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Database, Globe, Loader2, Sun, Trash2, Zap, ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ProviderCard } from "./base-meteorologica/ProviderCard";
import type { DatasetConfig, DatasetRow, VersionRow } from "./base-meteorologica/types";

// ── Provider definitions ─────────────────────────────────
const DATASETS: DatasetConfig[] = [
  {
    code: "INPE_2017_SUNDATA",
    label: "Atlas Brasileiro 2ª Edição (INPE 2017 / SUNDATA / CRESESB)",
    type: "csv",
    icon: Sun,
    description: "Irradiância solar horizontal (GHI/DHI/DNI) — resolução 0.1° (~10km). Importação via CSV.",
  },
  {
    code: "INPE_2009_10KM",
    label: "Brazil Solar Global 10km (INPE 2009)",
    type: "csv",
    icon: Globe,
    description: "Grade brasileira de irradiância com resolução 10km. Importação via CSV.",
  },
  {
    code: "NASA_POWER_GLOBAL",
    label: "NASA POWER — Global Solar Resource",
    type: "api",
    icon: Zap,
    description: "Irradiância global via API NASA POWER (CERES/SSE). Sincronização por API.",
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

  useEffect(() => { if (auth === "authorized") loadData(); }, [auth, loadData]);

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

  return (
    <div className="space-y-5">
      {/* Header + Global Purge */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Database className="h-4 w-4" />
            Base Meteorológica — Providers & Versionamento
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Gerencie datasets de irradiância, versões e importações por provider.
            Todas as ativações são transacionais e auditadas.
          </p>
        </div>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="gap-1.5">
              <Trash2 className="h-3.5 w-3.5" />
              Limpar dados meteorológicos
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Limpar dados meteorológicos</AlertDialogTitle>
              <AlertDialogDescription className="space-y-3">
                <p>Esta ação remove pontos, versões e cache do provider selecionado.</p>
                <div className="space-y-2">
                  <Label className="text-xs">Provider</Label>
                  <Select value={purgeTarget} onValueChange={setPurgeTarget}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DATASETS.map(d => (
                        <SelectItem key={d.code} value={d.code} className="text-xs">{d.label}</SelectItem>
                      ))}
                      <SelectItem value="ALL" className="text-xs font-semibold">TODOS os providers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Digite LIMPAR para confirmar</Label>
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
      </div>

      <Separator />

      {/* Provider Cards */}
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

export default BaseMeteorologicaPage;
