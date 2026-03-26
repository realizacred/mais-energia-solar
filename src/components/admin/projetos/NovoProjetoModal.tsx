import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { FolderKanban, Loader2, Users, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export interface NovoProjetoData {
  nome: string;
  consultorId: string;
  valor?: number;
  pipelineId?: string;
  stageId?: string;
  clienteId: string;
  descricao: string;
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

interface ClienteSimilar {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  cpf_cnpj: string | null;
}

interface ProjetoExistente {
  id: string;
  codigo: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consultores: { id: string; nome: string }[];
  onSubmit?: (data: NovoProjetoData) => void | Promise<void>;
  defaultConsultorId?: string;
  dynamicEtiquetas?: { id: string; nome: string; cor: string }[];
  pipelines?: { id: string; name: string }[];
  stages?: { id: string; name: string; pipeline_id: string; position: number; is_closed?: boolean }[];
  defaultPipelineId?: string;
  defaultStageId?: string;
}

export function NovoProjetoModal({
  open, onOpenChange, consultores, onSubmit,
  defaultConsultorId, dynamicEtiquetas = [],
  pipelines = [], stages = [],
  defaultPipelineId, defaultStageId,
}: Props) {
  // Project fields
  const [nomeProjeto, setNomeProjeto] = useState("");
  const [descricao, setDescricao] = useState("");
  const [consultorId, setConsultorId] = useState(defaultConsultorId || "");
  const [etiquetaId, setEtiquetaId] = useState("");

  // Client fields
  const [clienteNome, setClienteNome] = useState("");
  const [clienteEmail, setClienteEmail] = useState("");
  const [clienteEmpresa, setClienteEmpresa] = useState("");
  const [clienteCpfCnpj, setClienteCpfCnpj] = useState("");
  const [clienteTelefone, setClienteTelefone] = useState("");

  // State
  const [similares, setSimilares] = useState<ClienteSimilar[]>([]);
  const [selectedClienteId, setSelectedClienteId] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projetoExistente, setProjetoExistente] = useState<ProjetoExistente | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setNomeProjeto("");
      setDescricao("");
      setConsultorId(defaultConsultorId || "");
      setEtiquetaId("");
      setClienteNome("");
      setClienteEmail("");
      setClienteEmpresa("");
      setClienteCpfCnpj("");
      setClienteTelefone("");
      setSimilares([]);
      setSelectedClienteId(null);
      setProjetoExistente(null);
      setErrors({});
    }
  }, [open, defaultConsultorId]);

  // Auto-select first pipeline/stage
  const resolvedPipelineId = defaultPipelineId || pipelines[0]?.id || "";
  const resolvedStageId = useMemo(() => {
    if (defaultStageId) return defaultStageId;
    if (!resolvedPipelineId) return "";
    const first = stages
      .filter(s => s.pipeline_id === resolvedPipelineId && !s.is_closed)
      .sort((a, b) => a.position - b.position)[0];
    return first?.id || "";
  }, [defaultStageId, resolvedPipelineId, stages]);

  // Search similar clients when name changes
  useEffect(() => {
    const term = clienteNome.trim();
    if (term.length < 2) { setSimilares([]); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await supabase
          .from("clientes")
          .select("id, nome, telefone, email, cpf_cnpj")
          .ilike("nome", `%${term}%`)
          .limit(8);
        setSimilares(data ?? []);
      } catch { setSimilares([]); }
      finally { setBuscando(false); }
    }, 400);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [clienteNome]);

  // Check duplicate project when a similar client is selected
  useEffect(() => {
    if (!selectedClienteId) { setProjetoExistente(null); return; }
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, codigo")
        .eq("cliente_id", selectedClienteId)
        .in("status", ["criado", "aguardando_documentacao", "em_analise", "aprovado", "em_instalacao"])
        .limit(1)
        .maybeSingle();
      if (!cancelled) setProjetoExistente(data as ProjetoExistente | null);
    })();

    return () => { cancelled = true; };
  }, [selectedClienteId]);

  // Select similar client → fill fields
  const handleSelectSimilar = useCallback((c: ClienteSimilar) => {
    setSelectedClienteId(c.id);
    setClienteNome(c.nome);
    setClienteTelefone(c.telefone || "");
    setClienteEmail(c.email || "");
    setClienteCpfCnpj(c.cpf_cnpj || "");
    setErrors(prev => {
      const next = { ...prev };
      delete next.clienteNome;
      delete next.clienteTelefone;
      return next;
    });
  }, []);

  // Validation
  const validate = () => {
    const e: Record<string, string> = {};
    if (!clienteNome.trim()) e.clienteNome = "Nome é obrigatório!";
    if (!clienteTelefone.trim()) e.clienteTelefone = "Telefone é obrigatório!";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const canSubmit = !submitting && !projetoExistente;

  const handleSubmit = async () => {
    if (!validate() || !canSubmit) return;
    setSubmitting(true);
    try {
      // If selected existing client, use their ID; otherwise create inline
      let clienteId = selectedClienteId || "";

      if (!clienteId) {
        // Create new client
        const { data: newCliente, error } = await supabase
          .from("clientes")
          .insert({
            nome: clienteNome.trim(),
            telefone: clienteTelefone.trim(),
            email: clienteEmail.trim() || null,
            empresa: clienteEmpresa.trim() || null,
            cpf_cnpj: clienteCpfCnpj.trim() || null,
            cliente_code: `CLI-${Date.now()}`,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        clienteId = newCliente.id;
      }

      await onSubmit?.({
        nome: nomeProjeto.trim() || clienteNome.trim(),
        consultorId,
        pipelineId: resolvedPipelineId || undefined,
        stageId: resolvedStageId || undefined,
        clienteId,
        descricao,
        etiqueta: etiquetaId,
        notas: "",
        cliente: {
          nome: clienteNome, email: clienteEmail, empresa: clienteEmpresa,
          cpfCnpj: clienteCpfCnpj, telefone: clienteTelefone,
          cep: "", estado: "", cidade: "", endereco: "", numero: "", bairro: "", complemento: "",
        },
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-4xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="flex-1">
            <DialogTitle className="text-lg font-bold text-foreground">
              Novo Projeto
            </DialogTitle>
          </div>
        </DialogHeader>

        {/* Body — 3 columns */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* ─── Coluna 1: Projeto ─── */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-sm font-bold text-primary">Projeto</h3>
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Nome do Projeto <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Nome do projeto"
                    value={nomeProjeto}
                    onChange={(e) => setNomeProjeto(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Descrição</Label>
                  <Textarea
                    placeholder="Escreva aqui"
                    value={descricao}
                    onChange={(e) => setDescricao(e.target.value)}
                    className="min-h-[60px] resize-y"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Vendedores</Label>
                  <Select value={consultorId} onValueChange={setConsultorId}>
                    <SelectTrigger className="h-9">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {consultores.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {/* Consultant avatars */}
                  {consultores.length > 0 && (
                    <div className="flex items-center gap-1 pt-1">
                      {consultores.slice(0, 5).map((c) => (
                        <Avatar key={c.id} className={cn(
                          "w-7 h-7 border-2 transition-all",
                          consultorId === c.id
                            ? "border-primary ring-1 ring-primary"
                            : "border-muted"
                        )}>
                          <AvatarFallback className={cn(
                            "text-[10px] font-bold",
                            consultorId === c.id ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                          )}>
                            {c.nome.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                    </div>
                  )}
                </div>

                {dynamicEtiquetas.length > 0 && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">Etiqueta</Label>
                    <Select value={etiquetaId} onValueChange={setEtiquetaId}>
                      <SelectTrigger className="h-9">
                        <SelectValue placeholder="Selecione uma opção" />
                      </SelectTrigger>
                      <SelectContent>
                        {dynamicEtiquetas.map((e) => (
                          <SelectItem key={e.id} value={e.id}>
                            <div className="flex items-center gap-2">
                              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: e.cor }} />
                              {e.nome}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* ─── Coluna 2: Cliente ─── */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground mb-1">Cliente</h3>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Nome do Cliente <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    placeholder="Digite o nome do cliente"
                    value={clienteNome}
                    onChange={(e) => {
                      setClienteNome(e.target.value);
                      if (selectedClienteId) setSelectedClienteId(null);
                      setErrors(prev => { const n = { ...prev }; delete n.clienteNome; return n; });
                    }}
                    className={cn("h-9", errors.clienteNome && "border-destructive")}
                  />
                  {errors.clienteNome && (
                    <p className="text-xs text-destructive">{errors.clienteNome}</p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Email do Cliente</Label>
                  <Input
                    placeholder="Digite o email do cliente"
                    value={clienteEmail}
                    onChange={(e) => setClienteEmail(e.target.value)}
                    type="email"
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">Nome da Empresa</Label>
                  <Input
                    placeholder="Digite o nome da empresa"
                    value={clienteEmpresa}
                    onChange={(e) => setClienteEmpresa(e.target.value)}
                    className="h-9"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">CNPJ/CPF</Label>
                  <CpfCnpjInput
                    value={clienteCpfCnpj}
                    onChange={setClienteCpfCnpj}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Telefone Celular <span className="text-destructive">*</span>
                  </Label>
                  <PhoneInput
                    value={clienteTelefone}
                    onChange={setClienteTelefone}
                    className={cn(errors.clienteTelefone && "border-destructive")}
                  />
                  {errors.clienteTelefone && (
                    <p className="text-xs text-destructive">{errors.clienteTelefone}</p>
                  )}
                </div>
              </div>

              {/* ─── Coluna 3: Clientes Similares ─── */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-foreground mb-1">Clientes similares</h3>

                {buscando && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando...
                  </div>
                )}

                {!buscando && similares.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">
                    Nenhum cliente similar
                  </p>
                )}

                {similares.length > 0 && (
                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                    {similares.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleSelectSimilar(c)}
                        className={cn(
                          "w-full text-left rounded-lg border p-3 transition-colors",
                          selectedClienteId === c.id
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                        <p className="text-xs text-muted-foreground truncate">{c.telefone}</p>
                        {c.email && (
                          <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {/* Duplicate project warning */}
                {projetoExistente && (
                  <div className="flex items-start gap-2.5 rounded-lg border border-warning/50 bg-warning/10 p-3 mt-2">
                    <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground">
                        Projeto {projetoExistente.codigo} já existe
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Não é possível criar outro projeto enquanto houver um em andamento.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Fechar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {submitting ? "Cadastrando..." : "Cadastrar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
