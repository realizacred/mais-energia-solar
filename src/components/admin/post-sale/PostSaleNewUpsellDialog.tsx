import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useCreateUpsell } from "@/hooks/usePostSale";
import { usePostSaleClients } from "@/hooks/usePostSaleClients";

const TIPOS = [
  { value: "bateria", label: "Bateria" },
  { value: "expansao", label: "Expansão" },
  { value: "carregador_ev", label: "Carregador EV" },
  { value: "troca_inversor", label: "Troca Inversor" },
];

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PostSaleNewUpsellDialog({ open, onOpenChange }: Props) {
  const [tab, setTab] = useState<"existing" | "avulso">("existing");
  const [clienteId, setClienteId] = useState("");
  const [nomeAvulso, setNomeAvulso] = useState("");
  const [telefoneAvulso, setTelefoneAvulso] = useState("");
  const [tipo, setTipo] = useState("bateria");
  const [descricao, setDescricao] = useState("");

  const { data: clientes = [], isLoading } = usePostSaleClients();
  const createUpsell = useCreateUpsell();

  const reset = () => {
    setTab("existing");
    setClienteId("");
    setNomeAvulso("");
    setTelefoneAvulso("");
    setTipo("bateria");
    setDescricao("");
  };

  const canSave = tab === "existing" ? !!clienteId : !!nomeAvulso.trim();

  const handleSave = () => {
    const payload: Record<string, any> = {
      tipo,
      status: "pendente",
      descricao: descricao || null,
    };

    if (tab === "existing") {
      payload.cliente_id = clienteId;
    } else {
      payload.nome_avulso = nomeAvulso.trim();
      payload.telefone_avulso = telefoneAvulso.trim() || null;
    }

    createUpsell.mutate(payload, {
      onSuccess: () => { reset(); onOpenChange(false); },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nova Oportunidade de Upsell</DialogTitle>
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

          <div className="space-y-1.5">
            <Label className="text-xs">Tipo *</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TIPOS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Descrição</Label>
            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} placeholder="Detalhes da oportunidade..." rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancelar</Button>
          <Button onClick={handleSave} disabled={!canSave || createUpsell.isPending}>
            {createUpsell.isPending ? "Salvando..." : "Criar oportunidade"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
