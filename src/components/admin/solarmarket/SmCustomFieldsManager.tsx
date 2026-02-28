import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Plus, Trash2, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

// ─── Types ──────────────────────────────────────────────

interface CfDefinition {
  id: string;
  sm_custom_field_id: number;
  key: string | null;
  name: string | null;
  field_type: string | null;
  is_active: boolean;
  version_hash: string | null;
  synced_at: string;
}

interface CfMapping {
  id: string;
  source_key: string;
  target_namespace: string;
  target_path: string;
  transform: string;
  priority: number;
  is_active: boolean;
}

// ─── Hooks ──────────────────────────────────────────────

function useCfDefinitions() {
  return useQuery<CfDefinition[]>({
    queryKey: ["sm-cf-definitions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("solar_market_custom_fields")
        .select("id, sm_custom_field_id, key, name, field_type, is_active, version_hash, synced_at")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

function useCfMappings() {
  return useQuery<CfMapping[]>({
    queryKey: ["sm-cf-mappings"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("custom_field_mappings")
        .select("id, source_key, target_namespace, target_path, transform, priority, is_active")
        .order("priority");
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Component ──────────────────────────────────────────

const NAMESPACES = [
  { value: "proposal", label: "Proposta" },
  { value: "client", label: "Cliente" },
  { value: "project", label: "Projeto" },
  { value: "finance", label: "Financeiro" },
  { value: "tags", label: "Tags" },
  { value: "metadata", label: "Metadados" },
];

const TRANSFORMS = [
  { value: "string", label: "Texto" },
  { value: "number", label: "Número" },
  { value: "number_br", label: "Número (PT-BR)" },
  { value: "boolean", label: "Booleano" },
  { value: "date_br", label: "Data (DD/MM/YYYY)" },
  { value: "json", label: "JSON" },
];

export default function SmCustomFieldsManager() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: definitions = [], isLoading: loadingDefs } = useCfDefinitions();
  const { data: mappings = [], isLoading: loadingMappings } = useCfMappings();
  const [syncing, setSyncing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);

  // ─── Sync mutation ──────────────────────────────────────
  const syncFields = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("solarmarket-sync", {
        body: { sync_type: "custom_fields" },
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["sm-cf-definitions"] });
      toast({ title: "Campos sincronizados com sucesso" });
    } catch (e: any) {
      toast({ title: "Erro ao sincronizar", description: e.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  // ─── Backfill mutation ─────────────────────────────────
  const backfillCfRaw = async () => {
    setBackfilling(true);
    try {
      const { data, error } = await supabase.functions.invoke("solarmarket-sync", {
        body: { sync_type: "backfill_cf_raw" },
      });
      if (error) throw error;
      const upserted = data?.total_upserted || 0;
      toast({ title: `Backfill concluído: ${upserted} propostas enriquecidas` });
    } catch (e: any) {
      toast({ title: "Erro no backfill", description: e.message, variant: "destructive" });
    } finally {
      setBackfilling(false);
    }
  };

  // ─── Mapping CRUD ──────────────────────────────────────
  const upsertMapping = useMutation({
    mutationFn: async (mapping: Partial<CfMapping> & { source_key: string }) => {
      const { error } = await (supabase as any)
        .from("custom_field_mappings")
        .upsert({
          ...mapping,
          source_provider: "solarmarket",
          is_active: mapping.is_active ?? true,
          priority: mapping.priority ?? 100,
          transform: mapping.transform || "string",
          target_namespace: mapping.target_namespace || "metadata",
          target_path: mapping.target_path || "",
        }, { onConflict: "tenant_id,source_provider,source_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sm-cf-mappings"] });
      toast({ title: "Mapeamento salvo" });
    },
    onError: (e: Error) => toast({ title: "Erro", description: e.message, variant: "destructive" }),
  });

  const deleteMapping = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("custom_field_mappings").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sm-cf-mappings"] });
      toast({ title: "Mapeamento removido" });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Campos Personalizados SolarMarket</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={syncFields} disabled={syncing || backfilling}>
            {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
            Sincronizar Definições
          </Button>
          <Button size="sm" variant="outline" onClick={backfillCfRaw} disabled={backfilling || syncing}>
            {backfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
            Backfill CF Raw
          </Button>
        </div>
      </div>

      <Tabs defaultValue="definitions" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="definitions">Definições ({definitions.length})</TabsTrigger>
          <TabsTrigger value="mappings">Mapeamentos ({mappings.length})</TabsTrigger>
        </TabsList>

        {/* ─── Definitions Tab ──────────────────────────────── */}
        <TabsContent value="definitions">
          {loadingDefs ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
            </div>
          ) : (
            <div className="border rounded-lg overflow-auto max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Key</TableHead>
                    <TableHead className="text-xs">Label</TableHead>
                    <TableHead className="text-xs">Tipo</TableHead>
                    <TableHead className="text-xs">Ativo</TableHead>
                    <TableHead className="text-xs">Mapeado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {definitions.map((d) => {
                    const mapped = mappings.find((m) => m.source_key === d.key);
                    return (
                      <TableRow key={d.id}>
                        <TableCell className="text-xs font-mono">{d.key}</TableCell>
                        <TableCell className="text-xs">{d.name}</TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-[10px]">{d.field_type || "?"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={d.is_active ? "default" : "outline"} className="text-[10px]">
                            {d.is_active ? "Sim" : "Não"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {mapped ? (
                            <Badge className="text-[10px]">{mapped.target_namespace}.{mapped.target_path}</Badge>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {/* ─── Mappings Tab ─────────────────────────────────── */}
        <TabsContent value="mappings">
          <MappingsEditor
            definitions={definitions}
            mappings={mappings}
            loading={loadingMappings}
            onSave={(m) => upsertMapping.mutate(m)}
            onDelete={(id) => deleteMapping.mutate(id)}
            saving={upsertMapping.isPending}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Mappings Editor ────────────────────────────────────

function MappingsEditor({
  definitions, mappings, loading, onSave, onDelete, saving,
}: {
  definitions: CfDefinition[];
  mappings: CfMapping[];
  loading: boolean;
  onSave: (m: Partial<CfMapping> & { source_key: string }) => void;
  onDelete: (id: string) => void;
  saving: boolean;
}) {
  const [newKey, setNewKey] = useState("");
  const [newNs, setNewNs] = useState("metadata");
  const [newPath, setNewPath] = useState("");
  const [newTransform, setNewTransform] = useState("string");

  if (loading) {
    return <div className="flex items-center justify-center py-8 text-muted-foreground gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando...</div>;
  }

  const unmappedDefs = definitions.filter((d) => d.key && !mappings.find((m) => m.source_key === d.key));

  return (
    <div className="space-y-4">
      {/* Existing mappings */}
      {mappings.length > 0 && (
        <div className="border rounded-lg overflow-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Campo Origem</TableHead>
                <TableHead className="text-xs">Destino</TableHead>
                <TableHead className="text-xs">Caminho</TableHead>
                <TableHead className="text-xs">Transform</TableHead>
                <TableHead className="text-xs w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((m) => (
                <TableRow key={m.id}>
                  <TableCell className="text-xs font-mono">{m.source_key}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{m.target_namespace}</Badge></TableCell>
                  <TableCell className="text-xs">{m.target_path}</TableCell>
                  <TableCell className="text-xs">{m.transform}</TableCell>
                  <TableCell>
                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => onDelete(m.id)}>
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Add new mapping */}
      <div className="border rounded-lg p-3 space-y-3">
        <Label className="text-xs font-semibold">Novo Mapeamento</Label>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Select value={newKey} onValueChange={setNewKey}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Campo origem" /></SelectTrigger>
            <SelectContent>
              {unmappedDefs.map((d) => (
                <SelectItem key={d.key!} value={d.key!} className="text-xs">{d.name || d.key} ({d.field_type})</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newNs} onValueChange={setNewNs}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {NAMESPACES.map((n) => <SelectItem key={n.value} value={n.value} className="text-xs">{n.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input value={newPath} onChange={(e) => setNewPath(e.target.value)} placeholder="ex: client.document" className="h-8 text-xs" />
          <Select value={newTransform} onValueChange={setNewTransform}>
            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TRANSFORMS.map((t) => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button
          size="sm"
          disabled={!newKey || saving}
          onClick={() => {
            onSave({ source_key: newKey, target_namespace: newNs, target_path: newPath, transform: newTransform });
            setNewKey("");
            setNewPath("");
          }}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
          Adicionar
        </Button>
      </div>
    </div>
  );
}

