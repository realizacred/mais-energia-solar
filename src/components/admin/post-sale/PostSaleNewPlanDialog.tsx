import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCreatePlan } from "@/hooks/usePostSale";
import { usePostSaleClients } from "@/hooks/usePostSaleClients";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostSaleNewPlanDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<"existing" | "avulso">("existing");
  const [clienteId, setClienteId] = useState("");
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [telefoneAvulso, setTelefoneAvulso] = useState("");
  const [periodicidade, setPeriodicidade] = useState("12");
  const [dataInicio, setDataInicio] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: clientes = [], isLoading } = usePostSaleClients();
  const createPlan = useCreatePlan();

  const reset = () => {
    setTab("existing");
    setClienteId("");
    setNomeAvulso("");
    setTelefoneAvulso("");
    setPeriodicidade("12");
    setDataInicio("");
    setObservacoes("");
  };

  const canSave = tab === "existing" ? !!clienteId : !!nomeAvulso.trim();

  const handleSave = () => {
    const payload: Record<string, any> = {
      status: "active",
      periodicidade_meses: Number(periodicidade),
      data_inicio: dataInicio || new Date().toISOString().split("T")[0],
      observacoes: observacoes || null,
    };

    if (tab === "existing") {
      payload.cliente_id = clienteId;
    } else {
      payload.nome_avulso = nomeAvulso.trim();
      payload.telefone_avulso = telefoneAvulso.trim() || null;
    }

    createPlan.mutate(payload, {
      onSuccess: () => { reset(); onOpenChange(false); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo Plano de Manutenção</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList className="w-full">
              <TabsTrigger value="existing" className="flex-1">Cliente cadastrado</TabsTrigger>
              <TabsTrigger value="avulso" className="flex-1">Cliente avulso</TabsTrigger>
            </TabsList>

            <TabsContent value="existing" className="space-y-3 mt-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cliente</Label>
                <Select value={clienteId} onValueChange={setClienteId}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={isLoading ? "Carregando..." : "Selecione"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="avulso" className="space-y-3 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={nomeAvulso} onChange={e => setNomeAvulso(e.target.value)} placeholder="Nome" className="h-9" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Telefone</Label>
                  <Input value={telefoneAvulso} onChange={e => setTelefoneAvulso(e.target.value)} placeholder="(00) 00000-0000" className="h-9" />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Periodicidade (meses)</Label>
              <Select value={periodicidade} onValueChange={setPeriodicidade}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 meses</SelectItem>
                  <SelectItem value="6">6 meses</SelectItem>
                  <SelectItem value="12">12 meses</SelectItem>
                  <SelectItem value="24">24 meses</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data de início</Label>
              <Input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Detalhes do plano..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || createPlan.isPending}>
            {createPlan.isPending ? "Salvando..." : "Criar plano"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
