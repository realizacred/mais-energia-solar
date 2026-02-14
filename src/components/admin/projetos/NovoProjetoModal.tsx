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
import { Phone, Loader2, Users, Type, Wifi } from "lucide-react";
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
      <DialogContent className="max-w-[1100px] max-h-[90vh] overflow-hidden p-0 gap-0 rounded-xl">
        <DialogHeader className="px-8 pt-6 pb-5 border-b border-border/40">
          <DialogTitle className="text-xl font-bold text-foreground tracking-tight">
            Novo Projeto
          </DialogTitle>
        </DialogHeader>

        <div className="flex overflow-hidden" style={{ minHeight: "500px" }}>
          {/* ── Coluna 1: Projeto ── */}
          <div className="w-[320px] shrink-0 px-8 py-6 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-primary">Projeto</h3>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Users className="h-6 w-6 text-muted-foreground/60" />
              </div>
            </div>

            <Field label="Nome do Projeto *">
              <Input
                placeholder="Nome do projeto"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="h-10 text-sm border-border/60"
              />
            </Field>

            <Field label="Descrição">
              <Textarea
                placeholder="Escreva aqui"
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="text-sm min-h-[68px] resize-y border-border/60"
              />
            </Field>

            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground">Vendedores</span>
                <svg className="h-4 w-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
              <Select value={consultorId} onValueChange={setConsultorId}>
                <SelectTrigger className="h-10 text-sm border-border/60">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {consultores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Vendor bars indicator */}
              <div className="flex gap-1 pt-1">
                {consultores.slice(0, 6).map((c, i) => (
                  <div
                    key={c.id}
                    className={cn(
                      "h-2 flex-1 rounded-sm transition-colors",
                      c.id === consultorId ? "bg-primary" : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
            </div>

            <Field label="Etiqueta">
              <Select value={etiqueta} onValueChange={setEtiqueta}>
                <SelectTrigger className="h-10 text-sm border-border/60">
                  <SelectValue placeholder="Selecione uma opção" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="residencial">Residencial</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="rural">Rural</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <div className="space-y-1.5">
              <div className="flex items-center gap-3 text-muted-foreground">
                <Type className="h-4 w-4 italic" />
                <Wifi className="h-4 w-4" />
              </div>
              <Textarea
                placeholder="Notas..."
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className="text-sm min-h-[60px] resize-none border-border/60"
              />
            </div>
          </div>

          {/* Divider teal */}
          <div className="w-[3px] bg-primary/60 shrink-0" />

          {/* ── Coluna 2: Cliente ── */}
          <div className="flex-1 px-8 py-6 overflow-y-auto space-y-5">
            <h3 className="text-base font-bold text-foreground">Cliente</h3>

            <Field label="Nome do Cliente *" error={errors["cliente.nome"]}>
              <Input
                placeholder="Digite o nome do cliente"
                value={cliente.nome}
                onChange={e => updateCliente("nome", e.target.value)}
                className={cn("h-10 text-sm border-border/60", errors["cliente.nome"] && "border-destructive ring-1 ring-destructive/30")}
              />
              {errors["cliente.nome"] && (
                <p className="text-xs text-destructive mt-1">Nome é obrigatório!</p>
              )}
            </Field>

            <Field label="Email do Cliente">
              <Input
                type="email"
                placeholder="Digite o email do cliente"
                value={cliente.email}
                onChange={e => updateCliente("email", e.target.value)}
                className="h-10 text-sm border-border/60"
              />
            </Field>

            <Field label="Nome da Empresa">
              <Input
                placeholder="Digite o nome da empresa"
                value={cliente.empresa}
                onChange={e => updateCliente("empresa", e.target.value)}
                className="h-10 text-sm border-border/60"
              />
            </Field>

            <Field label="CNPJ/CPF">
              <Input
                placeholder=""
                value={cliente.cpfCnpj}
                onChange={e => updateCliente("cpfCnpj", e.target.value)}
                className="h-10 text-sm border-border/60"
              />
            </Field>

            <Field label="Telefone Celular *" error={errors["cliente.telefone"]}>
              <Input
                placeholder=""
                value={cliente.telefone}
                onChange={e => updateCliente("telefone", e.target.value)}
                className={cn("h-10 text-sm border-border/60", errors["cliente.telefone"] && "border-destructive ring-1 ring-destructive/30")}
              />
              {errors["cliente.telefone"] && (
                <p className="text-xs text-destructive mt-1">Telefone é obrigatório!</p>
              )}
            </Field>
          </div>

          {/* Divider cinza */}
          <div className="w-[3px] bg-border/60 shrink-0" />

          {/* ── Coluna 3: Clientes Similares ── */}
          <div className="w-[260px] shrink-0 px-6 py-6 flex flex-col">
            <h3 className="text-base font-bold text-primary/90">Clientes similares</h3>

            {buscando ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : similares.length > 0 ? (
              <div className="mt-4 space-y-2 overflow-y-auto flex-1">
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
                    className="w-full text-left rounded-lg border border-border/50 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all space-y-1"
                  >
                    <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      {c.telefone && (
                        <span className="flex items-center gap-0.5">
                          <Phone className="h-3 w-3" />
                          {c.telefone}
                        </span>
                      )}
                      {c.email && <span className="truncate">{c.email}</span>}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                {cliente.nome.trim().length >= 2
                  ? "Nenhum cliente similar"
                  : "Nenhum cliente similar"
                }
              </p>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-4 px-8 py-4 border-t border-border/40">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors px-2"
          >
            Fechar
          </button>
          <Button
            onClick={handleSubmit}
            disabled={submitting}
            className="text-sm px-8 h-10 rounded-lg bg-primary hover:bg-primary/90"
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {submitting ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, error, children }: { label: string; error?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className={cn("text-sm font-semibold", error ? "text-destructive" : "text-foreground")}>
        {label}
      </Label>
      {children}
    </div>
  );
}
