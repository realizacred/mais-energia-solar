import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCreateVisit } from "@/hooks/usePostSale";
import { usePostSaleClients } from "@/hooks/usePostSaleClients";

const TIPOS = [
  { value: "preventiva", label: "Preventiva" },
  { value: "limpeza", label: "Limpeza" },
  { value: "suporte", label: "Suporte" },
  { value: "vistoria", label: "Vistoria" },
  { value: "corretiva", label: "Corretiva" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostSaleNewVisitDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<"existing" | "avulso">("existing");
  const [clienteId, setClienteId] = useState("");
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [telefoneAvulso, setTelefoneAvulso] = useState("");
  const [tipo, setTipo] = useState("preventiva");
  const [dataPrevista, setDataPrevista] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const { data: clientes = [], isLoading: loadingClientes } = usePostSaleClients();
  const createVisit = useCreateVisit();

  const reset = () => {
    setTab("existing");
    setClienteId("");
    setNomeAvulso("");
    setTelefoneAvulso("");
    setTipo("preventiva");
    setDataPrevista("");
    setObservacoes("");
  };

  const canSave = tab === "existing"
    ? !!clienteId && !!tipo
    : !!nomeAvulso.trim() && !!tipo;

  const handleSave = () => {
    const payload: Record<string, any> = {
      tipo,
      status: "pendente",
      data_prevista: dataPrevista || null,
      observacoes: observacoes || null,
    };

    if (tab === "existing") {
      payload.cliente_id = clienteId;
    } else {
      payload.nome_avulso = nomeAvulso.trim();
      payload.telefone_avulso = telefoneAvulso.trim() || null;
    }

    createVisit.mutate(payload, {
      onSuccess: () => {
        reset();
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Visita</DialogTitle>
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
                    <SelectValue placeholder={loadingClientes ? "Carregando..." : "Selecione um cliente"} />
                  </SelectTrigger>
                  <SelectContent>
                    {clientes.map(c => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome} {c.cidade ? `(${c.cidade})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </TabsContent>

            <TabsContent value="avulso" className="space-y-3 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={nomeAvulso} onChange={e => setNomeAvulso(e.target.value)} placeholder="Nome do cliente" className="h-9" />
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
              <Label className="text-xs">Tipo de serviço *</Label>
              <Select value={tipo} onValueChange={setTipo}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Data prevista</Label>
              <Input type="date" value={dataPrevista} onChange={e => setDataPrevista(e.target.value)} className="h-9" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} placeholder="Notas, detalhes do serviço..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || createVisit.isPending}>
            {createVisit.isPending ? "Salvando..." : "Criar visita"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
