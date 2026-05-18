import { useState } from "react";
import { useStageValidations, useSaveStageValidation, useDeleteStageValidation, type ValidationType, type StageValidation } from "@/hooks/useStageValidations";
import { toast } from "@/hooks/use-toast";
import { Plus, Trash2, ShieldCheck, AlertCircle, FileText, DollarSign, UserCheck, Package, Layout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface StageOption {
  id: string;
  name: string;
}

interface Props {
  pipelineId: string;
  stages: StageOption[];
}

const VALIDATION_TYPES: { value: ValidationType; label: string; icon: any }[] = [
  { value: "documento_obrigatorio", label: "Documento obrigatório", icon: FileText },
  { value: "valor_minimo", label: "Valor mínimo", icon: DollarSign },
  { value: "campo_preenchido", label: "Campo preenchido", icon: Layout },
  { value: "fornecedor_vinculado", label: "Fornecedor vinculado", icon: Package },
  { value: "aprovacao_manual", label: "Aprovação manual", icon: UserCheck },
];

const DOCUMENT_TYPES = [
  { value: "contrato_assinado", label: "Contrato Assinado" },
  { value: "comprovante_pagamento", label: "Comprovante de Pagamento" },
  { value: "rg_cnh", label: "RG/CNH" },
  { value: "conta_luz", label: "Conta de Luz" },
  { value: "parecer", label: "Parecer de Acesso" },
  { value: "outro", label: "Outro" },
];

const PROJECT_FIELDS = [
  { value: "potencia_kwp", label: "Potência (kWp)" },
  { value: "valor_total", label: "Valor Total" },
  { value: "tipo_projeto_solar", label: "Tipo de Projeto" },
  { value: "responsavel_tecnico_id", label: "Responsável Técnico" },
];

export function StageValidationsConfig({ pipelineId, stages }: Props) {
  const [selectedStageId, setSelectedStageId] = useState<string>(stages[0]?.id || "");
  const { data: validations = [], isLoading: loading } = useStageValidations(selectedStageId);
  const saveMutation = useSaveStageValidation();
  const deleteMutation = useDeleteStageValidation();

  const handleCreate = async () => {
    if (!selectedStageId) return;
    try {
      await saveMutation.mutateAsync({
        stage_id: selectedStageId,
        tipo_validacao: "documento_obrigatorio",
        configuracao: { label: "Contrato assinado", documento_tipo: "contrato_assinado" },
        mensagem_bloqueio: "Contrato deve estar assinado para avançar.",
        bloquear_avanco: true,
        ativo: true,
      });
      toast({ title: "Validação criada!" });
    } catch (e: any) {
      toast({ title: "Erro ao criar", description: e.message, variant: "destructive" });
    }
  };

  const handleUpdate = async (id: string, patch: Partial<StageValidation>) => {
    try {
      await saveMutation.mutateAsync({ id, stage_id: selectedStageId, ...patch });
    } catch (e: any) {
      toast({ title: "Erro ao atualizar", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta validação?")) return;
    try {
      await deleteMutation.mutateAsync({ id, stage_id: selectedStageId });
      toast({ title: "Validação excluída" });
    } catch (e: any) {
      toast({ title: "Erro ao excluir", description: e.message, variant: "destructive" });
    }
  };

  const renderConfigFields = (v: StageValidation) => {
    switch (v.tipo_validacao) {
      case "documento_obrigatorio":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase">Tipo de Documento</Label>
              <Select 
                value={v.configuracao.documento_tipo} 
                onValueChange={(val) => handleUpdate(v.id, { configuracao: { ...v.configuracao, documento_tipo: val } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOCUMENT_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase">Rótulo</Label>
              <Input 
                className="h-8 text-xs" 
                value={v.configuracao.label} 
                onChange={e => handleUpdate(v.id, { configuracao: { ...v.configuracao, label: e.target.value } })}
              />
            </div>
          </div>
        );
      case "valor_minimo":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase">Campo</Label>
              <Select 
                value={v.configuracao.campo} 
                onValueChange={(val) => handleUpdate(v.id, { configuracao: { ...v.configuracao, campo: val } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor_total">Valor Total</SelectItem>
                  <SelectItem value="valor_entrada">Valor de Entrada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase">Valor Mínimo (R$)</Label>
              <Input 
                type="number" 
                className="h-8 text-xs" 
                value={v.configuracao.valor_minimo} 
                onChange={e => handleUpdate(v.id, { configuracao: { ...v.configuracao, valor_minimo: Number(e.target.value) } })}
              />
            </div>
          </div>
        );
      case "campo_preenchido":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase">Campo do Projeto</Label>
              <Select 
                value={v.configuracao.campo} 
                onValueChange={(val) => handleUpdate(v.id, { configuracao: { ...v.configuracao, campo: val } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_FIELDS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase">Rótulo Amigável</Label>
              <Input 
                className="h-8 text-xs" 
                value={v.configuracao.label} 
                onChange={e => handleUpdate(v.id, { configuracao: { ...v.configuracao, label: e.target.value } })}
              />
            </div>
          </div>
        );
      case "aprovacao_manual":
        return (
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase">Quem aprova?</Label>
              <Select 
                value={v.configuracao.role} 
                onValueChange={(val) => handleUpdate(v.id, { configuracao: { ...v.configuracao, role: val } })}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="gerente">Gerente Comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        );
      case "fornecedor_vinculado":
        return <p className="text-[10px] text-muted-foreground italic">Verifica se existe ordem de compra para o projeto.</p>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-secondary" />
            Validações por Etapa
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Defina requisitos para avançar ou avisos de pendência.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={selectedStageId} onValueChange={setSelectedStageId}>
            <SelectTrigger className="h-8 w-40 text-xs">
              <SelectValue placeholder="Etapa..." />
            </SelectTrigger>
            <SelectContent>
              {stages.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={handleCreate} size="sm" variant="outline" className="h-8 gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Adicionar
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Carregando validações...</div>
      ) : validations.length === 0 ? (
        <div className="py-12 text-center border-2 border-dashed rounded-xl bg-muted/20">
          <ShieldCheck className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma validação configurada para esta etapa</p>
        </div>
      ) : (
        <div className="space-y-3">
          {validations.map(v => {
            const typeInfo = VALIDATION_TYPES.find(t => t.value === v.tipo_validacao);
            const Icon = typeInfo?.icon || AlertCircle;

            return (
              <Card key={v.id} className={cn("transition-all", !v.ativo && "opacity-60")}>
                <CardContent className="p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-md bg-secondary/10 text-secondary">
                        <Icon className="h-3.5 w-3.5" />
                      </div>
                      <Select 
                        value={v.tipo_validacao} 
                        onValueChange={(val: ValidationType) => handleUpdate(v.id, { tipo_validacao: val })}
                      >
                        <SelectTrigger className="h-7 border-none bg-transparent font-semibold p-0 focus:ring-0 w-fit gap-1">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {VALIDATION_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch checked={v.ativo} onCheckedChange={val => handleUpdate(v.id, { ativo: val })} />
                      <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(v.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </div>

                  <Separator className="opacity-40" />

                  {renderConfigFields(v)}

                  <div className="space-y-3 pt-1">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-medium uppercase">Bloquear avanço</Label>
                          <p className="text-[9px] text-muted-foreground leading-tight">Impede a mudança de etapa se não cumprido.</p>
                        </div>
                        <Switch 
                          checked={v.bloquear_avanco} 
                          onCheckedChange={val => handleUpdate(v.id, { bloquear_avanco: val })} 
                        />
                      </div>

                      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40">
                        <div className="space-y-0.5">
                          <Label className="text-[10px] font-medium uppercase">A partir desta etapa</Label>
                          <p className="text-[9px] text-muted-foreground leading-tight">Aplica nesta e em todas as posteriores.</p>
                        </div>
                        <Switch 
                          checked={v.aplicar_a_partir} 
                          onCheckedChange={val => handleUpdate(v.id, { aplicar_a_partir: val })} 
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Mensagem personalizada</Label>
                      <Input 
                        placeholder="Ex: É necessário anexar o contrato..." 
                        className="h-8 text-xs"
                        value={v.mensagem_bloqueio || ""}
                        onChange={e => handleUpdate(v.id, { mensagem_bloqueio: e.target.value })}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
