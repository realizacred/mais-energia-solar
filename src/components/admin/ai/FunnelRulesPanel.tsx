/**
 * FunnelRulesPanel — CRUD de regras de coerência entre funis (ai_funnel_rules).
 *
 * Cada regra diz: "Se funil de papel X estiver na categoria Y,
 * então o funil de papel A deve estar (no mínimo) na categoria B."
 *
 * Categorias usadas: aberto / ganho / perdido / excluido (enum projeto_etapa_categoria).
 *
 * Governança:
 *  - RB-04: dados via hook
 *  - SRP: só renderização e edição local
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { LoadingState } from "@/components/ui-kit";
import { Plus, Pencil, Trash2, ArrowRight } from "lucide-react";
import {
  PAPEL_LABEL,
  useFunnelRules,
  useUpsertFunnelRule,
  useDeleteFunnelRule,
  type FunnelRule,
  type PapelFunil,
} from "@/hooks/useFunnelGovernance";
import { toast } from "sonner";

const PAPEIS: PapelFunil[] = [
  "comercial",
  "engenharia",
  "suprimentos",
  "instalacao",
  "concessionaria",
  "pos_venda",
];

const CATEGORIAS = [
  { value: "aberto", label: "Em aberto / em andamento" },
  { value: "ganho", label: "Concluído / Ganho" },
  { value: "perdido", label: "Perdido / Cancelado" },
  { value: "excluido", label: "Excluído" },
] as const;

const ACOES = [
  { value: "alertar", label: "Apenas alertar" },
  { value: "sugerir", label: "Sugerir correção" },
  { value: "auto_corrigir", label: "Corrigir automaticamente" },
] as const;

type RuleDraft = Partial<FunnelRule> & { id?: string };

const EMPTY_DRAFT: RuleDraft = {
  nome: "",
  descricao: "",
  funil_origem_papel: "comercial",
  etapa_origem_categoria: "ganho",
  funil_alvo_papel: "engenharia",
  etapa_alvo_categoria_esperada: "aberto",
  acao: "alertar",
  ativo: true,
  prioridade: 100,
};

export function FunnelRulesPanel() {
  const { data: rules, isLoading } = useFunnelRules();
  const upsert = useUpsertFunnelRule();
  const remove = useDeleteFunnelRule();

  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  if (isLoading) return <LoadingState />;

  const handleSave = async () => {
    if (!draft) return;
    if (!draft.nome?.trim()) {
      toast.error("Informe um nome para a regra");
      return;
    }
    try {
      await upsert.mutateAsync(draft);
      toast.success(draft.id ? "Regra atualizada" : "Regra criada");
      setDraft(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar regra");
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await remove.mutateAsync(deleteId);
      toast.success("Regra removida");
      setDeleteId(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao remover regra");
    }
  };

  const list = rules ?? [];

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Regras de Coerência</CardTitle>
            <CardDescription>
              Defina relações entre funis (ex.: "Engenharia só pode iniciar quando o Comercial
              estiver Ganho"). O detector usa essas regras para apontar projetos fora de ordem
              no painel de Saúde dos Funis.
            </CardDescription>
          </div>
          <Button size="sm" onClick={() => setDraft({ ...EMPTY_DRAFT })} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" />
            Nova regra
          </Button>
        </CardHeader>
        <CardContent>
          {list.length === 0 ? (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md p-6 text-center">
              Nenhuma regra cadastrada. Clique em <strong>Nova regra</strong> para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {list.map((r) => (
                <RuleRow
                  key={r.id}
                  rule={r}
                  onEdit={() => setDraft({ ...r })}
                  onDelete={() => setDeleteId(r.id)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <RuleEditorDialog
        draft={draft}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSave={handleSave}
        saving={upsert.isPending}
      />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover regra?</AlertDialogTitle>
            <AlertDialogDescription>
              Alertas já criados por essa regra serão mantidos no histórico, mas novas
              detecções deixarão de acontecer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Remover</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function RuleRow({
  rule,
  onEdit,
  onDelete,
}: {
  rule: FunnelRule;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-md border bg-card">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="font-medium truncate">{rule.nome}</p>
          {!rule.ativo && <Badge variant="outline">Inativa</Badge>}
          <Badge variant="secondary" className="text-xs">
            {ACOES.find((a) => a.value === rule.acao)?.label ?? rule.acao}
          </Badge>
        </div>
        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
          <Badge variant="outline" className="text-[10px]">
            {PAPEL_LABEL[rule.funil_origem_papel]} ·{" "}
            {CATEGORIAS.find((c) => c.value === rule.etapa_origem_categoria)?.label}
          </Badge>
          <ArrowRight className="h-3 w-3" />
          <Badge variant="outline" className="text-[10px]">
            {PAPEL_LABEL[rule.funil_alvo_papel]} deve estar em{" "}
            {CATEGORIAS.find((c) => c.value === rule.etapa_alvo_categoria_esperada)?.label}
          </Badge>
        </div>
        {rule.descricao && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{rule.descricao}</p>
        )}
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <Button size="sm" variant="ghost" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

function RuleEditorDialog({
  draft,
  onChange,
  onClose,
  onSave,
  saving,
}: {
  draft: RuleDraft | null;
  onChange: (d: RuleDraft) => void;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  if (!draft) return null;

  const set = <K extends keyof RuleDraft>(k: K, v: RuleDraft[K]) =>
    onChange({ ...draft, [k]: v });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{draft.id ? "Editar regra" : "Nova regra de coerência"}</DialogTitle>
          <DialogDescription>
            Defina quando um funil deve estar em determinado estado em função de outro.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name">Nome</Label>
            <Input
              id="rule-name"
              value={draft.nome ?? ""}
              onChange={(e) => set("nome", e.target.value)}
              placeholder='Ex.: "Engenharia só inicia após Comercial Ganho"'
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Quando o funil de…</Label>
              <Select
                value={draft.funil_origem_papel}
                onValueChange={(v) => set("funil_origem_papel", v as PapelFunil)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PAPEL_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>…estiver na categoria</Label>
              <Select
                value={draft.etapa_origem_categoria}
                onValueChange={(v) => set("etapa_origem_categoria", v as FunnelRule["etapa_origem_categoria"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>…então o funil de</Label>
              <Select
                value={draft.funil_alvo_papel}
                onValueChange={(v) => set("funil_alvo_papel", v as PapelFunil)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAPEIS.map((p) => (
                    <SelectItem key={p} value={p}>
                      {PAPEL_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>deve estar (no mínimo) em</Label>
              <Select
                value={draft.etapa_alvo_categoria_esperada}
                onValueChange={(v) =>
                  set("etapa_alvo_categoria_esperada", v as FunnelRule["etapa_alvo_categoria_esperada"])
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ação ao detectar</Label>
              <Select
                value={draft.acao}
                onValueChange={(v) => set("acao", v as FunnelRule["acao"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACOES.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="rule-prio">Prioridade (menor = primeiro)</Label>
              <Input
                id="rule-prio"
                type="number"
                value={draft.prioridade ?? 100}
                onChange={(e) => set("prioridade", Number(e.target.value) || 100)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="rule-desc">Descrição (opcional)</Label>
            <Textarea
              id="rule-desc"
              rows={3}
              value={draft.descricao ?? ""}
              onChange={(e) => set("descricao", e.target.value)}
              placeholder="Explique para a equipe quando essa regra deve disparar."
            />
          </div>

          <div className="flex items-center justify-between rounded-md border p-3">
            <div>
              <p className="text-sm font-medium">Regra ativa</p>
              <p className="text-xs text-muted-foreground">
                Regras inativas não geram novos alertas.
              </p>
            </div>
            <Switch
              checked={draft.ativo ?? true}
              onCheckedChange={(v) => set("ativo", v)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={onSave} disabled={saving}>
            {saving ? "Salvando…" : draft.id ? "Salvar alterações" : "Criar regra"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
