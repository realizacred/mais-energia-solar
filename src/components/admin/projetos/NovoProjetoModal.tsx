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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { FolderKanban, Loader2, Search, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NovoProjetoData {
  nome: string;
  consultorId: string;
  valor?: number;
  pipelineId?: string;
  stageId?: string;
  clienteId: string;
  /** @deprecated kept for backward compat — always empty now */
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

interface ClienteResult {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
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
  /** kept for backward compat — ignored in simplified modal */
  dynamicEtiquetas?: any[];
  pipelines?: { id: string; name: string }[];
  stages?: { id: string; name: string; pipeline_id: string; position: number; is_closed?: boolean }[];
  defaultPipelineId?: string;
  defaultStageId?: string;
}

const emptyCliente = {
  nome: "", email: "", empresa: "", cpfCnpj: "", telefone: "",
  cep: "", estado: "", cidade: "", endereco: "", numero: "", bairro: "", complemento: "",
};

export function NovoProjetoModal({
  open, onOpenChange, consultores, onSubmit,
  defaultConsultorId, pipelines = [], stages = [],
  defaultPipelineId, defaultStageId,
}: Props) {
  const [search, setSearch] = useState("");
  const [consultorId, setConsultorId] = useState(defaultConsultorId || "");
  const [valor, setValor] = useState(0);
  const [selectedCliente, setSelectedCliente] = useState<ClienteResult | null>(null);
  const [resultados, setResultados] = useState<ClienteResult[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [projetoExistente, setProjetoExistente] = useState<ProjetoExistente | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reset on open
  useEffect(() => {
    if (open) {
      setSearch("");
      setConsultorId(defaultConsultorId || "");
      setValor(0);
      setSelectedCliente(null);
      setResultados([]);
      setProjetoExistente(null);
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

  // Search clients
  useEffect(() => {
    const term = search.trim();
    if (term.length < 2) { setResultados([]); return; }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setBuscando(true);
      try {
        const { data } = await supabase
          .from("clientes")
          .select("id, nome, telefone, email")
          .ilike("nome", `%${term}%`)
          .limit(8);
        setResultados(data ?? []);
      } catch { setResultados([]); }
      finally { setBuscando(false); }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // Check duplicate project when client is selected
  useEffect(() => {
    if (!selectedCliente) { setProjetoExistente(null); return; }
    let cancelled = false;

    (async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id, codigo")
        .eq("cliente_id", selectedCliente.id)
        .in("status", ["criado", "aguardando_documentacao", "em_analise", "aprovado", "em_instalacao"])
        .limit(1)
        .maybeSingle();
      if (!cancelled) setProjetoExistente(data as ProjetoExistente | null);
    })();

    return () => { cancelled = true; };
  }, [selectedCliente]);

  const handleSelectCliente = useCallback((c: ClienteResult) => {
    setSelectedCliente(c);
    setSearch(c.nome);
  }, []);

  const handleClearCliente = useCallback(() => {
    setSelectedCliente(null);
    setSearch("");
    setProjetoExistente(null);
  }, []);

  const canSubmit = !!selectedCliente && !projetoExistente && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit || !selectedCliente) return;
    setSubmitting(true);
    try {
      await onSubmit?.({
        nome: selectedCliente.nome,
        consultorId,
        valor: valor > 0 ? valor : undefined,
        pipelineId: resolvedPipelineId || undefined,
        stageId: resolvedStageId || undefined,
        clienteId: selectedCliente.id,
        // backward compat
        descricao: "",
        etiqueta: "",
        notas: "",
        cliente: emptyCliente,
      });
      onOpenChange(false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FolderKanban className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Novo Projeto
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Selecione o cliente para criar um novo projeto
            </p>
          </div>
        </DialogHeader>

        {/* Body */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-5">
            {/* Campo 1: Cliente (obrigatório) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Cliente <span className="text-destructive">*</span>
              </Label>

              {selectedCliente ? (
                <div className="flex items-center gap-2 rounded-lg border border-primary bg-primary/5 p-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{selectedCliente.nome}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {selectedCliente.telefone}{selectedCliente.email ? ` · ${selectedCliente.email}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleClearCliente} className="shrink-0 text-xs h-7">
                    Trocar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input
                      placeholder="Buscar cliente pelo nome..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="pl-9 h-10"
                      autoFocus
                    />
                    {buscando && (
                      <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                  </div>

                  {/* Results */}
                  {resultados.length > 0 && (
                    <div className="rounded-lg border border-border max-h-[200px] overflow-y-auto">
                      {resultados.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => handleSelectCliente(c)}
                          className="w-full text-left px-3 py-2.5 hover:bg-muted/50 transition-colors border-b border-border/50 last:border-b-0"
                        >
                          <p className="text-sm font-medium text-foreground truncate">{c.nome}</p>
                          <p className="text-xs text-muted-foreground truncate">{c.telefone}</p>
                        </button>
                      ))}
                    </div>
                  )}

                  {search.trim().length >= 2 && !buscando && resultados.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">
                      Nenhum cliente encontrado
                    </p>
                  )}
                </div>
              )}

              {/* Inline duplicate warning */}
              {projetoExistente && (
                <div className="flex items-start gap-2.5 rounded-lg border border-warning/50 bg-warning/10 p-3">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      Este cliente já tem o projeto {projetoExistente.codigo}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Não é possível criar outro projeto enquanto houver um em andamento.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Campo 2: Consultor (obrigatório) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Consultor responsável <span className="text-destructive">*</span>
              </Label>
              <Select value={consultorId} onValueChange={setConsultorId}>
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Selecione o consultor" />
                </SelectTrigger>
                <SelectContent>
                  {consultores.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!consultorId && (
                <p className="text-[11px] text-muted-foreground">
                  Se não selecionado, será atribuído a você automaticamente.
                </p>
              )}
            </div>

            {/* Campo 3: Valor estimado (opcional) */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground">
                Valor estimado <span className="text-muted-foreground/60">(opcional)</span>
              </Label>
              <CurrencyInput
                value={valor}
                onChange={setValor}
                className="h-10"
              />
            </div>
          </div>
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            {submitting ? "Criando..." : "Criar projeto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
