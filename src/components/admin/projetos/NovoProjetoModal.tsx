import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Loader2, Users, MapPin, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultores: { id: string; nome: string }[];
  onSubmit?: (data: NovoProjetoData) => void | Promise<void>;
}

export interface NovoProjetoData {
  nome: string;
  descricao: string;
  consultorId: string;
  etiqueta: string;
  notas: string;
  cliente: {
    nome: string;
    email: string;
    empresa: string;
    cpfCnpj: string;
    telefone: string;
    cep: string;
    estado: string;
    cidade: string;
    endereco: string;
    numero: string;
    bairro: string;
    complemento: string;
  };
}

const emptyCliente = {
  nome: "", email: "", empresa: "", cpfCnpj: "", telefone: "",
  cep: "", estado: "", cidade: "", endereco: "", numero: "", bairro: "", complemento: "",
};

export function NovoProjetoModal({ open, onOpenChange, consultores, onSubmit }: Props) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [consultorId, setConsultorId] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [notas, setNotas] = useState("");
  const [cliente, setCliente] = useState(emptyCliente);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [similares, setSimilares] = useState<{ id: string; nome: string; telefone: string; email: string | null }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateCliente = useCallback((field: string, value: string) => {
    setCliente(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  }, [errors]);

  // Debounced search for similar clients
  useEffect(() => {
    const term = cliente.nome.trim();
    if (term.length < 2) { setSimilares([]); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await supabase
          .from("clientes")
          .select("id, nome, telefone, email")
          .ilike("nome", `%${term}%`)
          .limit(8);
        setSimilares(data ?? []);
      } catch { setSimilares([]); }
      finally { setBuscando(false); }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [cliente.nome]);

  // ViaCEP auto-fill
  const buscarCep = useCallback(async (cepRaw: string) => {
    const digits = cepRaw.replace(/\D/g, "");
    if (digits.length !== 8) return;
    setBuscandoCep(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        setCliente(prev => ({
          ...prev,
          estado: data.uf || prev.estado,
          cidade: data.localidade || prev.cidade,
          bairro: data.bairro || prev.bairro,
          endereco: data.logradouro || prev.endereco,
          complemento: data.complemento || prev.complemento,
        }));
      }
    } catch {}
    finally { setBuscandoCep(false); }
  }, []);

  const handleCepChange = useCallback((raw: string) => {
    let v = raw.replace(/\D/g, "").slice(0, 8);
    if (v.length > 5) v = `${v.slice(0,5)}-${v.slice(5)}`;
    updateCliente("cep", v);
    if (v.replace(/\D/g, "").length === 8) buscarCep(v);
  }, [updateCliente, buscarCep]);

  const handleSubmit = async () => {
    const newErrors: Record<string, boolean> = {};
    if (!cliente.nome.trim()) newErrors["cliente.nome"] = true;
    if (!cliente.telefone.trim()) newErrors["cliente.telefone"] = true;
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return; }

    setSubmitting(true);
    try {
      await onSubmit?.({ nome: nome.trim() || cliente.nome.trim(), descricao, consultorId, etiqueta, notas, cliente });
      setNome(""); setDescricao(""); setConsultorId(""); setEtiqueta(""); setNotas("");
      setCliente(emptyCliente); setErrors({}); setSimilares([]);
      onOpenChange(false);
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] lg:max-w-[1000px] max-h-[90vh] overflow-hidden p-0 gap-0 rounded-2xl flex flex-col">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/40 shrink-0">
          <DialogTitle className="text-lg font-bold text-foreground tracking-tight">
            Novo Projeto
          </DialogTitle>
        </DialogHeader>

        {/* Body - scrollable */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-6 space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[1fr_1fr_220px] lg:gap-6">

            {/* ── Coluna 1: Projeto ── */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider">Projeto</h3>

              <Field label="Nome do Projeto">
                <Input
                  placeholder="Nome do projeto"
                  value={nome}
                  onChange={e => setNome(e.target.value)}
                  className="h-10 text-sm"
                />
              </Field>

              <Field label="Descrição">
                <Textarea
                  placeholder="Escreva aqui..."
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="text-sm min-h-[68px] resize-y"
                />
              </Field>

              <Field label="Responsável">
                <Select value={consultorId} onValueChange={setConsultorId}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {consultores.map(c => (
                      <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Etiqueta">
                <Select value={etiqueta} onValueChange={setEtiqueta}>
                  <SelectTrigger className="h-10 text-sm">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="residencial">Residencial</SelectItem>
                    <SelectItem value="comercial">Comercial</SelectItem>
                    <SelectItem value="industrial">Industrial</SelectItem>
                    <SelectItem value="rural">Rural</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Notas">
                <Textarea
                  placeholder="Notas do projeto..."
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="text-sm min-h-[60px] resize-none"
                />
              </Field>
            </div>

            {/* Divider mobile */}
            <Separator className="lg:hidden" />

            {/* ── Coluna 2: Cliente ── */}
            <div className="space-y-4 lg:border-l lg:border-r lg:border-border/40 lg:px-6">
              <h3 className="text-sm font-bold text-foreground uppercase tracking-wider">Cliente</h3>

              <Field label="Nome do Cliente *" error={errors["cliente.nome"]}>
                <Input
                  placeholder="Digite o nome do cliente"
                  value={cliente.nome}
                  onChange={e => updateCliente("nome", e.target.value)}
                  className={cn("h-10 text-sm", errors["cliente.nome"] && "border-destructive ring-1 ring-destructive/30")}
                />
                {errors["cliente.nome"] && (
                  <p className="text-xs text-destructive mt-0.5">Nome é obrigatório</p>
                )}
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={cliente.email}
                  onChange={e => updateCliente("email", e.target.value)}
                  className="h-10 text-sm"
                />
              </Field>

              <Field label="Empresa">
                <Input
                  placeholder="Nome da empresa"
                  value={cliente.empresa}
                  onChange={e => updateCliente("empresa", e.target.value)}
                  className="h-10 text-sm"
                />
              </Field>

              <Field label="CPF/CNPJ">
                <Input
                  placeholder="000.000.000-00"
                  value={cliente.cpfCnpj}
                  onChange={e => updateCliente("cpfCnpj", e.target.value)}
                  className="h-10 text-sm"
                />
              </Field>

              <Field label="Telefone *" error={errors["cliente.telefone"]}>
                <Input
                  placeholder="(00) 00000-0000"
                  value={cliente.telefone}
                  onChange={e => {
                    let v = e.target.value.replace(/\D/g, "").slice(0, 11);
                    if (v.length > 6) v = `(${v.slice(0,2)}) ${v.slice(2,7)}-${v.slice(7)}`;
                    else if (v.length > 2) v = `(${v.slice(0,2)}) ${v.slice(2)}`;
                    updateCliente("telefone", v);
                  }}
                  className={cn("h-10 text-sm", errors["cliente.telefone"] && "border-destructive ring-1 ring-destructive/30")}
                />
                {errors["cliente.telefone"] && (
                  <p className="text-xs text-destructive mt-0.5">Telefone é obrigatório</p>
                )}
              </Field>

              <Separator className="opacity-40" />
              <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" /> Endereço
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <Field label="CEP">
                  <div className="relative">
                    <Input
                      placeholder="00000-000"
                      value={cliente.cep}
                      onChange={e => handleCepChange(e.target.value)}
                      className="h-9 text-sm pr-8"
                    />
                    {buscandoCep && (
                      <Loader2 className="absolute right-2.5 top-2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>
                </Field>
                <Field label="Estado">
                  <Input
                    placeholder="UF"
                    maxLength={2}
                    value={cliente.estado}
                    onChange={e => updateCliente("estado", e.target.value.toUpperCase())}
                    className="h-9 text-sm"
                  />
                </Field>
              </div>

              <Field label="Cidade">
                <Input
                  placeholder="Cidade"
                  value={cliente.cidade}
                  onChange={e => updateCliente("cidade", e.target.value)}
                  className="h-9 text-sm"
                />
              </Field>

              <Field label="Bairro">
                <Input
                  placeholder="Bairro"
                  value={cliente.bairro}
                  onChange={e => updateCliente("bairro", e.target.value)}
                  className="h-9 text-sm"
                />
              </Field>

              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Field label="Endereço">
                    <Input
                      placeholder="Rua, Avenida..."
                      value={cliente.endereco}
                      onChange={e => updateCliente("endereco", e.target.value)}
                      className="h-9 text-sm"
                    />
                  </Field>
                </div>
                <Field label="Nº">
                  <Input
                    placeholder="Nº"
                    value={cliente.numero}
                    onChange={e => updateCliente("numero", e.target.value)}
                    className="h-9 text-sm"
                  />
                </Field>
              </div>

              <Field label="Complemento">
                <Input
                  placeholder="Apto, Bloco..."
                  value={cliente.complemento}
                  onChange={e => updateCliente("complemento", e.target.value)}
                  className="h-9 text-sm"
                />
              </Field>
            </div>

            {/* Divider mobile */}
            <Separator className="lg:hidden" />

            {/* ── Coluna 3: Similares ── */}
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Search className="h-3.5 w-3.5" />
                Similares
              </h3>

              {buscando ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : similares.length > 0 ? (
                <div className="space-y-2">
                  {similares.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setCliente(prev => ({
                          ...prev,
                          nome: c.nome,
                          telefone: c.telefone || prev.telefone,
                          email: c.email || prev.email,
                        }));
                      }}
                      className="w-full text-left rounded-xl border border-border/50 p-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all space-y-0.5"
                    >
                      <p className="text-xs font-semibold text-foreground truncate">{c.nome}</p>
                      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                        {c.telefone && (
                          <span className="flex items-center gap-0.5">
                            <Phone className="h-2.5 w-2.5" />
                            {c.telefone}
                          </span>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground py-4">
                  {cliente.nome.trim().length >= 2
                    ? "Nenhum cliente similar encontrado"
                    : "Digite o nome do cliente para buscar"}
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer - always visible */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/40 bg-muted/30 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-sm h-10 px-4"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm px-8 h-10 rounded-xl"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {submitting ? "Cadastrando..." : "Cadastrar Projeto"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-xs font-semibold", error ? "text-destructive" : "text-foreground")}>
        {label}
      </Label>
      {children}
    </div>
  );
}
