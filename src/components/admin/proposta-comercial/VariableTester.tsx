/**
 * VariableTester — Test variables against real proposals.
 * §25-S1: Modal pattern, §27-S1: KPI badges
 */
import { useState, useMemo } from "react";
import { FlaskConical, Search, Loader2, History, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";
import {
  usePropostaSearch,
  useVariableTester,
  getTestHistory,
  type PropostaSearchResult,
  type TestResult,
} from "@/hooks/useVariableTester";

function normalize(str: string) {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

interface VariableTesterProps {
  /** Pre-fill variable key */
  initialVariable?: string;
}

export function VariableTester({ initialVariable }: VariableTesterProps) {
  const [propostaSearch, setPropostaSearch] = useState("");
  const [selectedProposta, setSelectedProposta] = useState<PropostaSearchResult | null>(null);
  const [variableInput, setVariableInput] = useState(initialVariable || "");
  const [showPropostas, setShowPropostas] = useState(false);
  const [showVarSuggestions, setShowVarSuggestions] = useState(false);
  const [history] = useState<TestResult[]>(() => getTestHistory());

  const { data: propostas = [], isLoading: loadingPropostas } = usePropostaSearch(propostaSearch);
  const { testVariable, testing, result, error } = useVariableTester();

  // Variable autocomplete
  const varSuggestions = useMemo(() => {
    if (!variableInput.trim()) return [];
    const q = normalize(variableInput);
    return VARIABLES_CATALOG.filter(
      (v) =>
        normalize(v.label).includes(q) ||
        normalize(v.legacyKey).includes(q) ||
        normalize(v.canonicalKey).includes(q)
    ).slice(0, 8);
  }, [variableInput]);

  const handleTest = () => {
    if (!selectedProposta || !variableInput.trim()) return;
    testVariable(selectedProposta.id, selectedProposta.titulo, variableInput.trim());
  };

  const statusConfig = {
    resolved: { icon: CheckCircle2, label: "Resolvido", className: "bg-success/15 text-success border-success/20" },
    null: { icon: XCircle, label: "Não encontrado", className: "bg-destructive/15 text-destructive border-destructive/20" },
    empty: { icon: AlertTriangle, label: "Vazio", className: "bg-warning/15 text-warning border-warning/20" },
    not_found: { icon: XCircle, label: "Não encontrado", className: "bg-destructive/15 text-destructive border-destructive/20" },
  };

  return (
    <Card className="border border-border bg-card">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <FlaskConical className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Testar Variável com Proposta Real</h3>
            <p className="text-[10px] text-muted-foreground">Selecione uma proposta e teste o valor resolvido</p>
          </div>
        </div>

        {/* Proposal Search */}
        <div className="space-y-1.5">
          <Label className="text-xs">Proposta:</Label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
            <Input
              placeholder="Buscar proposta por título ou código..."
              value={selectedProposta ? `${selectedProposta.titulo} (${selectedProposta.codigo})` : propostaSearch}
              onChange={(e) => {
                setPropostaSearch(e.target.value);
                setSelectedProposta(null);
                setShowPropostas(true);
              }}
              onFocus={() => setShowPropostas(true)}
              className="pl-8 h-9 text-sm"
            />
            {/* Dropdown */}
            {showPropostas && !selectedProposta && (
              <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
                {loadingPropostas ? (
                  <div className="p-3 space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-8 w-full" />
                    ))}
                  </div>
                ) : propostas.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Nenhuma proposta encontrada</p>
                ) : (
                  propostas.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted/50 transition-colors border-b border-border last:border-b-0"
                      onClick={() => {
                        setSelectedProposta(p);
                        setShowPropostas(false);
                      }}
                    >
                      <span className="font-medium text-foreground">{p.titulo}</span>
                      <span className="text-muted-foreground ml-1.5">({p.codigo})</span>
                      {p.cliente_nome && (
                        <span className="text-muted-foreground/60 ml-1.5">• {p.cliente_nome}</span>
                      )}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          {selectedProposta && (
            <Button variant="ghost" size="sm" className="text-[10px] h-5 px-1.5 text-muted-foreground" onClick={() => { setSelectedProposta(null); setPropostaSearch(""); }}>
              Trocar proposta
            </Button>
          )}
        </div>

        {/* Variable Input */}
        <div className="space-y-1.5">
          <Label className="text-xs">Variável:</Label>
          <div className="relative">
            <Input
              placeholder="[valor_total] ou {{financeiro.valor_total}}"
              value={variableInput}
              onChange={(e) => {
                setVariableInput(e.target.value);
                setShowVarSuggestions(true);
              }}
              onFocus={() => setShowVarSuggestions(true)}
              onBlur={() => setTimeout(() => setShowVarSuggestions(false), 200)}
              className="h-9 text-sm font-mono"
            />
            {showVarSuggestions && varSuggestions.length > 0 && (
              <div className="absolute z-50 top-full mt-1 w-full bg-card border border-border rounded-lg shadow-lg max-h-[180px] overflow-y-auto">
                {varSuggestions.map((v) => {
                  const key = v.legacyKey.replace(/^\[|\]$/g, "");
                  return (
                    <button
                      key={v.canonicalKey}
                      type="button"
                      className="w-full text-left px-3 py-1.5 text-xs hover:bg-primary/10 transition-colors flex justify-between items-center"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setVariableInput(key);
                        setShowVarSuggestions(false);
                      }}
                    >
                      <span>
                        <code className="font-mono text-primary text-[10px]">[{key}]</code>
                        <span className="text-muted-foreground ml-1.5">{v.label}</span>
                      </span>
                      <span className="text-[9px] text-muted-foreground/60">{v.unit || ""}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Test Button */}
        <Button
          onClick={handleTest}
          disabled={!selectedProposta || !variableInput.trim() || testing}
          className="w-full"
        >
          {testing ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Testando...
            </>
          ) : (
            <>
              <FlaskConical className="h-4 w-4 mr-2" /> Testar Variável
            </>
          )}
        </Button>

        {/* Result */}
        {result && (
          <div className={cn(
            "rounded-lg border p-3 space-y-1.5",
            result.status === "resolved" ? "border-success/30 bg-success/5" :
            result.status === "empty" ? "border-warning/30 bg-warning/5" :
            "border-destructive/30 bg-destructive/5"
          )}>
            <div className="flex items-center gap-1.5">
              {(() => {
                const cfg = statusConfig[result.status];
                const Icon = cfg.icon;
                return (
                  <>
                    <Icon className="h-3.5 w-3.5" />
                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0 h-4", cfg.className)}>
                      {cfg.label}
                    </Badge>
                  </>
                );
              })()}
              <code className="text-[10px] font-mono text-muted-foreground ml-auto">[{result.variableKey}]</code>
            </div>
            {result.value !== null && (
              <div className="bg-card rounded border border-border px-3 py-2">
                <p className="text-sm font-medium text-foreground break-all">{result.value}</p>
              </div>
            )}
            {result.value === null && (
              <p className="text-xs text-muted-foreground">Variável não retornou valor para esta proposta.</p>
            )}
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-xs text-destructive">{error}</p>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <History className="h-3 w-3" />
              <span className="text-[10px] font-medium">Últimos testes</span>
            </div>
            <div className="space-y-1">
              {history.map((h, i) => {
                const cfg = statusConfig[h.status];
                return (
                  <button
                    key={i}
                    type="button"
                    className="w-full text-left px-2.5 py-1.5 rounded-md text-[10px] hover:bg-muted/50 transition-colors flex items-center gap-2 border border-transparent hover:border-border"
                    onClick={() => setVariableInput(h.variableKey)}
                  >
                    <Badge variant="outline" className={cn("text-[8px] px-1 py-0 h-3.5 shrink-0", cfg.className)}>
                      {cfg.label}
                    </Badge>
                    <code className="font-mono text-primary truncate">[{h.variableKey}]</code>
                    {h.value && (
                      <span className="text-muted-foreground truncate ml-auto max-w-[100px]">= {h.value}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
