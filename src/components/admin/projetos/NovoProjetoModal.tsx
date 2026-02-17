import { useState, useCallback, useEffect, useRef, useMemo } from "react";
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
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Phone, Loader2, Users, MapPin, Search, FolderKanban } from "lucide-react";
import { cn } from "@/lib/utils";

interface DynamicEtiqueta {
  id: string;
  nome: string;
  cor: string;
  grupo: string;
  short: string | null;
  icon: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultores: { id: string; nome: string }[];
  onSubmit?: (data: NovoProjetoData) => void | Promise<void>;
  defaultConsultorId?: string;
  dynamicEtiquetas?: DynamicEtiqueta[];
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

const autoCapitalize = (value: string) =>
  value.replace(/\b\w/g, (char) => char.toUpperCase());

const emptyCliente = {
  nome: "", email: "", empresa: "", cpfCnpj: "", telefone: "",
  cep: "", estado: "", cidade: "", endereco: "", numero: "", bairro: "", complemento: "",
};

export function NovoProjetoModal({ open, onOpenChange, consultores, onSubmit, defaultConsultorId, dynamicEtiquetas = [] }: Props) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [consultorId, setConsultorId] = useState(defaultConsultorId || "");
  const [etiqueta, setEtiqueta] = useState("");
  const [notas, setNotas] = useState("");
  const [cliente, setCliente] = useState(emptyCliente);
  const [errors, setErrors] = useState<Record<string, boolean>>({});
  const [similares, setSimilares] = useState<{ id: string; nome: string; telefone: string; email: string | null }[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      setConsultorId(defaultConsultorId || "");
    }
  }, [open, defaultConsultorId]);

  const etiquetaGroups = useMemo(() => {
    const groups = new Map<string, DynamicEtiqueta[]>();
    dynamicEtiquetas.forEach(e => {
      const arr = groups.get(e.grupo) || [];
      arr.push(e);
      groups.set(e.grupo, arr);
    });
    return groups;
  }, [dynamicEtiquetas]);

  const updateCliente = useCallback((field: string, value: string) => {
    setCliente(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  }, [errors]);

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
      <DialogContent className="max-w-[95vw] sm:max-w-[600px] lg:max-w-[1060px] max-h-[92vh] overflow-hidden p-0 gap-0 rounded-2xl flex flex-col border-2 border-border/60 shadow-2xl bg-card">
        {/* Header */}
        <DialogHeader className="px-6 pt-5 pb-4 border-b-2 border-primary/20 bg-gradient-to-r from-primary/5 via-transparent to-secondary/5 shrink-0">
          <DialogTitle className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2.5">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10">
              <FolderKanban className="h-4.5 w-4.5 text-primary" />
            </div>
            Novo projeto
          </DialogTitle>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 overflow-auto">
          <div className="p-5 lg:p-6 space-y-5 lg:space-y-0 lg:grid lg:grid-cols-[1fr_1fr_220px] lg:gap-0">

            {/* ── Coluna 1: Projeto ── */}
            <div className="space-y-3.5 lg:pr-5">
              <SectionHeader icon={<Users className="h-3.5 w-3.5" />} label="Projeto" color="primary" />

              <Field label="Nome do projeto">
                <Input
                  placeholder="Nome do projeto"
                  value={nome}
                  onChange={e => setNome(autoCapitalize(e.target.value))}
                  className="h-9 text-sm bg-muted/40 border-border/60 focus:border-primary/50 focus:bg-card transition-colors"
                />
              </Field>

              <Field label="Descrição">
                <Textarea
                  placeholder="Escreva aqui..."
                  value={descricao}
                  onChange={e => setDescricao(e.target.value)}
                  className="text-sm min-h-[64px] resize-y bg-muted/40 border-border/60 focus:border-primary/50 focus:bg-card transition-colors"
                />
              </Field>

              <Field label="Consultor">
                <Select value={consultorId} onValueChange={setConsultorId}>
                  <SelectTrigger className="h-9 text-sm bg-muted/40 border-border/60">
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
                  <SelectTrigger className="h-9 text-sm bg-muted/40 border-border/60">
                    <SelectValue placeholder="Selecione">
                      {etiqueta && (() => {
                        const found = dynamicEtiquetas.find(e => e.id === etiqueta || e.nome === etiqueta);
                        return found ? (
                          <span
                            className="text-[10px] font-bold rounded-full px-2 py-0.5 text-white"
                            style={{ backgroundColor: found.cor }}
                          >
                            {found.icon ? `${found.icon} ` : ""}{found.short || found.nome}
                          </span>
                        ) : null;
                      })()}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from(etiquetaGroups.entries()).map(([grupo, items]) => (
                      <SelectGroup key={grupo}>
                        <SelectLabel className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                          {grupo}
                        </SelectLabel>
                        {items.map(et => (
                          <SelectItem key={et.id} value={et.id}>
                            <span
                              className="text-[10px] font-bold rounded-full px-2 py-0.5 text-white mr-2"
                              style={{ backgroundColor: et.cor }}
                            >
                              {et.icon ? `${et.icon} ` : ""}{et.short || et.nome.substring(0, 3).toUpperCase()}
                            </span>
                            {et.nome}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field label="Notas">
                <Textarea
                  placeholder="Notas do projeto..."
                  value={notas}
                  onChange={e => setNotas(e.target.value)}
                  className="text-sm min-h-[56px] resize-none bg-muted/40 border-border/60 focus:border-primary/50 focus:bg-card transition-colors"
                />
              </Field>
            </div>

            {/* ── Coluna 2: Cliente ── */}
            <div className="space-y-3.5 lg:border-l-2 lg:border-r-2 lg:border-border/40 lg:px-5">
              <SectionHeader icon={<Phone className="h-3.5 w-3.5" />} label="Cliente" color="secondary" />

              <Field label="Nome do cliente *" error={errors["cliente.nome"]}>
                <Input
                  placeholder="Digite o nome do cliente"
                  value={cliente.nome}
                  onChange={e => updateCliente("nome", autoCapitalize(e.target.value))}
                  className={cn(
                    "h-9 text-sm bg-muted/40 border-border/60 focus:border-primary/50 focus:bg-card transition-colors",
                    errors["cliente.nome"] && "border-destructive ring-1 ring-destructive/30 bg-destructive/5"
                  )}
                />
                {errors["cliente.nome"] && (
                  <p className="text-[11px] text-destructive mt-0.5 font-medium">Nome é obrigatório</p>
                )}
              </Field>

              <Field label="Email">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={cliente.email}
                  onChange={e => updateCliente("email", e.target.value)}
                  className="h-9 text-sm bg-muted/40 border-border/60 focus:border-primary/50 focus:bg-card transition-colors"
                />
              </Field>

              <div className="grid grid-cols-2 gap-3">
                <Field label="Empresa">
                  <Input
                    placeholder="Nome da empresa"
                    value={cliente.empresa}
                    onChange={e => updateCliente("empresa", autoCapitalize(e.target.value))}
                    className="h-9 text-sm bg-muted/40 border-border/60 focus:border-primary/50 focus:bg-card transition-colors"
                  />
                </Field>
                <Field label="CPF/CNPJ">
                  <Input
                    placeholder="000.000.000-00"
                    value={cliente.cpfCnpj}
                    onChange={e => updateCliente("cpfCnpj", e.target.value)}
                    className="h-9 text-sm bg-muted/40 border-border/60 focus:border-primary/50 focus:bg-card transition-colors"
                  />
                </Field>
              </div>

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
                  className={cn(
                    "h-9 text-sm bg-muted/40 border-border/60 focus:border-primary/50 focus:bg-card transition-colors",
                    errors["cliente.telefone"] && "border-destructive ring-1 ring-destructive/30 bg-destructive/5"
                  )}
                />
                {errors["cliente.telefone"] && (
                  <p className="text-[11px] text-destructive mt-0.5 font-medium">Telefone é obrigatório</p>
                )}
              </Field>

              {/* Endereço sub-section */}
              <div className="rounded-xl border border-border/50 bg-muted/20 p-3.5 space-y-3 mt-1">
                <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <MapPin className="h-3 w-3 text-primary/60" /> Endereço
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="CEP">
                    <div className="relative">
                      <Input
                        placeholder="00000-000"
                        value={cliente.cep}
                        onChange={e => handleCepChange(e.target.value)}
                        className="h-8 text-xs pr-7 bg-card border-border/50"
                      />
                      {buscandoCep && (
                        <Loader2 className="absolute right-2 top-1.5 h-3.5 w-3.5 animate-spin text-primary/50" />
                      )}
                    </div>
                  </Field>
                  <Field label="Estado">
                    <Input
                      placeholder="UF"
                      maxLength={2}
                      value={cliente.estado}
                      onChange={e => updateCliente("estado", e.target.value.toUpperCase())}
                      className="h-8 text-xs bg-card border-border/50"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="Cidade">
                    <Input
                      placeholder="Cidade"
                      value={cliente.cidade}
                      onChange={e => updateCliente("cidade", autoCapitalize(e.target.value))}
                      className="h-8 text-xs bg-card border-border/50"
                    />
                  </Field>
                  <Field label="Bairro">
                    <Input
                      placeholder="Bairro"
                      value={cliente.bairro}
                      onChange={e => updateCliente("bairro", autoCapitalize(e.target.value))}
                      className="h-8 text-xs bg-card border-border/50"
                    />
                  </Field>
                </div>

                <div className="grid grid-cols-[1fr_64px] gap-2.5">
                  <Field label="Endereço">
                    <Input
                      placeholder="Rua, Avenida..."
                      value={cliente.endereco}
                      onChange={e => updateCliente("endereco", autoCapitalize(e.target.value))}
                      className="h-8 text-xs bg-card border-border/50"
                    />
                  </Field>
                  <Field label="Nº">
                    <Input
                      placeholder="Nº"
                      value={cliente.numero}
                      onChange={e => updateCliente("numero", e.target.value)}
                      className="h-8 text-xs bg-card border-border/50"
                    />
                  </Field>
                </div>

                <Field label="Complemento">
                  <Input
                    placeholder="Apto, Bloco..."
                    value={cliente.complemento}
                    onChange={e => updateCliente("complemento", autoCapitalize(e.target.value))}
                    className="h-8 text-xs bg-card border-border/50"
                  />
                </Field>
              </div>
            </div>

            {/* ── Coluna 3: Similares ── */}
            <div className="space-y-3 lg:pl-5">
              <SectionHeader icon={<Search className="h-3.5 w-3.5" />} label="Clientes similares" color="warning" />

              {buscando ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 className="h-5 w-5 animate-spin text-primary/40" />
                </div>
              ) : similares.length > 0 ? (
                <div className="space-y-1.5">
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
                      className="w-full text-left rounded-lg border border-border/50 bg-muted/30 p-2.5 hover:border-primary/40 hover:bg-primary/5 transition-all space-y-0.5 group"
                    >
                      <p className="text-xs font-semibold text-foreground truncate group-hover:text-primary transition-colors">{c.nome}</p>
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
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-10 w-10 rounded-full bg-muted/60 flex items-center justify-center mb-2">
                    <Search className="h-4 w-4 text-muted-foreground/50" />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {cliente.nome.trim().length >= 2
                      ? "Nenhum cliente similar encontrado"
                      : "Digite o nome do cliente para buscar"}
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-3.5 border-t-2 border-border/40 bg-muted/20 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-sm h-9 px-5"
          >
            Fechar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm px-7 h-9 rounded-xl shadow-sm"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {submitting ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Sub-components ── */

function SectionHeader({ icon, label, color }: { icon: React.ReactNode; label: string; color: "primary" | "secondary" | "warning" }) {
  const colorMap = {
    primary: "text-primary bg-primary/10 border-primary/20",
    secondary: "text-secondary bg-secondary/10 border-secondary/20",
    warning: "text-warning bg-warning/10 border-warning/20",
  };
  return (
    <div className="flex items-center gap-2 pb-1">
      <div className={cn("flex items-center justify-center h-6 w-6 rounded-md border", colorMap[color])}>
        {icon}
      </div>
      <h3 className={cn("text-xs font-bold uppercase tracking-wider", `text-${color}`)}>
        {label}
      </h3>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className={cn("text-[11px] font-semibold tracking-wide", error ? "text-destructive" : "text-muted-foreground")}>
        {label}
      </Label>
      {children}
    </div>
  );
}
