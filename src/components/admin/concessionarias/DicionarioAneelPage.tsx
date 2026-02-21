import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { SearchInput } from "@/components/ui-kit/SearchInput";
import {
  Search, Link2, Link2Off, Plus, Trash2, Pencil, CheckCircle2,
  AlertTriangle, Info, ArrowRight, Sparkles, X, Building2,
} from "lucide-react";
import { normMatch, stripSuffixes } from "./importCsvAneelUtils";

// ─── Types ───
interface Concessionaria {
  id: string;
  nome: string;
  sigla: string | null;
  estado: string | null;
  ativo: boolean;
  nome_aneel_oficial: string | null;
}

interface AneelAlias {
  id: string;
  concessionaria_id: string;
  alias_aneel: string;
}

interface ConcWithAliases extends Concessionaria {
  aliases: AneelAlias[];
  status: "mapeada" | "nao_mapeada";
}

// ─── Constants ───
const ESTADOS = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA",
  "MT","MS","MG","PA","PB","PR","PE","PI","RJ","RN",
  "RS","RO","RR","SC","SP","SE","TO",
];

// ─── Main Component ───
export function DicionarioAneelPage() {
  const { toast } = useToast();
  const [concessionarias, setConcessionarias] = useState<ConcWithAliases[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterUf, setFilterUf] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  // Edit dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingConc, setEditingConc] = useState<ConcWithAliases | null>(null);
  const [editNomeAneel, setEditNomeAneel] = useState("");
  const [editAliases, setEditAliases] = useState<string[]>([]);
  const [newAlias, setNewAlias] = useState("");
  const [saving, setSaving] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);

  // ─── Data Loading ───
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [concRes, aliasRes, profileRes] = await Promise.all([
        supabase
          .from("concessionarias")
          .select("id, nome, sigla, estado, ativo, nome_aneel_oficial")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("concessionaria_aneel_aliases")
          .select("id, concessionaria_id, alias_aneel"),
        supabase
          .from("profiles")
          .select("tenant_id")
          .eq("id", (await supabase.auth.getUser()).data.user?.id || "")
          .maybeSingle(),
      ]);

      if (concRes.error) throw concRes.error;
      if (profileRes.data?.tenant_id) setTenantId(profileRes.data.tenant_id);

      const aliasMap = new Map<string, AneelAlias[]>();
      if (aliasRes.data) {
        for (const a of aliasRes.data) {
          const list = aliasMap.get(a.concessionaria_id) || [];
          list.push(a);
          aliasMap.set(a.concessionaria_id, list);
        }
      }

      const combined: ConcWithAliases[] = (concRes.data || []).map(c => {
        const aliases = aliasMap.get(c.id) || [];
        const isMapped = !!c.nome_aneel_oficial || aliases.length > 0;
        return {
          ...c,
          aliases,
          status: isMapped ? "mapeada" as const : "nao_mapeada" as const,
        };
      });

      setConcessionarias(combined);
    } catch (err) {
      toast({ title: "Erro ao carregar dados", description: String(err), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Filtering ───
  const filtered = useMemo(() => {
    return concessionarias.filter(c => {
      if (filterUf !== "all" && c.estado !== filterUf) return false;
      if (filterStatus === "mapeada" && c.status !== "mapeada") return false;
      if (filterStatus === "nao_mapeada" && c.status !== "nao_mapeada") return false;
      if (search) {
        const q = search.toLowerCase();
        const matchesName = c.nome.toLowerCase().includes(q);
        const matchesSigla = c.sigla?.toLowerCase().includes(q);
        const matchesAneel = c.nome_aneel_oficial?.toLowerCase().includes(q);
        const matchesAlias = c.aliases.some(a => a.alias_aneel.toLowerCase().includes(q));
        if (!matchesName && !matchesSigla && !matchesAneel && !matchesAlias) return false;
      }
      return true;
    });
  }, [concessionarias, search, filterUf, filterStatus]);

  // ─── Stats ───
  const stats = useMemo(() => {
    const total = concessionarias.length;
    const mapeadas = concessionarias.filter(c => c.status === "mapeada").length;
    return { total, mapeadas, naoMapeadas: total - mapeadas, pct: total > 0 ? Math.round((mapeadas / total) * 100) : 0 };
  }, [concessionarias]);

  // ─── Edit Dialog ───
  const openEdit = (c: ConcWithAliases) => {
    setEditingConc(c);
    setEditNomeAneel(c.nome_aneel_oficial || "");
    setEditAliases(c.aliases.map(a => a.alias_aneel));
    setNewAlias("");
    setEditDialogOpen(true);
  };

  const addAlias = () => {
    const trimmed = newAlias.trim();
    if (!trimmed) return;
    if (editAliases.some(a => a.toLowerCase() === trimmed.toLowerCase())) {
      toast({ title: "Alias já existe", variant: "destructive" });
      return;
    }
    setEditAliases(prev => [...prev, trimmed]);
    setNewAlias("");
  };

  const removeAlias = (idx: number) => {
    setEditAliases(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSave = async () => {
    if (!editingConc) return;
    setSaving(true);
    try {
      // 1. Update nome_aneel_oficial
      const { error: updErr } = await supabase
        .from("concessionarias")
        .update({ nome_aneel_oficial: editNomeAneel || null })
        .eq("id", editingConc.id);
      if (updErr) throw updErr;

      // 2. Sync aliases: delete removed, insert new
      const existingAliases = editingConc.aliases.map(a => a.alias_aneel);
      const toDelete = existingAliases.filter(a => !editAliases.includes(a));
      const toInsert = editAliases.filter(a => !existingAliases.includes(a));

      if (toDelete.length > 0) {
        const idsToDelete = editingConc.aliases
          .filter(a => toDelete.includes(a.alias_aneel))
          .map(a => a.id);
        if (idsToDelete.length > 0) {
          const { error } = await supabase
            .from("concessionaria_aneel_aliases")
            .delete()
            .in("id", idsToDelete);
          if (error) throw error;
        }
      }

      if (toInsert.length > 0 && tenantId) {
        const { error } = await supabase
          .from("concessionaria_aneel_aliases")
          .insert(toInsert.map(alias => ({
            concessionaria_id: editingConc.id,
            alias_aneel: alias,
            tenant_id: tenantId,
          })));
        if (error) throw error;
      }

      toast({ title: "Mapeamento salvo", description: `${editingConc.nome} atualizada com sucesso.` });
      setEditDialogOpen(false);
      loadData();
    } catch (err) {
      toast({ title: "Erro ao salvar", description: String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // ─── Auto-suggest (fuzzy) ───
  const handleAutoSuggest = (c: ConcWithAliases) => {
    // Generate suggestions based on known patterns
    const suggestions: string[] = [];
    const nome = c.nome.toLowerCase();
    const sigla = (c.sigla || "").toLowerCase();

    // Common ANEEL variations
    if (sigla) {
      suggestions.push(sigla.toUpperCase());
      suggestions.push(`${sigla.toUpperCase()}-D`);
      suggestions.push(`${sigla.toUpperCase()} DIS`);
    }

    // State-based name for Neoenergia/Equatorial groups
    const stateNames: Record<string, string> = {
      BA: "Bahia", PE: "Pernambuco", RN: "Rio Grande do Norte", DF: "Brasília",
      AL: "Alagoas", GO: "Goiás", MA: "Maranhão", PA: "Pará", PI: "Piauí",
      CE: "Ceará", RJ: "Rio de Janeiro", SP: "São Paulo", ES: "Espírito Santo",
      PB: "Paraíba", PR: "Paraná", RO: "Rondônia", SE: "Sergipe", TO: "Tocantins",
      MG: "Minas Gerais", MS: "Mato Grosso do Sul", MT: "Mato Grosso",
      RS: "Rio Grande do Sul", SC: "Santa Catarina", AC: "Acre", AM: "Amazonas",
      AP: "Amapá", RR: "Roraima",
    };

    if (c.estado && stateNames[c.estado]) {
      const groups = ["Neoenergia", "Equatorial", "Energisa", "Enel", "CPFL"];
      for (const group of groups) {
        if (nome.includes(group.toLowerCase())) {
          suggestions.push(`${group} ${stateNames[c.estado]}`);
          suggestions.push(`${group} ${c.estado}`);
        }
      }
    }

    // Filter out already-used aliases
    const existing = new Set([
      ...(c.nome_aneel_oficial ? [c.nome_aneel_oficial.toLowerCase()] : []),
      ...c.aliases.map(a => a.alias_aneel.toLowerCase()),
    ]);
    const unique = suggestions.filter(s => !existing.has(s.toLowerCase()));

    if (unique.length === 0) {
      toast({ title: "Sem sugestões", description: "Não encontramos variações comuns para esta concessionária." });
      return;
    }

    // Open edit dialog with suggestions pre-filled
    setEditingConc(c);
    setEditNomeAneel(c.nome_aneel_oficial || unique[0] || "");
    setEditAliases([...c.aliases.map(a => a.alias_aneel), ...unique.slice(0, 5)]);
    setNewAlias("");
    setEditDialogOpen(true);
  };

  // ─── Render ───
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Dicionário ANEEL
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Mapeie as concessionárias do sistema com os nomes oficiais da ANEEL para garantir importações corretas.
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Total</p>
                <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              </div>
              <Building2 className="h-8 w-8 text-muted-foreground/30" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Mapeadas</p>
                <p className="text-2xl font-bold tabular-nums text-success">{stats.mapeadas}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-success/30" />
            </div>
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-success rounded-full transition-all duration-500"
                style={{ width: `${stats.pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">{stats.pct}% do total</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Não mapeadas</p>
                <p className="text-2xl font-bold tabular-nums text-warning">{stats.naoMapeadas}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-warning/30" />
            </div>
            {stats.naoMapeadas > 0 && (
              <p className="text-xs text-warning mt-2">
                ⚠ Essas concessionárias podem falhar na importação ANEEL
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Buscar por nome, sigla ou alias ANEEL..."
          className="max-w-md"
        />
        <Select value={filterUf} onValueChange={setFilterUf}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="UF" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas UFs</SelectItem>
            {ESTADOS.map(uf => (
              <SelectItem key={uf} value={uf}>{uf}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="mapeada">Mapeadas</SelectItem>
            <SelectItem value="nao_mapeada">Não mapeadas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <ScrollArea className="max-h-[600px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Concessionária</TableHead>
                  <TableHead className="w-[80px]">Sigla</TableHead>
                  <TableHead className="w-[50px]">UF</TableHead>
                  <TableHead>Nome ANEEL Oficial</TableHead>
                  <TableHead>Aliases</TableHead>
                  <TableHead className="w-[100px]">Status</TableHead>
                  <TableHead className="w-[140px] text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Carregando…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      Nenhuma concessionária encontrada com os filtros aplicados.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map(c => (
                    <TableRow key={c.id} className="group">
                      <TableCell className="font-medium">{c.nome}</TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{c.sigla || "—"}</code>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{c.estado || "—"}</TableCell>
                      <TableCell>
                        {c.nome_aneel_oficial ? (
                          <span className="text-sm">{c.nome_aneel_oficial}</span>
                        ) : (
                          <span className="text-sm text-muted-foreground italic">Não definido</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {c.aliases.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            c.aliases.slice(0, 3).map(a => (
                              <Badge key={a.id} variant="secondary" className="text-xs">
                                {a.alias_aneel}
                              </Badge>
                            ))
                          )}
                          {c.aliases.length > 3 && (
                            <Badge variant="outline" className="text-xs">
                              +{c.aliases.length - 3}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {c.status === "mapeada" ? (
                          <Badge className="bg-success/10 text-success border-0">
                            <Link2 className="h-3 w-3 mr-1" />
                            Mapeada
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-warning border-warning/30">
                            <Link2Off className="h-3 w-3 mr-1" />
                            Pendente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => handleAutoSuggest(c)}
                                >
                                  <Sparkles className="h-4 w-4 text-primary" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Auto-sugerir aliases</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEdit(c)}
                                >
                                  <Pencil className="h-4 w-4 text-info" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Editar mapeamento</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Info */}
      <Card className="border-dashed">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Como funciona:</strong> Ao importar um arquivo ANEEL, o sistema tenta casar os nomes da planilha com suas concessionárias.</p>
              <p>O campo <strong>Nome ANEEL Oficial</strong> é o nome prioritário para matching. <strong>Aliases</strong> são variações adicionais que a ANEEL pode usar.</p>
              <p>Concessionárias <strong>não mapeadas</strong> não terão tarifas atualizadas durante a importação — mas os dados serão registrados no relatório.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-primary" />
              Mapeamento ANEEL
            </DialogTitle>
          </DialogHeader>

          {editingConc && (
            <div className="space-y-5">
              {/* Concessionária info */}
              <div className="bg-muted/50 rounded-lg p-3">
                <p className="font-medium">{editingConc.nome}</p>
                <p className="text-sm text-muted-foreground">
                  {editingConc.sigla && <span>Sigla: {editingConc.sigla}</span>}
                  {editingConc.estado && <span> · UF: {editingConc.estado}</span>}
                </p>
              </div>

              {/* Nome ANEEL Oficial */}
              <div className="space-y-2">
                <Label htmlFor="nome-aneel">Nome ANEEL Oficial</Label>
                <Input
                  id="nome-aneel"
                  value={editNomeAneel}
                  onChange={e => setEditNomeAneel(e.target.value)}
                  placeholder="Ex: CEMIG-D, Neoenergia Pernambuco"
                  className="text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Nome exato como aparece no arquivo XLS da ANEEL. Este é o match principal.
                </p>
              </div>

              <Separator />

              {/* Aliases */}
              <div className="space-y-3">
                <Label>Aliases (variações adicionais)</Label>
                <div className="flex gap-2">
                  <Input
                    value={newAlias}
                    onChange={e => setNewAlias(e.target.value)}
                    placeholder="Ex: CEMIG DIS, CEMIG Distribuição"
                    className="text-sm"
                    onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addAlias(); } }}
                  />
                  <Button size="sm" variant="outline" onClick={addAlias} disabled={!newAlias.trim()}>
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                {editAliases.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {editAliases.map((alias, idx) => (
                      <Badge key={idx} variant="secondary" className="text-sm py-1 px-2 gap-1.5">
                        {alias}
                        <button
                          onClick={() => removeAlias(idx)}
                          className="hover:text-destructive transition-colors"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Salvando…" : "Salvar mapeamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
