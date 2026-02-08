import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Rocket,
  Shield,
  Plus,
  History,
  Loader2,
  XCircle,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ChecklistItem {
  id: string;
  label: string;
  category: string;
  checked: boolean;
  required: boolean;
}

const DEFAULT_CHECKLIST_ITEMS: Omit<ChecklistItem, "checked">[] = [
  // Funcionalidades Críticas
  { id: "login", label: "Login/Logout funcional", category: "Funcionalidades Críticas", required: true },
  { id: "lead_form", label: "Formulário de lead (público) funciona", category: "Funcionalidades Críticas", required: true },
  { id: "lead_pipeline", label: "Pipeline de leads (drag & drop)", category: "Funcionalidades Críticas", required: true },
  { id: "orcamento", label: "Criação de orçamento", category: "Funcionalidades Críticas", required: true },
  { id: "financeiro", label: "Financeiro (parcelas/recebimentos)", category: "Funcionalidades Críticas", required: true },
  { id: "checklist_inst", label: "Checklist de instalação", category: "Funcionalidades Críticas", required: true },
  // Segurança
  { id: "sentry_clean", label: "Sem erros críticos no Sentry", category: "Segurança", required: true },
  { id: "rls_ok", label: "RLS policies verificadas", category: "Segurança", required: true },
  { id: "whatsapp_blocked", label: "WhatsApp NÃO dispara em staging", category: "Segurança", required: true },
  // Integridade
  { id: "migrations_ok", label: "Migrations aplicadas sem erro", category: "Integridade", required: true },
  { id: "edge_functions", label: "Edge functions deployadas", category: "Integridade", required: false },
  { id: "data_integrity", label: "Dados de teste íntegros (FKs ok)", category: "Integridade", required: false },
  // UI / UX
  { id: "responsive", label: "Layout responsivo verificado", category: "UI / UX", required: false },
  { id: "portal_vendedor", label: "Portal do vendedor funcional", category: "UI / UX", required: false },
  { id: "portal_instalador", label: "Portal do instalador funcional", category: "UI / UX", required: false },
];

interface ReleaseRecord {
  id: string;
  versao: string;
  commit_hash: string | null;
  ambiente: string;
  status: string;
  itens: ChecklistItem[];
  aprovado_por: string | null;
  aprovado_em: string | null;
  criado_por: string;
  observacoes: string | null;
  created_at: string;
}

export function ReleaseChecklist() {
  const { user } = useAuth();
  const [items, setItems] = useState<ChecklistItem[]>(
    DEFAULT_CHECKLIST_ITEMS.map(i => ({ ...i, checked: false }))
  );
  const [versao, setVersao] = useState("");
  const [commitHash, setCommitHash] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [history, setHistory] = useState<ReleaseRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGoLiveDialog, setShowGoLiveDialog] = useState(false);

  const categories = useMemo(() => {
    const cats = new Map<string, ChecklistItem[]>();
    items.forEach(item => {
      const list = cats.get(item.category) || [];
      list.push(item);
      cats.set(item.category, list);
    });
    return cats;
  }, [items]);

  const allRequiredChecked = items.filter(i => i.required).every(i => i.checked);
  const totalChecked = items.filter(i => i.checked).length;
  const progress = Math.round((totalChecked / items.length) * 100);

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("release_checklists")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) throw error;
      setHistory((data || []).map(r => ({
        ...r,
        itens: (typeof r.itens === "string" ? JSON.parse(r.itens) : r.itens) as ChecklistItem[],
      })));
    } catch (err) {
      console.error("Error fetching release history:", err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const toggleItem = (id: string) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  };

  const handleSave = async (status: "em_andamento" | "aprovado" | "rejeitado") => {
    if (!user) return;
    if (!versao.trim()) {
      toast({ title: "Versão obrigatória", description: "Informe a versão do release", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        versao: versao.trim(),
        commit_hash: commitHash.trim() || null,
        ambiente: "staging",
        status,
        itens: items as any,
        criado_por: user.id,
        aprovado_por: status === "aprovado" ? user.id : null,
        aprovado_em: status === "aprovado" ? new Date().toISOString() : null,
        observacoes: observacoes.trim() || null,
      };

      const { error } = await supabase.from("release_checklists").insert(payload);
      if (error) throw error;

      toast({
        title: status === "aprovado" ? "✅ Release Aprovado!" : "Checklist salvo",
        description: status === "aprovado"
          ? `Versão ${versao} aprovada para produção`
          : `Checklist da versão ${versao} salvo como ${status}`,
      });

      // Reset form
      setItems(DEFAULT_CHECKLIST_ITEMS.map(i => ({ ...i, checked: false })));
      setVersao("");
      setCommitHash("");
      setObservacoes("");
      setShowGoLiveDialog(false);
      fetchHistory();
    } catch (err: any) {
      console.error("Error saving release checklist:", err);
      toast({
        title: "Erro ao salvar",
        description: err?.message || "Não foi possível salvar o checklist",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "Funcionalidades Críticas": return <Rocket className="h-4 w-4 text-primary" />;
      case "Segurança": return <Shield className="h-4 w-4 text-destructive" />;
      case "Integridade": return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "UI / UX": return <Clock className="h-4 w-4 text-info" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "aprovado":
        return <Badge className="bg-success/10 text-success">Aprovado</Badge>;
      case "rejeitado":
        return <Badge variant="destructive">Rejeitado</Badge>;
      default:
        return <Badge variant="secondary">Em andamento</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* New Release Form */}
      <Card className="border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Rocket className="h-5 w-5 text-primary" />
                Checklist de Release
              </CardTitle>
              <CardDescription className="mt-1">
                Valide todos os itens antes de promover staging → produção
              </CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <p className="text-2xl font-bold">{progress}%</p>
                <p className="text-xs text-muted-foreground">{totalChecked}/{items.length} itens</p>
              </div>
              <div className="w-16 h-16 relative">
                <svg className="w-16 h-16 -rotate-90" viewBox="0 0 36 36">
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke="hsl(var(--muted))"
                    strokeWidth="3"
                  />
                  <path
                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                    fill="none"
                    stroke={allRequiredChecked ? "hsl(var(--success))" : "hsl(var(--primary))"}
                    strokeWidth="3"
                    strokeDasharray={`${progress}, 100`}
                    className="transition-all duration-500"
                  />
                </svg>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Version info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="versao">Versão *</Label>
              <Input
                id="versao"
                value={versao}
                onChange={e => setVersao(e.target.value)}
                placeholder="ex: v2.4.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="commit">Commit Hash</Label>
              <Input
                id="commit"
                value={commitHash}
                onChange={e => setCommitHash(e.target.value)}
                placeholder="ex: abc1234"
                className="font-mono text-sm"
              />
            </div>
          </div>

          <Separator />

          {/* Checklist items grouped by category */}
          {Array.from(categories.entries()).map(([category, catItems]) => (
            <div key={category} className="space-y-3">
              <h4 className="text-sm font-semibold flex items-center gap-2">
                {getCategoryIcon(category)}
                {category}
              </h4>
              <div className="space-y-2 ml-6">
                {catItems.map(item => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${
                      item.checked
                        ? "bg-success/5 border border-success/20"
                        : "hover:bg-muted/50 border border-transparent"
                    }`}
                  >
                    <Checkbox
                      checked={item.checked}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <span className={`text-sm flex-1 ${item.checked ? "line-through text-muted-foreground" : ""}`}>
                      {item.label}
                    </span>
                    {item.required && !item.checked && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-destructive/30 text-destructive">
                        obrigatório
                      </Badge>
                    )}
                    {item.checked && (
                      <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}

          <Separator />

          {/* Observações */}
          <div className="space-y-2">
            <Label htmlFor="obs">Observações</Label>
            <Textarea
              id="obs"
              value={observacoes}
              onChange={e => setObservacoes(e.target.value)}
              placeholder="Notas sobre o release, itens pendentes, riscos conhecidos..."
              rows={3}
              className="resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={() => handleSave("em_andamento")}
              disabled={saving || !versao.trim()}
              className="flex-1 gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Clock className="h-4 w-4" />}
              Salvar Progresso
            </Button>
            <Button
              onClick={() => {
                if (!allRequiredChecked) {
                  toast({
                    title: "Itens obrigatórios pendentes",
                    description: "Marque todos os itens obrigatórios antes de aprovar o release",
                    variant: "destructive",
                  });
                  return;
                }
                setShowGoLiveDialog(true);
              }}
              disabled={saving || !versao.trim()}
              className="flex-1 gap-2 bg-success hover:bg-success/90 text-success-foreground"
            >
              <Rocket className="h-4 w-4" />
              Aprovar para Produção
            </Button>
          </div>

          {/* Warning if not all required */}
          {!allRequiredChecked && (
            <div className="flex items-start gap-3 p-4 rounded-lg bg-warning/5 border border-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Itens obrigatórios pendentes
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {items.filter(i => i.required && !i.checked).map(i => i.label).join(", ")}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-5 w-5" />
            Histórico de Releases
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <div className="empty-state py-8">
              <div className="empty-state-icon">
                <History className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="empty-state-title">Nenhum release registrado</p>
              <p className="empty-state-description">
                O histórico de validações aparecerá aqui
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map(record => {
                const checkedCount = record.itens?.filter(i => i.checked).length || 0;
                const totalCount = record.itens?.length || 0;
                return (
                  <div
                    key={record.id}
                    className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-semibold text-sm">{record.versao}</span>
                        {record.commit_hash && (
                          <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                            {record.commit_hash.substring(0, 7)}
                          </span>
                        )}
                        {getStatusBadge(record.status)}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(record.created_at), "dd MMM yyyy 'às' HH:mm", { locale: ptBR })}
                        {" · "}
                        {checkedCount}/{totalCount} itens
                      </p>
                      {record.observacoes && (
                        <p className="text-xs text-muted-foreground mt-1 truncate">{record.observacoes}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold">
                        {totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Go Live Confirmation Dialog */}
      <Dialog open={showGoLiveDialog} onOpenChange={setShowGoLiveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-success" />
              Confirmar Aprovação para Produção
            </DialogTitle>
            <DialogDescription>
              Você está prestes a aprovar a versão <strong>{versao}</strong> para produção.
              Certifique-se de que todos os testes foram realizados.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>{totalChecked}/{items.length} itens verificados</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <span>Todos os itens obrigatórios marcados</span>
            </div>
            {commitHash && (
              <div className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span className="font-mono">Commit: {commitHash.substring(0, 7)}</span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowGoLiveDialog(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={() => handleSave("aprovado")}
              disabled={saving}
              className="bg-success hover:bg-success/90 text-success-foreground gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
              Aprovar Release
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
