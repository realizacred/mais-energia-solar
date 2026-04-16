import { useState } from "react";
import { Users, Plus, Trash2, Pencil, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import {
  FormModalTemplate,
  FormGrid,
} from "@/components/ui-kit/FormModalTemplate";
import { useToast } from "@/hooks/use-toast";
import { useConsultoresList } from "@/hooks/useConsultoresList";
import {
  useSmConsultorMappings,
  useUpsertSmConsultorMapping,
  useDeleteSmConsultorMapping,
  type SmConsultorMapping,
} from "@/hooks/useSmConsultorMapping";

const NONE_VALUE = "__none__";

export default function SmConsultorMappingManager() {
  const { toast } = useToast();
  const { data: mappings, isLoading } = useSmConsultorMappings();
  const { data: consultores } = useConsultoresList();
  const upsert = useUpsertSmConsultorMapping();
  const remove = useDeleteSmConsultorMapping();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SmConsultorMapping | null>(null);
  const [smName, setSmName] = useState("");
  const [canonicalName, setCanonicalName] = useState("");
  const [consultorId, setConsultorId] = useState<string>(NONE_VALUE);
  const [isExFuncionario, setIsExFuncionario] = useState(false);

  const resetForm = () => {
    setEditing(null);
    setSmName("");
    setCanonicalName("");
    setConsultorId(NONE_VALUE);
    setIsExFuncionario(false);
  };

  const openCreate = () => {
    resetForm();
    setOpen(true);
  };

  const openEdit = (m: SmConsultorMapping) => {
    setEditing(m);
    setSmName(m.sm_name);
    setCanonicalName(m.canonical_name);
    setConsultorId(m.consultor_id || NONE_VALUE);
    setIsExFuncionario(m.is_ex_funcionario);
    setOpen(true);
  };

  const handleSubmit = async () => {
    if (!smName.trim() || !canonicalName.trim()) {
      toast({
        title: "Campos obrigatórios",
        description: "Informe o nome no SolarMarket e o nome canônico.",
        variant: "destructive",
      });
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing?.id,
        sm_name: smName,
        canonical_name: canonicalName,
        consultor_id: consultorId === NONE_VALUE ? null : consultorId,
        is_ex_funcionario: isExFuncionario,
      });
      toast({
        title: editing ? "Mapeamento atualizado" : "Mapeamento criado",
      });
      setOpen(false);
      resetForm();
    } catch (e: any) {
      toast({
        title: "Erro ao salvar",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover este mapeamento?")) return;
    try {
      await remove.mutateAsync(id);
      toast({ title: "Mapeamento removido" });
    } catch (e: any) {
      toast({
        title: "Erro ao remover",
        description: e?.message ?? "Tente novamente",
        variant: "destructive",
      });
    }
  };

  if (isLoading) return <LoadingState />;

  const consultorMap = new Map((consultores ?? []).map((c) => [c.id, c.nome]));

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Mapeamento de Consultores SolarMarket
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Mapeia nomes de vendedores do SolarMarket para consultores do sistema.
            Substitui o VENDEDOR_MAP hardcoded (DA-40).
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="w-4 h-4 mr-2" />
          Novo mapeamento
        </Button>
      </div>

      {(!mappings || mappings.length === 0) && (
        <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-medium text-foreground">Nenhum mapeamento cadastrado</p>
            <p className="text-muted-foreground mt-1">
              A migração SolarMarket usará os defaults hardcoded como fallback.
              Cadastre mapeamentos para ter controle total sobre a resolução de consultores.
            </p>
          </div>
        </div>
      )}

      {mappings && mappings.length > 0 && (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nome no SolarMarket</TableHead>
              <TableHead>Nome canônico</TableHead>
              <TableHead>Consultor vinculado</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium text-foreground">{m.sm_name}</TableCell>
                <TableCell className="text-foreground">{m.canonical_name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {m.consultor_id ? consultorMap.get(m.consultor_id) ?? "—" : "—"}
                </TableCell>
                <TableCell>
                  {m.is_ex_funcionario ? (
                    <Badge className="bg-warning/10 text-warning border-warning/20">
                      Ex-funcionário → Escritório
                    </Badge>
                  ) : (
                    <Badge className="bg-success/10 text-success border-success/20">
                      Ativo
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(m.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <FormModalTemplate
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) resetForm();
        }}
        title={editing ? "Editar mapeamento" : "Novo mapeamento"}
        subtitle="Vincule um nome do SolarMarket a um consultor nativo"
        icon={Users}
        onSubmit={handleSubmit}
        submitLabel={editing ? "Salvar" : "Cadastrar"}
        saving={upsert.isPending}
      >
        <FormGrid>
          <div className="space-y-2">
            <Label htmlFor="sm_name">Nome no SolarMarket *</Label>
            <Input
              id="sm_name"
              value={smName}
              onChange={(e) => setSmName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="canonical_name">Nome canônico *</Label>
            <Input
              id="canonical_name"
              value={canonicalName}
              onChange={(e) => setCanonicalName(e.target.value)}
              placeholder="Ex: João Silva"
            />
          </div>
        </FormGrid>

        <div className="space-y-2">
          <Label>Consultor vinculado</Label>
          <Select value={consultorId} onValueChange={setConsultorId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione um consultor (opcional)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>Nenhum (apenas nome)</SelectItem>
              {(consultores ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Se vinculado, a migração usará o ID direto. Caso contrário, busca pelo nome canônico.
          </p>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border p-3">
          <div>
            <Label htmlFor="is_ex" className="cursor-pointer">
              Ex-funcionário
            </Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              Se ativo, projetos deste vendedor serão atribuídos ao "Escritório".
            </p>
          </div>
          <Switch id="is_ex" checked={isExFuncionario} onCheckedChange={setIsExFuncionario} />
        </div>
      </FormModalTemplate>
    </div>
  );
}
