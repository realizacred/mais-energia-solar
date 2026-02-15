import { useState, useCallback, useMemo, useEffect } from "react";
import { Search, User, MapPin, Building2, Loader2, AlertTriangle, ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { MOCK_CLIENTES, type MockCliente } from "./mockData";
import type { WizClienteData, WizObraData } from "./wizardState";

const UF_LIST = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT",
  "PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

interface Props {
  cliente: WizClienteData;
  onClienteChange: (c: WizClienteData) => void;
  obra: WizObraData;
  onObraChange: (o: WizObraData) => void;
}

export function StepClienteObra({ cliente, onClienteChange, obra, onObraChange }: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<MockCliente | null>(null);
  const [fetchingCep, setFetchingCep] = useState(false);
  const [fetchingObraCep, setFetchingObraCep] = useState(false);

  const results = useMemo(() => {
    if (!search || search.length < 2) return MOCK_CLIENTES.slice(0, 5);
    const q = search.toLowerCase();
    return MOCK_CLIENTES.filter(c =>
      c.nome.toLowerCase().includes(q) || c.telefone.includes(q) || c.cpf_cnpj.includes(q)
    );
  }, [search]);

  const handleSelect = (c: MockCliente) => {
    setSelected(c);
    onClienteChange({ ...c });
    if (obra.mesmoEnderecoCliente) {
      onObraChange({ ...obra, cep: c.cep, endereco: c.endereco, numero: c.numero, bairro: c.bairro, cidade: c.cidade, estado: c.estado });
    }
    setSearch("");
  };

  const handleClear = () => {
    setSelected(null);
    onClienteChange({ nome: "", telefone: "", cpf_cnpj: "", email: "", cep: "", endereco: "", numero: "", bairro: "", cidade: "", estado: "" });
  };

  const updateCliente = (field: keyof WizClienteData, value: string) => {
    const updated = { ...cliente, [field]: value };
    onClienteChange(updated);
    if (obra.mesmoEnderecoCliente && ["cep", "endereco", "numero", "bairro", "cidade", "estado"].includes(field)) {
      onObraChange({ ...obra, [field]: value });
    }
  };

  const updateObra = (field: keyof WizObraData, value: any) => {
    onObraChange({ ...obra, [field]: value });
  };

  const toggleMesmoEndereco = (checked: boolean) => {
    if (checked) {
      onObraChange({ ...obra, mesmoEnderecoCliente: true, cep: cliente.cep, endereco: cliente.endereco, numero: cliente.numero, bairro: cliente.bairro, cidade: cliente.cidade, estado: cliente.estado });
    } else {
      onObraChange({ ...obra, mesmoEnderecoCliente: false });
    }
  };

  // CEP auto-fill
  useEffect(() => {
    const cepDigits = cliente.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return;
    const t = setTimeout(async () => {
      setFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          const upd = { ...cliente, endereco: data.logradouro || cliente.endereco, bairro: data.bairro || cliente.bairro, cidade: data.localidade || cliente.cidade, estado: data.uf || cliente.estado };
          onClienteChange(upd);
          if (obra.mesmoEnderecoCliente) {
            onObraChange({ ...obra, cep: cliente.cep, endereco: upd.endereco, bairro: upd.bairro, cidade: upd.cidade, estado: upd.estado });
          }
        }
      } catch {} finally { setFetchingCep(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [cliente.cep]);

  useEffect(() => {
    if (obra.mesmoEnderecoCliente) return;
    const cepDigits = obra.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return;
    const t = setTimeout(async () => {
      setFetchingObraCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          onObraChange({ ...obra, endereco: data.logradouro || obra.endereco, bairro: data.bairro || obra.bairro, cidade: data.localidade || obra.cidade, estado: data.uf || obra.estado });
        }
      } catch {} finally { setFetchingObraCep(false); }
    }, 400);
    return () => clearTimeout(t);
  }, [obra.cep, obra.mesmoEnderecoCliente]);

  const hasName = cliente.nome.trim().length > 0;
  const hasTel = cliente.telefone.replace(/\D/g, "").length >= 10;
  const showCreateCTA = search.length >= 3 && results.length === 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── LEFT: Cliente ── */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <User className="h-3.5 w-3.5" /> Cliente
        </h4>

        {/* Search / select */}
        {selected ? (
          <div className="flex items-center justify-between p-2.5 bg-primary/5 rounded-md border border-primary/15">
            <div>
              <p className="text-sm font-semibold">{selected.nome}</p>
              <p className="text-[10px] text-muted-foreground">{selected.telefone} • {selected.cpf_cnpj}</p>
            </div>
            <Button variant="ghost" size="sm" className="h-6 text-[10px]" onClick={handleClear}>Trocar</Button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar cliente por nome, telefone ou CPF..."
                className="h-8 text-xs pl-8"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {search.length >= 2 && (
              <div className="border rounded-md divide-y max-h-32 overflow-y-auto">
                {results.map(c => (
                  <button key={c.id} className="w-full text-left px-3 py-1.5 hover:bg-muted/50 transition-colors" onClick={() => handleSelect(c)}>
                    <p className="text-xs font-medium truncate">{c.nome}</p>
                    <p className="text-[10px] text-muted-foreground">{c.telefone}</p>
                  </button>
                ))}
              </div>
            )}
            {showCreateCTA && (
              <button
                className="w-full text-left px-3 py-2 rounded-md border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
                onClick={() => updateCliente("nome", search)}
              >
                <p className="text-xs font-medium text-primary flex items-center gap-1.5">
                  <ArrowRight className="h-3 w-3" /> Cadastrar "{search}"
                </p>
              </button>
            )}
          </div>
        )}

        {/* Fields */}
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[10px]">Nome *</Label>
              <Input value={cliente.nome} onChange={e => updateCliente("nome", e.target.value)} className={cn("h-8 text-xs", !hasName && "border-destructive/40")} />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Celular *</Label>
              <Input value={cliente.telefone} onChange={e => updateCliente("telefone", e.target.value)} placeholder="(00) 00000-0000" className={cn("h-8 text-xs", !hasTel && cliente.telefone && "border-destructive/40")} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[10px]">CPF/CNPJ</Label>
              <Input value={cliente.cpf_cnpj} onChange={e => updateCliente("cpf_cnpj", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">E-mail</Label>
              <Input type="email" value={cliente.email} onChange={e => updateCliente("email", e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[10px] flex items-center gap-1">CEP {fetchingCep && <Loader2 className="h-2.5 w-2.5 animate-spin" />}</Label>
              <Input value={cliente.cep} onChange={e => updateCliente("cep", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-0.5 col-span-2">
              <Label className="text-[10px]">Endereço</Label>
              <Input value={cliente.endereco} onChange={e => updateCliente("endereco", e.target.value)} className="h-8 text-xs" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div className="space-y-0.5">
              <Label className="text-[10px]">Nº</Label>
              <Input value={cliente.numero} onChange={e => updateCliente("numero", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Bairro</Label>
              <Input value={cliente.bairro} onChange={e => updateCliente("bairro", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">Cidade</Label>
              <Input value={cliente.cidade} onChange={e => updateCliente("cidade", e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[10px]">UF</Label>
              <Select value={cliente.estado} onValueChange={v => updateCliente("estado", v)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
                <SelectContent>{UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* ── RIGHT: Obra ── */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5" /> Local da Usina
        </h4>

        <div className="flex items-center gap-2 p-2 rounded-md bg-muted/30 border border-border/30">
          <Checkbox
            id="mesmoEnd"
            checked={obra.mesmoEnderecoCliente}
            onCheckedChange={(c) => toggleMesmoEndereco(!!c)}
          />
          <label htmlFor="mesmoEnd" className="text-[11px] text-muted-foreground cursor-pointer">
            Mesmo endereço do cliente
          </label>
          {obra.mesmoEnderecoCliente && <Check className="h-3 w-3 text-success ml-auto" />}
        </div>

        {!obra.mesmoEnderecoCliente && (
          <div className="space-y-2">
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[10px] flex items-center gap-1">CEP {fetchingObraCep && <Loader2 className="h-2.5 w-2.5 animate-spin" />}</Label>
                <Input value={obra.cep} onChange={e => updateObra("cep", e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5 col-span-2">
                <Label className="text-[10px]">Endereço</Label>
                <Input value={obra.endereco} onChange={e => updateObra("endereco", e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[10px]">Nº</Label>
                <Input value={obra.numero} onChange={e => updateObra("numero", e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Bairro</Label>
                <Input value={obra.bairro} onChange={e => updateObra("bairro", e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">Cidade</Label>
                <Input value={obra.cidade} onChange={e => updateObra("cidade", e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-0.5">
                <Label className="text-[10px]">UF</Label>
                <Select value={obra.estado} onValueChange={v => updateObra("estado", v)}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="UF" /></SelectTrigger>
                  <SelectContent>{UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {obra.mesmoEnderecoCliente && cliente.endereco && (
          <div className="p-2.5 rounded-md bg-muted/20 border border-border/30 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">{cliente.endereco}{cliente.numero ? `, ${cliente.numero}` : ""}</p>
            <p>{cliente.bairro && `${cliente.bairro} — `}{cliente.cidade}/{cliente.estado}</p>
            <p className="font-mono text-[10px]">CEP: {cliente.cep}</p>
          </div>
        )}
      </div>
    </div>
  );
}
