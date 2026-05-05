import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, FileText } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentTemplates } from "./useDocumentTemplates";
import { useClientes } from "@/hooks/useClientes";
import { useEmitirRecibo } from "@/hooks/useRecibos";
import type { DocumentTemplate, FormFieldSchema } from "./types";

interface EmitirReciboModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClienteId?: string;
  defaultProjetoId?: string;
  defaultDealId?: string;
  onEmitted?: (reciboId: string) => void;
}

/**
 * Modal de emissão de recibo. Reaproveita document_templates (categoria='recibo')
 * e renderiza form dinâmico baseado em template.form_schema.
 */
export function EmitirReciboModal({
  open,
  onOpenChange,
  defaultClienteId,
  defaultProjetoId,
  defaultDealId,
  onEmitted,
}: EmitirReciboModalProps) {
  const { data: templates, isLoading: loadingTpls } = useDocumentTemplates("recibo");
  const { clientes, isLoading: loadingClientes } = useClientes();
  const emitir = useEmitirRecibo();

  const [templateId, setTemplateId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>(defaultClienteId ?? "");
  const [valor, setValor] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [numero, setNumero] = useState<string>("");
  const [dynFields, setDynFields] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setTemplateId("");
      setClienteId(defaultClienteId ?? "");
      setValor("");
      setDescricao("");
      setNumero("");
      setDynFields({});
    }
  }, [open, defaultClienteId]);

  const template = useMemo<DocumentTemplate | undefined>(
    () => (templates ?? []).find((t) => t.id === templateId),
    [templates, templateId],
  );

  const schema: FormFieldSchema[] = useMemo(() => {
    const arr = (template?.form_schema ?? []) as FormFieldSchema[];
    return [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [template]);

  const canSubmit =
    !!templateId && !!clienteId && Number(valor) > 0 && !emitir.isPending;

  async function handleSubmit() {
    if (!canSubmit) return;
    const dados: Record<string, unknown> = { ...dynFields };
    if (descricao) dados["descricao"] = descricao;
    if (valor) dados["valor"] = Number(valor);

    const id = await emitir.mutateAsync({
      template_id: templateId,
      cliente_id: clienteId,
      projeto_id: defaultProjetoId ?? null,
      deal_id: defaultDealId ?? null,
      descricao: descricao || undefined,
      numero: numero || undefined,
      valor: Number(valor),
      dados_preenchidos: dados,
      generate_pdf: true,
    });
    onEmitted?.(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Emitir recibo
          </DialogTitle>
          <DialogDescription>
            Escolha o template, preencha os dados e gere o PDF com branding automático.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={loadingTpls}>
              <SelectTrigger><SelectValue placeholder={loadingTpls ? "Carregando..." : "Selecione um template"} /></SelectTrigger>
              <SelectContent>
                {(templates ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId} disabled={loadingClientes}>
              <SelectTrigger><SelectValue placeholder={loadingClientes ? "Carregando..." : "Selecione o cliente"} /></SelectTrigger>
              <SelectContent>
                {(clientes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nome}{c.cpf_cnpj ? ` — ${c.cpf_cnpj}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Número (opcional)</Label>
            <Input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: 2026-0001"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Sinal referente ao projeto..."
              rows={2}
            />
          </div>

          {schema.length > 0 && (
            <div className="sm:col-span-2 border-t pt-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Campos do template
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {schema.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">
                      {f.label}{f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        value={dynFields[f.key] ?? ""}
                        onChange={(e) => setDynFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        rows={2}
                      />
                    ) : f.type === "select" ? (
                      <Select
                        value={dynFields[f.key] ?? ""}
                        onValueChange={(v) => setDynFields((p) => ({ ...p, [f.key]: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={f.type === "number" || f.type === "currency" ? "number" : f.type === "date" ? "date" : "text"}
                        step={f.type === "currency" ? "0.01" : undefined}
                        value={dynFields[f.key] ?? ""}
                        onChange={(e) => setDynFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                      />
                    )}
                    {f.helpText && <p className="text-[10px] text-muted-foreground">{f.helpText}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={emitir.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2 min-w-[160px]">
            {emitir.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Emitindo...</>
            ) : (
              <><Send className="h-4 w-4" /> Emitir e gerar PDF</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
