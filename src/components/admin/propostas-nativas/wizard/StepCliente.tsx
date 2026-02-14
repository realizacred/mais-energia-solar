import { useState, useEffect, useCallback, useRef } from "react";
import { Search, User, Plus, AlertTriangle, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import { toast } from "@/hooks/use-toast";
import { type LeadSelection, type ClienteData, UF_LIST } from "./types";

interface Props {
  selectedLead: LeadSelection | null;
  onSelectLead: (lead: LeadSelection) => void;
  onClearLead: () => void;
  cliente: ClienteData;
  onClienteChange: (c: ClienteData) => void;
}

interface DuplicateWarning {
  field: "celular" | "cnpj_cpf";
  message: string;
  clienteId: string;
  clienteNome: string;
}

export function StepCliente({ selectedLead, onSelectLead, onClearLead, cliente, onClienteChange }: Props) {
  const [search, setSearch] = useState("");
  const [leads, setLeads] = useState<any[]>([]);
  const [searching, setSearching] = useState(true);
  const [duplicateWarnings, setDuplicateWarnings] = useState<DuplicateWarning[]>([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const { cidades, isLoading: cidadesLoading } = useCidadesPorEstado(cliente.estado);

  const fetchLeads = useCallback(async (q: string) => {
    setSearching(true);
    try {
      let query = supabase
        .from("leads")
        .select("id, nome, telefone, lead_code, estado, cidade, consumo_kwh, media_consumo, tipo_telhado, email, rede_atendimento")
        .order("created_at", { ascending: false })
        .limit(20);
      if (q.length >= 2) {
        const safe = q.replace(/[%_]/g, "");
        query = query.or(`nome.ilike.%${safe}%,telefone.ilike.%${safe}%,lead_code.ilike.%${safe}%`);
      }
      const { data, error } = await query;
      console.log("[StepCliente] fetchLeads result:", { q, count: data?.length, error: error?.message });
      if (error) {
        console.error("[StepCliente] Erro ao buscar leads:", error.message);
        toast({ title: "Erro ao buscar leads", description: error.message, variant: "destructive" });
      }
      setLeads(data || []);
    } catch (e: any) {
      console.error("[StepCliente] Exception ao buscar leads:", e);
      toast({ title: "Erro ao buscar leads", description: e?.message || "Erro desconhecido", variant: "destructive" });
      setLeads([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchLeads(search), search ? 300 : 0);
    return () => clearTimeout(t);
  }, [search, fetchLeads]);

  // Duplicate detection for phone and CPF
  useEffect(() => {
    const phone = cliente.celular.replace(/\D/g, "");
    const cpf = cliente.cnpj_cpf.replace(/\D/g, "");
    if (phone.length < 10 && cpf.length < 11) {
      setDuplicateWarnings([]);
      return;
    }

    const t = setTimeout(async () => {
      setCheckingDuplicates(true);
      const warnings: DuplicateWarning[] = [];
      try {
        if (phone.length >= 10) {
          const { data } = await supabase
            .from("clientes")
            .select("id, nome, telefone")
            .or(`telefone.ilike.%${phone.slice(-8)}%,telefone_normalized.ilike.%${phone.slice(-8)}%`)
            .limit(3);
          if (data && data.length > 0) {
            data.forEach(c => {
              warnings.push({
                field: "celular",
                message: `Telefone já cadastrado para: ${c.nome}`,
                clienteId: c.id,
                clienteNome: c.nome,
              });
            });
          }
        }
        if (cpf.length >= 11) {
          const { data } = await supabase
            .from("clientes")
            .select("id, nome, cpf_cnpj")
            .ilike("cpf_cnpj", `%${cpf}%`)
            .limit(3);
          if (data && data.length > 0) {
            data.forEach(c => {
              if (!warnings.some(w => w.clienteId === c.id)) {
                warnings.push({
                  field: "cnpj_cpf",
                  message: `CPF/CNPJ já cadastrado para: ${c.nome}`,
                  clienteId: c.id,
                  clienteNome: c.nome,
                });
              }
            });
          }
        }
      } catch { /* ignore */ }
      setDuplicateWarnings(warnings);
      setCheckingDuplicates(false);
    }, 500);

    return () => clearTimeout(t);
  }, [cliente.celular, cliente.cnpj_cpf]);

  const handleSelect = (lead: any) => {
    onSelectLead(lead);
    onClienteChange({
      ...cliente,
      nome: lead.nome || cliente.nome,
      celular: lead.telefone || cliente.celular,
      email: lead.email || cliente.email,
      estado: lead.estado || cliente.estado,
      cidade: lead.cidade || cliente.cidade,
    });
    setSearch("");
  };

  const [fetchingCep, setFetchingCep] = useState(false);

  const update = (field: keyof ClienteData, value: string) => {
    if (field === "estado" && value !== cliente.estado) {
      onClienteChange({ ...cliente, [field]: value, cidade: "" });
    } else {
      onClienteChange({ ...cliente, [field]: value });
    }
  };

  // CEP auto-fill via ViaCEP
  useEffect(() => {
    const cepDigits = cliente.cep.replace(/\D/g, "");
    if (cepDigits.length !== 8) return;

    const t = setTimeout(async () => {
      setFetchingCep(true);
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`);
        const data = await res.json();
        if (!data.erro) {
          onClienteChange({
            ...cliente,
            endereco: data.logradouro || cliente.endereco,
            bairro: data.bairro || cliente.bairro,
            cidade: data.localidade || cliente.cidade,
            estado: data.uf || cliente.estado,
            complemento: data.complemento || cliente.complemento,
          });
        }
      } catch {
        // ViaCEP offline — ignore
      } finally {
        setFetchingCep(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [cliente.cep]);

  return (
    <div className="space-y-5">
      <h3 className="text-base font-bold flex items-center gap-2">
        <User className="h-4 w-4 text-primary" /> Cliente
      </h3>

      {/* Lead selection (optional) */}
      {selectedLead ? (
        <div className="flex items-center justify-between p-4 bg-primary/5 rounded-xl border border-primary/15">
          <div>
            <p className="font-semibold">{selectedLead.nome}</p>
            <p className="text-sm text-muted-foreground">{selectedLead.telefone} • {selectedLead.lead_code}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClearLead}>Trocar</Button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">Vincule um lead existente (opcional) ou preencha os dados manualmente abaixo.</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar lead por nome, telefone ou código..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          {searching ? (
            <p className="text-sm text-muted-foreground text-center py-4 animate-pulse">Buscando...</p>
          ) : leads.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum lead encontrado.</p>
          ) : (
            <div className="border rounded-xl divide-y max-h-60 overflow-y-auto">
              {leads.map(l => (
                <button key={l.id} className="w-full text-left px-4 py-3 hover:bg-muted/50 transition-colors" onClick={() => handleSelect(l)}>
                  <p className="font-medium text-sm truncate">{l.nome}</p>
                  <p className="text-xs text-muted-foreground">{l.telefone} • {l.lead_code}{l.estado ? ` • ${l.estado}` : ""}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Duplicate warnings */}
      {duplicateWarnings.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/5 p-3 space-y-2">
          <p className="text-xs font-semibold text-warning flex items-center gap-1.5">
            <AlertTriangle className="h-3.5 w-3.5" /> Possíveis duplicidades encontradas
          </p>
          {duplicateWarnings.map((w, i) => (
            <div key={i} className="flex items-center justify-between gap-2 text-sm">
              <span className="text-warning">{w.message}</span>
              <div className="flex gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-6 text-[10px] px-2"
                  onClick={() => {
                    // Pre-fill with existing client data
                    onClienteChange({ ...cliente, nome: w.clienteNome });
                    toast({ title: `Dados de "${w.clienteNome}" carregados`, description: "Você pode continuar com os dados deste cliente." });
                    setDuplicateWarnings([]);
                  }}
                >
                  Usar este cliente
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] px-2 text-muted-foreground"
                  onClick={() => setDuplicateWarnings(prev => prev.filter((_, idx) => idx !== i))}
                >
                  Ignorar
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cliente fields */}
      <div className="rounded-xl border border-border/50 p-4 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados do Cliente</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nome *</Label>
            <Input value={cliente.nome} onChange={e => update("nome", e.target.value)} placeholder="Nome completo" className={`h-9 ${!cliente.nome.trim() ? "border-destructive/50" : ""}`} />
            {!cliente.nome.trim() && <p className="text-[10px] text-destructive">Obrigatório para avançar</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Empresa</Label>
            <Input value={cliente.empresa} onChange={e => update("empresa", e.target.value)} placeholder="Empresa (opcional)" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">CPF/CNPJ</Label>
            <Input
              value={cliente.cnpj_cpf}
              onChange={e => update("cnpj_cpf", e.target.value)}
              placeholder="000.000.000-00"
              className={`h-9 ${duplicateWarnings.some(w => w.field === "cnpj_cpf") ? "border-warning focus-visible:ring-warning" : ""}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">E-mail</Label>
            <Input type="email" value={cliente.email} onChange={e => update("email", e.target.value)} placeholder="email@exemplo.com" className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Celular *</Label>
            <Input
              value={cliente.celular}
              onChange={e => update("celular", e.target.value)}
              placeholder="(00) 00000-0000"
              className={`h-9 ${!cliente.celular.trim() ? "border-destructive/50" : ""} ${duplicateWarnings.some(w => w.field === "celular") ? "border-warning focus-visible:ring-warning" : ""}`}
            />
            {!cliente.celular.trim() && <p className="text-[10px] text-destructive">Obrigatório para avançar</p>}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs flex items-center gap-1">
              CEP
              {fetchingCep && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </Label>
            <div className="relative">
              <Input value={cliente.cep} onChange={e => update("cep", e.target.value)} placeholder="00000-000" className="h-9" />
              {fetchingCep && (
                <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-primary animate-pulse" />
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Endereço</Label>
            <Input value={cliente.endereco} onChange={e => update("endereco", e.target.value)} placeholder="Rua, Av..." className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Número</Label>
            <Input value={cliente.numero} onChange={e => update("numero", e.target.value)} placeholder="Nº" className="h-9" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Complemento</Label>
            <Input value={cliente.complemento} onChange={e => update("complemento", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Bairro</Label>
            <Input value={cliente.bairro} onChange={e => update("bairro", e.target.value)} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Estado</Label>
            <Select value={cliente.estado} onValueChange={v => update("estado", v)}>
              <SelectTrigger className="h-9"><SelectValue placeholder="UF" /></SelectTrigger>
              <SelectContent>
                {UF_LIST.map(uf => <SelectItem key={uf} value={uf}>{uf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{cidadesLoading ? "Carregando cidades..." : "Cidade"}</Label>
            {cidades.length > 0 ? (
              <Select value={cliente.cidade} onValueChange={v => update("cidade", v)}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {cidades.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input value={cliente.cidade} onChange={e => update("cidade", e.target.value)} className="h-9" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
