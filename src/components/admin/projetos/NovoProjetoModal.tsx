import { useState, useCallback } from "react";
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
import { Search, User, Building2, FileText, Tag, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultores: { id: string; nome: string }[];
  onSubmit?: (data: NovoProjetoData) => void;
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
  nome: "",
  email: "",
  empresa: "",
  cpfCnpj: "",
  telefone: "",
  cep: "",
  estado: "",
  cidade: "",
  endereco: "",
  numero: "",
  bairro: "",
  complemento: "",
};

export function NovoProjetoModal({ open, onOpenChange, consultores, onSubmit }: Props) {
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [consultorId, setConsultorId] = useState("");
  const [etiqueta, setEtiqueta] = useState("");
  const [notas, setNotas] = useState("");
  const [cliente, setCliente] = useState(emptyCliente);
  const [errors, setErrors] = useState<Record<string, boolean>>({});

  const updateCliente = useCallback((field: string, value: string) => {
    setCliente(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: false }));
  }, [errors]);

  const handleSubmit = () => {
    const newErrors: Record<string, boolean> = {};
    if (!cliente.nome.trim()) newErrors["cliente.nome"] = true;
    if (!cliente.telefone.trim()) newErrors["cliente.telefone"] = true;

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSubmit?.({
      nome: nome.trim() || cliente.nome.trim(),
      descricao,
      consultorId,
      etiqueta,
      notas,
      cliente,
    });

    // Reset
    setNome("");
    setDescricao("");
    setConsultorId("");
    setEtiqueta("");
    setNotas("");
    setCliente(emptyCliente);
    setErrors({});
    onOpenChange(false);
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60">
          <DialogTitle className="text-lg font-bold tracking-tight">
            Novo Projeto
          </DialogTitle>
        </DialogHeader>

        <div className="flex overflow-hidden" style={{ minHeight: "520px" }}>
          {/* ── Column 1: Projeto ── */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            <SectionTitle icon={FileText} label="Projeto" />

            <FieldGroup label="Nome do projeto">
              <Input
                placeholder="Ex: Sistema 10kWp - João Silva"
                value={nome}
                onChange={e => setNome(e.target.value)}
                className="h-9 text-sm"
              />
            </FieldGroup>

            <FieldGroup label="Descrição">
              <Textarea
                placeholder="Detalhes do projeto..."
                value={descricao}
                onChange={e => setDescricao(e.target.value)}
                className="text-sm min-h-[72px] resize-none"
              />
            </FieldGroup>

            <FieldGroup label="Vendedor" icon={Users}>
              <Select value={consultorId} onValueChange={setConsultorId}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecione o responsável" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  {consultores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FieldGroup>

            <FieldGroup label="Etiqueta" icon={Tag}>
              <Select value={etiqueta} onValueChange={setEtiqueta}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Selecionar etiqueta" />
                </SelectTrigger>
                <SelectContent className="z-50 bg-popover">
                  <SelectItem value="residencial">Residencial</SelectItem>
                  <SelectItem value="comercial">Comercial</SelectItem>
                  <SelectItem value="industrial">Industrial</SelectItem>
                  <SelectItem value="rural">Rural</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>

            <FieldGroup label="Notas">
              <Textarea
                placeholder="Observações internas..."
                value={notas}
                onChange={e => setNotas(e.target.value)}
                className="text-sm min-h-[64px] resize-none"
              />
            </FieldGroup>
          </div>

          {/* Divider */}
          <Separator orientation="vertical" className="h-auto" />

          {/* ── Column 2: Cliente ── */}
          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            <SectionTitle icon={User} label="Cliente" />

            {/* Endereço */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Endereço
              </p>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="CEP">
                  <Input
                    placeholder="00000-000"
                    value={cliente.cep}
                    onChange={e => updateCliente("cep", e.target.value)}
                    className="h-9 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Estado">
                  <Input
                    placeholder="UF"
                    value={cliente.estado}
                    onChange={e => updateCliente("estado", e.target.value)}
                    className="h-9 text-sm"
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Cidade">
                <Input
                  placeholder="Cidade"
                  value={cliente.cidade}
                  onChange={e => updateCliente("cidade", e.target.value)}
                  className="h-9 text-sm"
                />
              </FieldGroup>
              <FieldGroup label="Endereço">
                <Input
                  placeholder="Rua, Av..."
                  value={cliente.endereco}
                  onChange={e => updateCliente("endereco", e.target.value)}
                  className="h-9 text-sm"
                />
              </FieldGroup>
              <div className="grid grid-cols-3 gap-3">
                <FieldGroup label="Número">
                  <Input
                    placeholder="Nº"
                    value={cliente.numero}
                    onChange={e => updateCliente("numero", e.target.value)}
                    className="h-9 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Bairro">
                  <Input
                    placeholder="Bairro"
                    value={cliente.bairro}
                    onChange={e => updateCliente("bairro", e.target.value)}
                    className="h-9 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="Complemento">
                  <Input
                    placeholder="Apto, Bloco..."
                    value={cliente.complemento}
                    onChange={e => updateCliente("complemento", e.target.value)}
                    className="h-9 text-sm"
                  />
                </FieldGroup>
              </div>
            </div>

            {/* Dados Pessoais */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Dados pessoais
              </p>
              <FieldGroup label="Nome do cliente *" error={errors["cliente.nome"]}>
                <Input
                  placeholder="Nome completo"
                  value={cliente.nome}
                  onChange={e => updateCliente("nome", e.target.value)}
                  className={cn("h-9 text-sm", errors["cliente.nome"] && "border-destructive")}
                />
                {errors["cliente.nome"] && (
                  <p className="text-[11px] text-destructive mt-0.5">Nome é obrigatório!</p>
                )}
              </FieldGroup>
              <FieldGroup label="Email">
                <Input
                  type="email"
                  placeholder="email@exemplo.com"
                  value={cliente.email}
                  onChange={e => updateCliente("email", e.target.value)}
                  className="h-9 text-sm"
                />
              </FieldGroup>
              <div className="grid grid-cols-2 gap-3">
                <FieldGroup label="Empresa">
                  <Input
                    placeholder="Nome da empresa"
                    value={cliente.empresa}
                    onChange={e => updateCliente("empresa", e.target.value)}
                    className="h-9 text-sm"
                  />
                </FieldGroup>
                <FieldGroup label="CPF/CNPJ">
                  <Input
                    placeholder="000.000.000-00"
                    value={cliente.cpfCnpj}
                    onChange={e => updateCliente("cpfCnpj", e.target.value)}
                    className="h-9 text-sm"
                  />
                </FieldGroup>
              </div>
              <FieldGroup label="Telefone *" error={errors["cliente.telefone"]}>
                <Input
                  placeholder="(00) 00000-0000"
                  value={cliente.telefone}
                  onChange={e => updateCliente("telefone", e.target.value)}
                  className={cn("h-9 text-sm", errors["cliente.telefone"] && "border-destructive")}
                />
                {errors["cliente.telefone"] && (
                  <p className="text-[11px] text-destructive mt-0.5">Telefone é obrigatório!</p>
                )}
              </FieldGroup>
            </div>
          </div>

          {/* Divider */}
          <Separator orientation="vertical" className="h-auto" />

          {/* ── Column 3: Clientes Similares ── */}
          <div className="w-[240px] shrink-0 p-5 flex flex-col">
            <SectionTitle icon={Search} label="Clientes similares" />

            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-2">
                <div className="mx-auto w-12 h-12 rounded-xl bg-muted/50 flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-xs text-muted-foreground">
                  {cliente.nome.trim()
                    ? "Nenhum cliente similar encontrado"
                    : "Digite o nome do cliente para buscar similares"
                  }
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border/60 bg-muted/20">
          <Button variant="ghost" onClick={handleClose} className="text-sm">
            Fechar
          </Button>
          <Button onClick={handleSubmit} className="text-sm px-6 gap-1.5">
            Cadastrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Helper components ──

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <Icon className="h-4 w-4 text-primary" />
      <h3 className="text-sm font-bold text-foreground tracking-tight">{label}</h3>
    </div>
  );
}

function FieldGroup({
  label,
  icon: Icon,
  error,
  children,
}: {
  label: string;
  icon?: React.ElementType;
  error?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
        {Icon && <Icon className="h-3 w-3" />}
        {label}
      </Label>
      {children}
    </div>
  );
}
