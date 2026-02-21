import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { Plus, Trash2, Pencil, Building, Search, Filter, Info, RefreshCw, AlertTriangle, CheckCircle2, Clock, XCircle, FlaskConical, ChevronDown, ChevronRight, Upload } from "lucide-react";
import { ConcessionariaSubgruposPanel } from "./concessionarias/ConcessionariaSubgruposPanel";
import { Progress } from "@/components/ui/progress";
import { ImportCsvAneelDialog } from "./concessionarias/ImportCsvAneelDialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface Concessionaria {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  ativo: boolean;
  tarifa_energia: number | null;
  tarifa_fio_b: number | null;
  custo_disponibilidade_monofasico: number | null;
  custo_disponibilidade_bifasico: number | null;
  custo_disponibilidade_trifasico: number | null;
  aliquota_icms: number | null;
  possui_isencao_scee: boolean | null;
  percentual_isencao: number | null;
  ultima_sync_tarifas: string | null;
  created_at: string;
}

interface ConcessionariaForm {
  nome: string;
  sigla: string;
  estado: string;
  tarifa_energia: string;
  tarifa_fio_b: string;
  custo_disponibilidade_monofasico: string;
  custo_disponibilidade_bifasico: string;
  custo_disponibilidade_trifasico: string;
  aliquota_icms: string;
  possui_isencao_scee: boolean | null;
  percentual_isencao: string;
}

const ESTADOS_BRASIL = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA",
  "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN",
  "RS", "RO", "RR", "SC", "SP", "SE", "TO"
];

const EMPTY_FORM: ConcessionariaForm = {
  nome: "",
  sigla: "",
  estado: "",
  tarifa_energia: "",
  tarifa_fio_b: "",
  custo_disponibilidade_monofasico: "",
  custo_disponibilidade_bifasico: "",
  custo_disponibilidade_trifasico: "",
  aliquota_icms: "",
  possui_isencao_scee: null,
  percentual_isencao: "",
};

export function ConcessionariasManager() {
  const { toast } = useToast();
  const [concessionarias, setConcessionarias] = useState<Concessionaria[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Concessionaria | null>(null);
  const [deleting, setDeleting] = useState<Concessionaria | null>(null);
  const [form, setForm] = useState<ConcessionariaForm>(EMPTY_FORM);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterEstado, setFilterEstado] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [subgrupoCounts, setSubgrupoCounts] = useState<Record<string, { bt: number; mt: number }>>({});
  const [syncing, setSyncing] = useState(false);
  const [syncRunId, setSyncRunId] = useState<string | null>(null);
  const [syncProgress, setSyncProgress] = useState<{ status: string; totalUpdated: number; totalErrors: number; totalFetched: number; message: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [csvImportOpen, setCsvImportOpen] = useState(false);

  // Find the most recent sync timestamp across all concessionárias
  const latestSyncTimestamp = useMemo(() => {
    let latest = 0;
    for (const c of concessionarias) {
      if (c.ultima_sync_tarifas) {
        const ts = new Date(c.ultima_sync_tarifas).getTime();
        if (ts > latest) latest = ts;
      }
    }
    return latest;
  }, [concessionarias]);

  // Check if any concessionária needs tariff update (>12 months)
  const syncAlert = useMemo(() => {
    const now = new Date();
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, now.getDate());
    const outdated = concessionarias.filter(c => {
      if (!c.ultima_sync_tarifas) return true;
      return new Date(c.ultima_sync_tarifas) < twelveMonthsAgo;
    });
    return outdated.length > 0 ? outdated.length : 0;
  }, [concessionarias]);

  // Detect "legacy" concessionárias that were NOT updated in the latest sync
  const isLegacyConc = useCallback((c: Concessionaria): boolean => {
    if (!latestSyncTimestamp || !c.ultima_sync_tarifas) return false;
    const syncTs = new Date(c.ultima_sync_tarifas).getTime();
    // If the concessionária's sync is more than 1 hour behind the latest, it's legacy
    return (latestSyncTimestamp - syncTs) > 3600000;
  }, [latestSyncTimestamp]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const pollSyncStatus = useCallback((runId: string) => {
    let elapsed = 0;
    const POLL_INTERVAL = 2000;
    const MAX_POLL_TIME = 180000; // 3 min

    pollRef.current = setInterval(async () => {
      elapsed += POLL_INTERVAL;

      try {
        const { data, error } = await supabase
          .from("aneel_sync_runs")
          .select("status, total_fetched, total_matched, total_updated, total_errors, error_message, finished_at")
          .eq("id", runId)
          .single();

        if (error || !data) return;

        const isFinished = data.status !== "running";
        const totalUpdated = data.total_updated || 0;
        const totalErrors = data.total_errors || 0;
        const totalFetched = data.total_fetched || 0;

        let message = "Buscando tarifas na API ANEEL...";
        if (totalFetched > 0 && !isFinished) {
          message = `Processando ${totalFetched} registros ANEEL... ${totalUpdated} atualizados`;
        }

        if (isFinished) {
          if (data.status === "success") {
            message = `✅ Concluído: ${totalUpdated} tarifa(s) atualizada(s)`;
          } else if (data.status === "partial") {
            message = `⚠️ Parcial: ${totalUpdated} atualizada(s), ${totalErrors} erro(s)`;
          } else if (data.status === "error") {
            message = `❌ Erro: ${data.error_message || "Falha na sincronização"}`;
          } else if (data.status === "test_run") {
            message = `🧪 Test run: ${totalUpdated} registro(s) seriam atualizados`;
          }

          setSyncProgress({ status: data.status, totalUpdated, totalErrors, totalFetched, message });
          stopPolling();
          setSyncing(false);
          fetchData();

          toast({
            title: data.status === "error" ? "Erro na sincronização" : "Sincronização concluída",
            description: message.replace(/[✅⚠️❌🧪]\s?/, ""),
            variant: data.status === "error" ? "destructive" : "default",
          });

          // Clear progress after 10s
          setTimeout(() => setSyncProgress(null), 10000);
          return;
        }

        setSyncProgress({ status: "running", totalUpdated, totalErrors, totalFetched, message });
      } catch {
        // ignore poll errors
      }

      if (elapsed >= MAX_POLL_TIME) {
        stopPolling();
        setSyncing(false);
        setSyncProgress({ status: "timeout", totalUpdated: 0, totalErrors: 0, totalFetched: 0, message: "Timeout: a sincronização pode ainda estar rodando em background." });
        toast({
          title: "Tempo limite excedido",
          description: "A sincronização pode ainda estar rodando. Recarregue a página em alguns minutos.",
          variant: "destructive",
        });
        setTimeout(() => setSyncProgress(null), 15000);
      }
    }, POLL_INTERVAL);
  }, [stopPolling, toast]);

  const handleSyncTarifas = async () => {
    setSyncing(true);
    setSyncProgress({ status: "running", totalUpdated: 0, totalErrors: 0, totalFetched: 0, message: "Iniciando sincronização..." });

    try {
      // Fire the edge function - don't await for completion (it may timeout)
      const responsePromise = supabase.functions.invoke("sync-tarifas-aneel");

      // Wait briefly to get the run_id from the initial response
      const raceResult = await Promise.race([
        responsePromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 8000)),
      ]);

      if (raceResult && 'data' in raceResult && raceResult.data?.run_id) {
        // Got run_id - poll for progress
        setSyncRunId(raceResult.data.run_id);
        pollSyncStatus(raceResult.data.run_id);

        // If the response already has final results
        if (raceResult.data.success !== undefined && raceResult.data.status !== "running") {
          stopPolling();
          const d = raceResult.data;
          const totalUpdated = (d.resultados?.length || 0);
          const totalErrors = (d.erros?.length || 0);
          const message = d.message || `${totalUpdated} atualizada(s), ${totalErrors} erro(s)`;
          setSyncProgress({ status: d.status || "success", totalUpdated, totalErrors, totalFetched: (d.total_aneel_bt || 0) + (d.total_aneel_mt || 0), message: `✅ ${message}` });
          setSyncing(false);
          fetchData();
          toast({ title: "Sincronização concluída", description: message });
          setTimeout(() => setSyncProgress(null), 10000);
          return;
        }
      } else {
        // Didn't get run_id quickly - find most recent running sync
        const { data: latestRun } = await supabase
          .from("aneel_sync_runs")
          .select("id")
          .eq("status", "running")
          .order("started_at", { ascending: false })
          .limit(1)
          .single();

        if (latestRun?.id) {
          setSyncRunId(latestRun.id);
          pollSyncStatus(latestRun.id);
        } else {
          // No run found - just wait for the response
          const result = await responsePromise;
          if (result.error) {
            throw new Error(result.error.message || "Erro ao sincronizar");
          }
          setSyncing(false);
          setSyncProgress(null);
          fetchData();
        }
      }
    } catch (error: any) {
      setSyncing(false);
      setSyncProgress({ status: "error", totalUpdated: 0, totalErrors: 0, totalFetched: 0, message: `❌ ${error.message || "Erro ao sincronizar"}` });
      toast({
        title: "Erro ao sincronizar tarifas",
        description: error.message || "Tente novamente em alguns minutos",
        variant: "destructive",
      });
      setTimeout(() => setSyncProgress(null), 10000);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [concResult, subgrupoResult] = await Promise.all([
        supabase
          .from("concessionarias")
          .select("*")
          .order("estado", { ascending: true })
          .order("nome", { ascending: true }),
        supabase
          .from("concessionaria_tarifas_subgrupo")
          .select("concessionaria_id, subgrupo"),
      ]);

      if (concResult.error) throw concResult.error;
      setConcessionarias(concResult.data || []);

      // Count BT/MT subgrupos per concessionária
      const counts: Record<string, { bt: number; mt: number }> = {};
      for (const row of subgrupoResult.data || []) {
        if (!counts[row.concessionaria_id]) counts[row.concessionaria_id] = { bt: 0, mt: 0 };
        if (row.subgrupo.startsWith("A")) {
          counts[row.concessionaria_id].mt++;
        } else {
          counts[row.concessionaria_id].bt++;
        }
      }
      setSubgrupoCounts(counts);
    } catch (error: any) {
      toast({
        title: "Erro ao carregar concessionárias",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (concessionaria?: Concessionaria) => {
    if (concessionaria) {
      setEditing(concessionaria);
      setForm({
        nome: concessionaria.nome,
        sigla: concessionaria.sigla || "",
        estado: concessionaria.estado || "",
        tarifa_energia: concessionaria.tarifa_energia?.toString() || "",
        tarifa_fio_b: concessionaria.tarifa_fio_b?.toString() || "",
        custo_disponibilidade_monofasico: concessionaria.custo_disponibilidade_monofasico?.toString() || "",
        custo_disponibilidade_bifasico: concessionaria.custo_disponibilidade_bifasico?.toString() || "",
        custo_disponibilidade_trifasico: concessionaria.custo_disponibilidade_trifasico?.toString() || "",
        aliquota_icms: concessionaria.aliquota_icms?.toString() || "",
        possui_isencao_scee: concessionaria.possui_isencao_scee,
        percentual_isencao: concessionaria.percentual_isencao?.toString() || "",
      });
    } else {
      setEditing(null);
      setForm(EMPTY_FORM);
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      toast({ title: "Informe o nome da concessionária", variant: "destructive" });
      return;
    }

    try {
      const parseNum = (v: string) => v.trim() ? parseFloat(v) : null;

      const payload = {
        nome: form.nome.trim(),
        sigla: form.sigla.trim() || null,
        estado: form.estado || null,
        tarifa_energia: parseNum(form.tarifa_energia),
        tarifa_fio_b: parseNum(form.tarifa_fio_b),
        custo_disponibilidade_monofasico: parseNum(form.custo_disponibilidade_monofasico),
        custo_disponibilidade_bifasico: parseNum(form.custo_disponibilidade_bifasico),
        custo_disponibilidade_trifasico: parseNum(form.custo_disponibilidade_trifasico),
        aliquota_icms: parseNum(form.aliquota_icms),
        possui_isencao_scee: form.possui_isencao_scee,
        percentual_isencao: parseNum(form.percentual_isencao),
      };

      if (editing) {
        const { error } = await supabase
          .from("concessionarias")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
        toast({ title: "Concessionária atualizada com sucesso" });
      } else {
        const { error } = await supabase
          .from("concessionarias")
          .insert(payload);
        if (error) throw error;
        toast({ title: "Concessionária cadastrada com sucesso" });
      }
      setDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    }
  };

  const handleToggleAtivo = async (concessionaria: Concessionaria) => {
    try {
      const { error } = await supabase
        .from("concessionarias")
        .update({ ativo: !concessionaria.ativo })
        .eq("id", concessionaria.id);
      if (error) throw error;
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      const { error } = await supabase
        .from("concessionarias")
        .delete()
        .eq("id", deleting.id);
      if (error) throw error;
      toast({ title: "Concessionária excluída" });
      setDeleting(null);
      fetchData();
    } catch (error: any) {
      toast({ title: "Erro ao excluir", description: error.message, variant: "destructive" });
    }
  };

  const filteredConcessionarias = concessionarias.filter(c => {
    const matchesSearch = searchTerm === "" || 
      c.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (c.sigla && c.sigla.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesEstado = filterEstado === "all" || c.estado === filterEstado;
    const matchesStatus = filterStatus === "all" || 
      (filterStatus === "ativo" && c.ativo) || 
      (filterStatus === "inativo" && !c.ativo);
    return matchesSearch && matchesEstado && matchesStatus;
  });

  const hasActiveFilters = filterEstado !== "all" || filterStatus !== "all" || searchTerm !== "";
  
  const clearFilters = () => {
    setSearchTerm("");
    setFilterEstado("all");
    setFilterStatus("all");
  };

  const updateForm = (field: keyof ConcessionariaForm, value: any) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return <div className="flex justify-center p-8">Carregando...</div>;
  }

  return (
    <Card className="rounded-xl border-2 border-border/60">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Concessionárias de Energia
          </CardTitle>
          <CardDescription className="mt-1">
            Cadastre concessionárias com tarifas, custos de disponibilidade e tributação (ICMS) específicos.
          </CardDescription>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            onClick={() => handleSyncTarifas()}
            disabled={syncing}
            className="gap-2"
            title="Buscar tarifas atualizadas da ANEEL (Dados Abertos)"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? "animate-spin" : ""}`} />
            {syncing ? "Sincronizando..." : "Sincronizar ANEEL"}
          </Button>
          <Button
            variant="outline"
            onClick={() => setCsvImportOpen(true)}
            className="gap-2"
            title="Importar tarifas de um arquivo CSV baixado do site da ANEEL"
          >
            <Upload className="w-4 h-4" />
            Importar CSV
          </Button>
          <Button onClick={() => openDialog()} className="gap-2">
            <Plus className="w-4 h-4" />
            Nova Concessionária
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Sync progress bar */}
        {syncProgress && (
          <div className="mb-4 p-3 rounded-lg border border-border/60 bg-muted/30 space-y-2">
            <div className="flex items-center gap-2">
              {syncProgress.status === "running" && <RefreshCw className="w-4 h-4 animate-spin text-primary" />}
              {syncProgress.status === "success" && <CheckCircle2 className="w-4 h-4 text-success" />}
              {syncProgress.status === "partial" && <AlertTriangle className="w-4 h-4 text-warning" />}
              {syncProgress.status === "error" && <XCircle className="w-4 h-4 text-destructive" />}
              {syncProgress.status === "test_run" && <FlaskConical className="w-4 h-4 text-info" />}
              {syncProgress.status === "timeout" && <Clock className="w-4 h-4 text-warning" />}
              <span className="text-sm font-medium">{syncProgress.message}</span>
            </div>
            {syncProgress.status === "running" && (
              <Progress value={undefined} className="h-2" />
            )}
            {syncProgress.totalFetched > 0 && syncProgress.status !== "running" && (
              <div className="flex gap-4 text-xs text-muted-foreground">
                <span>{syncProgress.totalFetched} registros ANEEL</span>
                <span>{syncProgress.totalUpdated} atualizados</span>
                {syncProgress.totalErrors > 0 && <span className="text-destructive">{syncProgress.totalErrors} erros</span>}
              </div>
            )}
          </div>
        )}

        {/* Sync alert */}
        {syncAlert > 0 && (
          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
            <div className="text-xs text-muted-foreground">
              <strong className="text-foreground">{syncAlert} concessionária(s)</strong> sem sincronização de tarifas nos últimos 12 meses.{" "}
              <button
                onClick={handleSyncTarifas}
                disabled={syncing}
                className="text-primary underline hover:no-underline font-medium"
              >
                Sincronizar agora
              </button>
            </div>
          </div>
        )}

        {/* Info banner */}
        <div className="p-3 rounded-lg bg-info/5 border border-info/20 flex items-start gap-2 mb-4">
          <Info className="w-4 h-4 text-info mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Cada concessionária pode ter sua própria configuração de ICMS e isenção SCEE. Quando não
             definido, o sistema usa o padrão do estado (aba ICMS/Tributação). A sincronização busca tarifas
             BT (B1, B2, B3) e MT (Grupo A — A1 a A4, AS) com Ponta/Fora Ponta da API ANEEL. Clique em uma concessionária para ver os subgrupos.
          </p>
        </div>

        <div className="flex flex-col gap-4 mb-4">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou sigla..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Filter className="w-4 h-4" />
              <span>Filtros:</span>
            </div>

            <Select value={filterEstado} onValueChange={setFilterEstado}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Estados</SelectItem>
                {ESTADOS_BRASIL.map((uf) => (
                  <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[120px] h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Status</SelectItem>
                <SelectItem value="ativo">Ativos</SelectItem>
                <SelectItem value="inativo">Inativos</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground hover:text-foreground"
              >
                Limpar filtros
              </Button>
            )}

            <span className="text-sm text-muted-foreground ml-auto">
              {filteredConcessionarias.length} concessionária(s)
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <Table>
             <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Sigla</TableHead>
                <TableHead>UF</TableHead>
                <TableHead>Subgrupos</TableHead>
                <TableHead>Tarifa</TableHead>
                <TableHead>Fio B</TableHead>
                <TableHead>ICMS</TableHead>
                <TableHead>Isenção</TableHead>
                <TableHead>Sync ANEEL</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredConcessionarias.length === 0 ? (
               <TableRow>
                  <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                    Nenhuma concessionária encontrada
                  </TableCell>
                </TableRow>
              ) : (
                filteredConcessionarias.map((c) => (
                  <React.Fragment key={c.id}>
                    <TableRow 
                      className={`cursor-pointer hover:bg-muted/40 transition-colors ${expandedId === c.id ? 'bg-muted/30' : ''}`} 
                      onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <div className={`p-0.5 rounded transition-colors ${expandedId === c.id ? 'bg-primary/10' : ''}`}>
                            {expandedId === c.id ? <ChevronDown className="w-4 h-4 text-primary shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
                          </div>
                          {c.nome}
                        </div>
                      </TableCell>
                      <TableCell>{c.sigla || "-"}</TableCell>
                      <TableCell>
                        {c.estado ? (
                          <Badge variant="outline" className="font-mono">{c.estado}</Badge>
                        ) : "-"}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const counts = subgrupoCounts[c.id];
                          if (!counts || (counts.bt === 0 && counts.mt === 0)) {
                            return <span className="text-xs text-muted-foreground">—</span>;
                          }
                          return (
                            <div className="flex items-center gap-1">
                              {counts.bt > 0 && (
                                <Badge variant="outline" className="text-[9px] bg-success/10 text-success border-success/30 font-mono">
                                  B:{counts.bt}
                                </Badge>
                              )}
                              {counts.mt > 0 && (
                                <Badge variant="outline" className="text-[9px] bg-primary/10 text-primary border-primary/30 font-mono">
                                  A:{counts.mt}
                                </Badge>
                              )}
                            </div>
                          );
                        })()}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.tarifa_energia != null ? `R$ ${Number(c.tarifa_energia).toFixed(2)}` : (
                          <span className="text-muted-foreground">padrão</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.tarifa_fio_b != null && Number(c.tarifa_fio_b) > 0 ? `R$ ${Number(c.tarifa_fio_b).toFixed(2)}` : (
                          <span className="text-muted-foreground">padrão</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {c.aliquota_icms != null ? `${Number(c.aliquota_icms).toFixed(1)}%` : (
                          <span className="text-muted-foreground">estado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {c.possui_isencao_scee != null ? (
                          <Badge variant={c.possui_isencao_scee ? "default" : "secondary"} className="text-xs">
                            {c.possui_isencao_scee ? "Sim" : "Não"}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">estado</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {(() => {
                          if (!c.ultima_sync_tarifas) {
                            return (
                              <Badge variant="outline" className="gap-1 text-[10px] text-muted-foreground border-muted-foreground/30">
                                <XCircle className="h-3 w-3" />
                                Nunca
                              </Badge>
                            );
                          }
                          const legacy = isLegacyConc(c);
                          if (legacy) {
                            return (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge variant="outline" className="gap-1 text-[10px] text-warning border-warning/30 bg-warning/10 cursor-help">
                                    <AlertTriangle className="h-3 w-3" />
                                    Legado
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent side="top" className="max-w-[220px] text-xs">
                                  Não encontrada na API ANEEL. Tarifas precisam ser gerenciadas manualmente.
                                </TooltipContent>
                              </Tooltip>
                            );
                          }
                          const syncDate = new Date(c.ultima_sync_tarifas);
                          const monthsAgo = Math.floor((Date.now() - syncDate.getTime()) / (1000 * 60 * 60 * 24 * 30));
                          const isRecent = monthsAgo < 6;
                          const isOutdated = monthsAgo >= 12;
                          const dateStr = syncDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                          return (
                            <Badge
                              variant="outline"
                              className={`gap-1 text-[10px] ${
                                isRecent ? "text-success border-success/30 bg-success/5"
                                : isOutdated ? "text-destructive border-destructive/30 bg-destructive/5"
                                : "text-warning border-warning/30 bg-warning/5"
                              }`}
                            >
                              {isRecent ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
                              {dateStr}
                            </Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                          <Switch
                            checked={c.ativo}
                            onCheckedChange={() => handleToggleAtivo(c)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openDialog(c)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(c)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedId === c.id && (
                      <TableRow>
                        <TableCell colSpan={12} className="p-0 bg-muted/20">
                          <ConcessionariaSubgruposPanel
                            concessionariaId={c.id}
                            concessionariaNome={c.nome}
                          />
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Add/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building className="w-5 h-5" />
                {editing ? "Editar Concessionária" : "Nova Concessionária"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-5">
              {/* Dados Básicos */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Dados Básicos</h4>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome *</Label>
                  <Input
                    id="nome"
                    placeholder="Ex: Light Serviços de Eletricidade"
                    value={form.nome}
                    onChange={(e) => updateForm("nome", e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="sigla">Sigla</Label>
                    <Input
                      id="sigla"
                      placeholder="Ex: LIGHT"
                      value={form.sigla}
                      onChange={(e) => updateForm("sigla", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="estado">Estado</Label>
                    <Select value={form.estado} onValueChange={(v) => updateForm("estado", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="UF" />
                      </SelectTrigger>
                      <SelectContent>
                        {ESTADOS_BRASIL.map((uf) => (
                          <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Tarifas */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Tarifas (R$/kWh)</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tarifa Energia</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 0.85"
                      value={form.tarifa_energia}
                      onChange={(e) => updateForm("tarifa_energia", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tarifa Fio B</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="Ex: 0.40"
                      value={form.tarifa_fio_b}
                      onChange={(e) => updateForm("tarifa_fio_b", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* Custo Disponibilidade */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-muted-foreground">Custo Disponibilidade (R$)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Monofásico</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="30"
                      value={form.custo_disponibilidade_monofasico}
                      onChange={(e) => updateForm("custo_disponibilidade_monofasico", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bifásico</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="50"
                      value={form.custo_disponibilidade_bifasico}
                      onChange={(e) => updateForm("custo_disponibilidade_bifasico", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Trifásico</Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="100"
                      value={form.custo_disponibilidade_trifasico}
                      onChange={(e) => updateForm("custo_disponibilidade_trifasico", e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <Separator />

              {/* ICMS / Tributação */}
              <div className="space-y-3">
                <h4 className="text-sm font-semibold flex items-center gap-2 text-muted-foreground">
                  <Building className="w-4 h-4" />
                  Tributação ICMS
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  Deixe vazio para usar o padrão do estado. Configure aqui se esta concessionária tem regras
                  de ICMS ou isenção SCEE diferentes do padrão estadual.
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Alíquota ICMS (%)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min={0}
                      max={40}
                      placeholder="Usar do estado"
                      value={form.aliquota_icms}
                      onChange={(e) => updateForm("aliquota_icms", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">% Isenção SCEE</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      placeholder="Usar do estado"
                      value={form.percentual_isencao}
                      onChange={(e) => updateForm("percentual_isencao", e.target.value)}
                      disabled={form.possui_isencao_scee === false}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Label className="text-xs">Isenção SCEE:</Label>
                  <div className="flex items-center gap-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant={form.possui_isencao_scee === null ? "default" : "outline"}
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => updateForm("possui_isencao_scee", null)}
                          >
                            Padrão UF
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Usar configuração do estado</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                    <Button
                      type="button"
                      variant={form.possui_isencao_scee === true ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => updateForm("possui_isencao_scee", true)}
                    >
                      Sim
                    </Button>
                    <Button
                      type="button"
                      variant={form.possui_isencao_scee === false ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => updateForm("possui_isencao_scee", false)}
                    >
                      Não
                    </Button>
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSave}>Salvar alterações</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleting} onOpenChange={() => setDeleting(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir Concessionária?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A concessionária "{deleting?.nome}" será
                removida permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>

      <ImportCsvAneelDialog
        open={csvImportOpen}
        onOpenChange={setCsvImportOpen}
        onImportComplete={fetchData}
      />
    </Card>
  );
}
