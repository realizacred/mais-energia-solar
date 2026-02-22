import { useState, useMemo } from "react";
import { ClipboardList, ChevronDown, ChevronRight, Database, FileJson, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { WizardSnapshot } from "./hooks/useWizardPersistence";

// ─── Field metadata for human-readable labels ───────────────────
const SNAPSHOT_FIELD_MAP: Record<string, { label: string; category: string }> = {
  locEstado: { label: "Estado", category: "Localização" },
  locCidade: { label: "Cidade", category: "Localização" },
  locTipoTelhado: { label: "Tipo de Telhado", category: "Localização" },
  locDistribuidoraId: { label: "Distribuidora (ID)", category: "Localização" },
  locDistribuidoraNome: { label: "Distribuidora (Nome)", category: "Localização" },
  locIrradiacao: { label: "Irradiação (kWh/m²)", category: "Localização" },
  locGhiSeries: { label: "Séries GHI", category: "Localização" },
  locLatitude: { label: "Latitude", category: "Localização" },
  distanciaKm: { label: "Distância (km)", category: "Localização" },
  projectAddress: { label: "Endereço do Projeto", category: "Localização" },
  mapSnapshots: { label: "Snapshots do Mapa", category: "Localização" },

  selectedLead: { label: "Lead Selecionado", category: "Cliente / Lead" },
  cliente: { label: "Dados do Cliente", category: "Cliente / Lead" },

  ucs: { label: "Unidades Consumidoras", category: "UCs" },
  grupo: { label: "Grupo (BT/AT)", category: "UCs" },
  potenciaKwp: { label: "Potência (kWp)", category: "UCs" },

  customFieldValues: { label: "Campos Customizados", category: "Campos Custom" },

  premissas: { label: "Premissas", category: "Premissas" },
  preDimensionamento: { label: "Pré-dimensionamento", category: "Premissas" },

  itens: { label: "Itens do Kit", category: "Kit Gerador" },
  layouts: { label: "Layouts", category: "Kit Gerador" },
  manualKits: { label: "Kits Manuais", category: "Kit Gerador" },

  adicionais: { label: "Itens Adicionais", category: "Adicionais" },

  servicos: { label: "Serviços", category: "Serviços" },

  venda: { label: "Dados de Venda", category: "Venda" },

  pagamentoOpcoes: { label: "Opções de Pagamento", category: "Pagamento" },

  nomeProposta: { label: "Nome da Proposta", category: "Metadata" },
  descricaoProposta: { label: "Descrição", category: "Metadata" },
  templateSelecionado: { label: "Template Selecionado", category: "Metadata" },
  step: { label: "Etapa Atual", category: "Metadata" },
};

// ─── DB columns for propostas_nativas ───────────────────────────
const DB_COLUMNS_MAP: Record<string, string> = {
  id: "UUID da Proposta",
  tenant_id: "Tenant",
  lead_id: "Lead vinculado",
  cliente_id: "Cliente vinculado",
  projeto_id: "Projeto vinculado",
  deal_id: "Deal vinculado",
  consultor_id: "Consultor",
  titulo: "Título da Proposta",
  codigo: "Código",
  versao_atual: "Versão Atual",
  status: "Status",
  origem: "Origem",
  created_at: "Criado em",
  updated_at: "Atualizado em",
};

interface Props {
  snapshot: WizardSnapshot | null;
  propostaId?: string | null;
  versaoId?: string | null;
  projetoId?: string | null;
  dealId?: string | null;
  clienteId?: string | null;
  leadId?: string | null;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "✅ Sim" : "❌ Não";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") {
    if (value.length === 0) return "(vazio)";
    if (value.startsWith("data:image")) return `[Imagem base64 - ${Math.round(value.length / 1024)}KB]`;
    if (value.length > 200) return value.slice(0, 200) + "…";
    return value;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return "[] (lista vazia)";
    return `[${value.length} itens]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value);
    if (keys.length === 0) return "{} (objeto vazio)";
    return `{${keys.length} campos}`;
  }
  return String(value);
}

function getValueBadge(value: any) {
  if (value === null || value === undefined || value === "" || (Array.isArray(value) && value.length === 0)) {
    return "destructive" as const;
  }
  return "secondary" as const;
}

export function ProposalAuditPanel({ snapshot, propostaId, versaoId, projetoId, dealId, clienteId, leadId }: Props) {
  const [search, setSearch] = useState("");
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(section) ? next.delete(section) : next.add(section);
      return next;
    });
  };

  const toggleField = (field: string) => {
    setExpandedFields(prev => {
      const next = new Set(prev);
      next.has(field) ? next.delete(field) : next.add(field);
      return next;
    });
  };

  // Group snapshot fields by category
  const groupedFields = useMemo(() => {
    if (!snapshot) return {};
    const groups: Record<string, { key: string; label: string; value: any }[]> = {};

    for (const [key, value] of Object.entries(snapshot)) {
      const meta = SNAPSHOT_FIELD_MAP[key] || { label: key, category: "Outros" };
      const searchTerm = search.toLowerCase();
      if (searchTerm && !meta.label.toLowerCase().includes(searchTerm) && !key.toLowerCase().includes(searchTerm) && !meta.category.toLowerCase().includes(searchTerm)) {
        continue;
      }
      if (!groups[meta.category]) groups[meta.category] = [];
      groups[meta.category].push({ key, label: meta.label, value });
    }
    return groups;
  }, [snapshot, search]);

  // DB IDs section
  const dbIds = useMemo(() => {
    const entries: { key: string; label: string; value: string | null }[] = [
      { key: "proposta_id", label: "Proposta ID", value: propostaId || null },
      { key: "versao_id", label: "Versão ID", value: versaoId || null },
      { key: "projeto_id", label: "Projeto ID", value: projetoId || null },
      { key: "deal_id", label: "Deal ID", value: dealId || null },
      { key: "cliente_id", label: "Cliente ID", value: clienteId || null },
      { key: "lead_id", label: "Lead ID", value: leadId || null },
    ];
    const searchTerm = search.toLowerCase();
    if (searchTerm) {
      return entries.filter(e => e.label.toLowerCase().includes(searchTerm) || (e.value || "").toLowerCase().includes(searchTerm));
    }
    return entries;
  }, [propostaId, versaoId, projetoId, dealId, clienteId, leadId, search]);

  const totalFields = snapshot ? Object.keys(snapshot).length : 0;
  const nullFields = snapshot ? Object.values(snapshot).filter(v => v === null || v === undefined || v === "" || (Array.isArray(v) && v.length === 0)).length : 0;

  return (
    <div className="border rounded-lg bg-card">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <ClipboardList className="h-4 w-4 text-primary" />
        <span className="text-sm font-bold">Auditoria da Proposta</span>
        <Badge variant="outline" className="text-[10px] ml-auto">
          {totalFields} campos
        </Badge>
        {nullFields > 0 && (
          <Badge variant="destructive" className="text-[10px]">
            {nullFields} vazios
          </Badge>
        )}
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            className="h-7 text-xs pl-7"
            placeholder="Buscar campo..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <ScrollArea className="max-h-[60vh]">
        <div className="p-2 space-y-1">
          {/* DB IDs Section */}
          {dbIds.length > 0 && (
            <div className="border rounded-md overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                onClick={() => toggleSection("__db_ids")}
              >
                {expandedSections.has("__db_ids") ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <Database className="h-3 w-3 text-primary" />
                <span className="text-xs font-semibold">IDs do Banco de Dados</span>
                <Badge variant="outline" className="text-[9px] ml-auto">{dbIds.length}</Badge>
              </button>
              {expandedSections.has("__db_ids") && (
                <div className="divide-y">
                  {dbIds.map(entry => (
                    <div key={entry.key} className="flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-muted/20">
                      <span className="text-muted-foreground font-medium w-28 shrink-0">{entry.label}</span>
                      <code className="text-[10px] text-muted-foreground/60 w-24 shrink-0">{entry.key}</code>
                      <Badge variant={entry.value ? "secondary" : "destructive"} className="text-[10px] font-mono ml-auto truncate max-w-[200px]">
                        {entry.value || "NULL"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Snapshot Sections */}
          {Object.entries(groupedFields).map(([category, fields]) => (
            <div key={category} className="border rounded-md overflow-hidden">
              <button
                className="w-full flex items-center gap-2 px-2 py-1.5 bg-muted/40 hover:bg-muted/60 transition-colors text-left"
                onClick={() => toggleSection(category)}
              >
                {expandedSections.has(category) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <FileJson className="h-3 w-3 text-primary" />
                <span className="text-xs font-semibold">{category}</span>
                <Badge variant="outline" className="text-[9px] ml-auto">{fields.length}</Badge>
              </button>
              {expandedSections.has(category) && (
                <div className="divide-y">
                  {fields.map(field => {
                    const isComplex = typeof field.value === "object" && field.value !== null;
                    const isExpanded = expandedFields.has(field.key);

                    return (
                      <div key={field.key} className="hover:bg-muted/20">
                        <div
                          className={`flex items-center gap-2 px-3 py-1.5 text-xs ${isComplex ? "cursor-pointer" : ""}`}
                          onClick={() => isComplex && toggleField(field.key)}
                        >
                          {isComplex && (isExpanded ? <ChevronDown className="h-2.5 w-2.5 shrink-0" /> : <ChevronRight className="h-2.5 w-2.5 shrink-0" />)}
                          {!isComplex && <span className="w-2.5 shrink-0" />}
                          <span className="text-muted-foreground font-medium w-40 shrink-0 truncate" title={field.label}>{field.label}</span>
                          <code className="text-[10px] text-muted-foreground/50 w-32 shrink-0 truncate" title={field.key}>{field.key}</code>
                          <Badge variant={getValueBadge(field.value)} className="text-[10px] ml-auto truncate max-w-[250px]">
                            {formatValue(field.value)}
                          </Badge>
                        </div>
                        {isComplex && isExpanded && (
                          <div className="px-4 py-2 bg-muted/10 border-t">
                            <pre className="text-[10px] text-muted-foreground font-mono whitespace-pre-wrap break-all max-h-[200px] overflow-auto">
                              {JSON.stringify(field.value, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}

          {!snapshot && (
            <div className="text-center py-8 text-muted-foreground text-xs">
              Nenhum snapshot disponível. Salve a proposta para visualizar os dados.
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
