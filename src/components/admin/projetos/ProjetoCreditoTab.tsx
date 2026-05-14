import { useState } from "react";
import { useAnaliseCredito, useCreateAnaliseCredito, useUpdateAnaliseCredito, type AnaliseCredito } from "@/hooks/useAnaliseCredito";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, CreditCard, History, CheckCircle2, XCircle, Clock, Landmark } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatBRL } from "@/lib/formatters";
import { formatDateTime } from "@/lib/dateUtils";

interface Props {
  dealId: string;
  clienteId?: string | null;
  clienteCpfCnpj?: string | null;
  valorProposta?: number | null;
}

export function ProjetoCreditoTab({ dealId, clienteId, clienteCpfCnpj, valorProposta }: Props) {
  const { isAdmin, isManager } = useUserRole();
  const canApprove = isAdmin || isManager;
  
  const { data: analises, isLoading } = useAnaliseCredito(dealId);
  const createMutation = useCreateAnaliseCredito();
  const updateMutation = useUpdateAnaliseCredito();
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [approveData, setApproveData] = useState({
    valor_aprovado: "",
    taxa_juros: "",
    prazo_meses: "",
    observacoes: ""
  });

  const [formData, setFormData] = useState({
    cpf_cnpj: clienteCpfCnpj || "",
    renda_mensal: "",
    banco: "",
    valor_solicitado: valorProposta?.toString() || "",
    prazo_meses: "",
    observacoes: ""
  });

  const statusColors: Record<string, string> = {
    pendente: "bg-warning/10 text-warning border-warning/20",
    em_analise: "bg-info/10 text-info border-info/20",
    aprovado: "bg-success/10 text-success border-success/20",
    reprovado: "bg-destructive/10 text-destructive border-destructive/20",
    cancelado: "bg-muted text-muted-foreground border-muted/20"
  };

  const statusIcons: Record<string, any> = {
    pendente: Clock,
    em_analise: History,
    aprovado: CheckCircle2,
    reprovado: XCircle,
    cancelado: XCircle
  };

  const handleSubmit = async () => {
    await createMutation.mutateAsync({
      deal_id: dealId,
      cliente_id: clienteId,
      cpf_cnpj: formData.cpf_cnpj,
      renda_mensal: parseFloat(formData.renda_mensal),
      banco: formData.banco,
      valor_solicitado: parseFloat(formData.valor_solicitado),
      prazo_meses: parseInt(formData.prazo_meses),
      observacoes: formData.observacoes
    });
    setIsModalOpen(false);
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">Carregando análises...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="h-4 w-4 text-primary" />
          Análise de Crédito
        </h3>
        <Button onClick={() => setIsModalOpen(true)} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Solicitar Análise
        </Button>
      </div>

      {analises && analises.length > 0 ? (
        <div className="grid gap-4">
          {analises.map((analise) => {
            const Icon = statusIcons[analise.status];
            return (
              <Card key={analise.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center shrink-0", statusColors[analise.status])}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-sm font-semibold">{analise.banco || "Banco não informado"}</span>
                          <Badge variant="outline" className={cn("text-[10px]", statusColors[analise.status])}>
                            {analise.status.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-8 gap-y-1 text-xs text-muted-foreground">
                          <div>Solicitado: <span className="font-medium text-foreground">{formatBRL(analise.valor_solicitado || 0)}</span></div>
                          {analise.valor_aprovado && (
                            <div>Aprovado: <span className="font-medium text-success">{formatBRL(analise.valor_aprovado)}</span></div>
                          )}
                          <div>Prazo: <span className="font-medium text-foreground">{analise.prazo_meses} meses</span></div>
                          <div>Data: <span className="font-medium text-foreground">{formatDateTime(analise.created_at)}</span></div>
                        </div>
                      </div>
                    </div>
                    {/* Botão de detalhes/edição se admin? */}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <CreditCard className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-foreground">Nenhuma solicitação encontrada</p>
            <p className="text-xs text-muted-foreground mt-1">Clique em "Solicitar Análise" para iniciar o processo</p>
          </CardContent>
        </Card>
      )}

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Solicitar Análise de Crédito</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF/CNPJ</Label>
                <Input id="cpf" value={formData.cpf_cnpj} onChange={e => setFormData({...formData, cpf_cnpj: e.target.value})} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="renda">Renda Mensal</Label>
                <Input id="renda" type="number" placeholder="0,00" value={formData.renda_mensal} onChange={e => setFormData({...formData, renda_mensal: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="banco">Banco</Label>
                <Select value={formData.banco} onValueChange={v => setFormData({...formData, banco: v})}>
                  <SelectTrigger id="banco">
                    <SelectValue placeholder="Selecione o banco" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Santander">Santander</SelectItem>
                    <SelectItem value="BV Financeira">BV Financeira</SelectItem>
                    <SelectItem value="Bradesco">Bradesco</SelectItem>
                    <SelectItem value="Solfacil">Solfacil</SelectItem>
                    <SelectItem value="Outros">Outros</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor Solicitado</Label>
                <Input id="valor" type="number" value={formData.valor_solicitado} onChange={e => setFormData({...formData, valor_solicitado: e.target.value})} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="prazo">Prazo Desejado (meses)</Label>
              <Input id="prazo" type="number" placeholder="ex: 60" value={formData.prazo_meses} onChange={e => setFormData({...formData, prazo_meses: e.target.value})} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="obs">Observações</Label>
              <Textarea id="obs" placeholder="Informações adicionais..." value={formData.observacoes} onChange={e => setFormData({...formData, observacoes: e.target.value})} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Solicitando..." : "Confirmar Solicitação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { cn } from "@/lib/utils";
