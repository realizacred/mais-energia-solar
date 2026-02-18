import { useMemo, useState } from "react";
import {
  ShieldCheck, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Loader2,
  ChevronDown, ChevronRight, Info, Database, Filter, TableProperties, PlusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";
import { cn } from "@/lib/utils";

// ── Types ──────────────────────────────────────────────────
interface DbCustomVar {
  id: string;
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  precisao: number;
  ativo: boolean;
}

type AuditStatus = "ok" | "missing_catalog" | "missing_db";

interface AuditItem {
  key: string;
  label: string;
  status: AuditStatus;
  source: "catálogo" | "banco" | "ambos";
  action: string;
}

interface SchemaField {
  table: string;
  column: string;
  label: string;
  hasVariable: boolean;
  variableKey?: string;
}

// ── Schema mapping: DB columns → expected variable keys ──────
const SYSTEM_COLUMNS = new Set([
  "id", "tenant_id", "created_at", "updated_at", "created_by",
  "lead_id", "cliente_id", "consultor_id", "instalador_id",
  "user_id", "proposta_id", "funil_id", "etapa_id",
  "simulacao_aceita_id", "disjuntor_id", "transformador_id",
  "status_id", "motivo_perda_id", "motivo_perda_obs",
  "ativo", "slug", "settings", "lead_code",
  "telefone_normalized", "identidade_url", "identidade_urls",
  "comprovante_endereco_url", "comprovante_endereco_urls",
  "comprovante_beneficiaria_urls", "arquivos_urls",
  "localizacao", "irradiance_version_id", "irradiance_dataset_code",
  "irradiance_source_lat", "irradiance_source_lon", "irradiance_distance_km",
  "irradiance_point_id", "irradiance_method", "irradiance_units",
  "visto", "visto_admin", "distribuido_em", "synced",
  "ultimo_contato", "proxima_acao", "data_proxima_acao",
  "consultor", "area",
  // Proposal system columns
  "sm_id", "sm_project_id", "sm_raw_payload", "origem",
  "calc_hash", "idempotency_key", "snapshot", "snapshot_locked",
  "irradiance_source_point", "irradiance_dataset_code",
  "gerado_por", "engine_version", "grupo",
  "template_id", "versao_atual", "versao_numero",
  // Deal system columns
  "pipeline_id", "stage_id", "customer_id", "owner_id", "doc_checklist",
]);

// ── Table definitions organized by data flow: Cliente → Deal → Projeto → Proposta ──
const SCHEMA_TABLES: {
  name: string;
  label: string;
  icon: string;
  flowOrder: number;
  columns: { column: string; label: string; expectedKey?: string }[];
}[] = [
  {
    name: "clientes",
    label: "Clientes",
    icon: "👤",
    flowOrder: 1,
    columns: [
      { column: "nome", label: "Nome", expectedKey: "cliente_nome" },
      { column: "telefone", label: "Telefone", expectedKey: "cliente_celular" },
      { column: "email", label: "Email", expectedKey: "cliente_email" },
      { column: "cpf_cnpj", label: "CPF/CNPJ", expectedKey: "cliente_cnpj_cpf" },
      { column: "data_nascimento", label: "Data de Nascimento" },
      { column: "cep", label: "CEP", expectedKey: "cliente_cep" },
      { column: "estado", label: "Estado", expectedKey: "cliente_estado" },
      { column: "cidade", label: "Cidade", expectedKey: "cliente_cidade" },
      { column: "bairro", label: "Bairro", expectedKey: "cliente_bairro" },
      { column: "rua", label: "Rua", expectedKey: "cliente_endereco" },
      { column: "numero", label: "Número", expectedKey: "cliente_numero" },
      { column: "complemento", label: "Complemento", expectedKey: "cliente_complemento" },
      { column: "empresa", label: "Empresa", expectedKey: "cliente_empresa" },
      { column: "potencia_kwp", label: "Potência kWp" },
      { column: "valor_projeto", label: "Valor do Projeto" },
      { column: "data_instalacao", label: "Data de Instalação" },
      { column: "numero_placas", label: "Número de Placas" },
      { column: "modelo_inversor", label: "Modelo do Inversor" },
      { column: "observacoes", label: "Observações" },
    ],
  },
  {
    name: "deals",
    label: "Deals (Kanban)",
    icon: "🎯",
    flowOrder: 2,
    columns: [
      { column: "title", label: "Título do Projeto" },
      { column: "value", label: "Valor do Negócio", expectedKey: "preco" },
      { column: "status", label: "Status (open/won/lost)" },
      { column: "kwp", label: "Potência kWp", expectedKey: "potencia_sistema" },
      { column: "etiqueta", label: "Etiqueta do Projeto" },
      { column: "notas", label: "Notas / Observações" },
      { column: "expected_close_date", label: "Previsão de Fechamento" },
    ],
  },
  {
    name: "projetos",
    label: "Projetos",
    icon: "📁",
    flowOrder: 3,
    columns: [
      { column: "codigo", label: "Código do Projeto", expectedKey: "proposta_identificador" },
      { column: "potencia_kwp", label: "Potência kWp", expectedKey: "potencia_sistema" },
      { column: "numero_modulos", label: "Nº Módulos", expectedKey: "modulo_quantidade" },
      { column: "modelo_modulos", label: "Modelo Módulos", expectedKey: "modulo_modelo" },
      { column: "modelo_inversor", label: "Modelo Inversor", expectedKey: "inversor_modelo" },
      { column: "tipo_instalacao", label: "Tipo de Instalação" },
      { column: "valor_total", label: "Valor Total", expectedKey: "preco" },
      { column: "valor_equipamentos", label: "Valor Equipamentos" },
      { column: "valor_mao_obra", label: "Valor Mão de Obra" },
      { column: "data_venda", label: "Data da Venda" },
      { column: "data_previsao_instalacao", label: "Previsão Instalação" },
      { column: "data_instalacao", label: "Data Instalação" },
      { column: "data_comissionamento", label: "Data Comissionamento" },
      { column: "status", label: "Status do Projeto" },
      { column: "area_util_m2", label: "Área Útil m²", expectedKey: "area_util" },
      { column: "geracao_mensal_media_kwh", label: "Geração Mensal Média", expectedKey: "geracao_mensal" },
      { column: "forma_pagamento", label: "Forma de Pagamento" },
      { column: "valor_entrada", label: "Valor Entrada" },
      { column: "valor_financiado", label: "Valor Financiado" },
      { column: "numero_parcelas", label: "Nº Parcelas" },
      { column: "valor_parcela", label: "Valor Parcela" },
      { column: "prazo_estimado_dias", label: "Prazo Estimado (dias)" },
      { column: "prazo_vistoria_dias", label: "Prazo Vistoria (dias)" },
      { column: "numero_inversores", label: "Nº Inversores", expectedKey: "inversores_utilizados" },
      { column: "observacoes", label: "Observações" },
    ],
  },
  {
    name: "propostas_nativas",
    label: "Propostas",
    icon: "📄",
    flowOrder: 4,
    columns: [
      { column: "titulo", label: "Título da Proposta" },
      { column: "codigo", label: "Código da Proposta", expectedKey: "proposta_identificador" },
      { column: "status", label: "Status da Proposta" },
      { column: "validade_dias", label: "Validade (dias)" },
      { column: "aceita_at", label: "Data de Aceite" },
      { column: "enviada_at", label: "Data de Envio" },
      { column: "recusa_motivo", label: "Motivo de Recusa" },
      { column: "recusada_at", label: "Data de Recusa" },
    ],
  },
  {
    name: "proposta_versoes",
    label: "Versões da Proposta",
    icon: "📋",
    flowOrder: 5,
    columns: [
      { column: "valor_total", label: "Valor Total", expectedKey: "preco_total" },
      { column: "economia_mensal", label: "Economia Mensal", expectedKey: "economia_mensal" },
      { column: "payback_meses", label: "Payback (meses)", expectedKey: "payback_meses" },
      { column: "potencia_kwp", label: "Potência kWp", expectedKey: "potencia_sistema" },
      { column: "validade_dias", label: "Validade (dias)" },
      { column: "valido_ate", label: "Válido Até" },
      { column: "gerado_em", label: "Gerado Em" },
      { column: "aceito_em", label: "Aceito Em" },
      { column: "rejeitado_em", label: "Rejeitado Em" },
      { column: "motivo_rejeicao", label: "Motivo Rejeição" },
      { column: "observacoes", label: "Observações" },
      { column: "status", label: "Status da Versão" },
    ],
  },
  {
    name: "simulacoes",
    label: "Simulações",
    icon: "🧮",
    flowOrder: 6,
    columns: [
      { column: "tipo_conta", label: "Tipo de Conta" },
      { column: "valor_conta", label: "Valor da Conta", expectedKey: "gasto_atual_mensal" },
      { column: "consumo_kwh", label: "Consumo kWh", expectedKey: "consumo_mensal" },
      { column: "cidade", label: "Cidade", expectedKey: "cidade" },
      { column: "estado", label: "Estado", expectedKey: "estado" },
      { column: "concessionaria", label: "Concessionária", expectedKey: "dis_energia" },
      { column: "tipo_telhado", label: "Tipo de Telhado", expectedKey: "tipo_telhado" },
      { column: "potencia_recomendada_kwp", label: "Potência Recomendada", expectedKey: "potencia_ideal_total" },
      { column: "geracao_mensal_estimada", label: "Geração Mensal Estimada", expectedKey: "geracao_mensal" },
      { column: "economia_mensal", label: "Economia Mensal", expectedKey: "economia_mensal" },
      { column: "economia_anual", label: "Economia Anual", expectedKey: "economia_anual" },
      { column: "investimento_estimado", label: "Investimento Estimado", expectedKey: "preco_total" },
      { column: "payback_meses", label: "Payback (meses)", expectedKey: "payback_meses" },
      { column: "co2_evitado_kg", label: "CO₂ Evitado (kg)" },
      { column: "tarifa_kwh_usada", label: "Tarifa kWh Usada", expectedKey: "tarifa_atual" },
      { column: "irradiacao_usada", label: "Irradiação Usada", expectedKey: "fator_geracao" },
    ],
  },
  {
    name: "consultores",
    label: "Consultores",
    icon: "👔",
    flowOrder: 7,
    columns: [
      { column: "nome", label: "Nome", expectedKey: "responsavel_nome" },
      { column: "telefone", label: "Telefone", expectedKey: "responsavel_celular" },
      { column: "email", label: "Email", expectedKey: "responsavel_email" },
      { column: "codigo", label: "Código" },
      { column: "percentual_comissao", label: "% Comissão", expectedKey: "comissao_percentual" },
    ],
  },
  {
    name: "concessionarias",
    label: "Concessionárias",
    icon: "⚡",
    flowOrder: 8,
    columns: [
      { column: "nome", label: "Nome", expectedKey: "dis_energia" },
      { column: "sigla", label: "Sigla" },
      { column: "estado", label: "Estado" },
      { column: "tarifa_energia", label: "Tarifa Energia", expectedKey: "tarifa_distribuidora" },
      { column: "tarifa_fio_b", label: "Tarifa Fio B" },
      { column: "custo_disponibilidade_monofasico", label: "Custo Disp. Monofásico" },
      { column: "custo_disponibilidade_bifasico", label: "Custo Disp. Bifásico" },
      { column: "custo_disponibilidade_trifasico", label: "Custo Disp. Trifásico" },
      { column: "aliquota_icms", label: "Alíquota ICMS" },
      { column: "possui_isencao_scee", label: "Isenção SCEE" },
      { column: "percentual_isencao", label: "% Isenção" },
    ],
  },
];

// Sort by flowOrder
const SORTED_TABLES = [...SCHEMA_TABLES].sort((a, b) => a.flowOrder - b.flowOrder);

// ── Status config ──────────────────────────────────────────
const statusConfig: Record<AuditStatus, { icon: typeof CheckCircle2; color: string; label: string }> = {
  ok: { icon: CheckCircle2, color: "text-success", label: "Sincronizada" },
  missing_catalog: { icon: AlertTriangle, color: "text-warning", label: "Falta no catálogo" },
  missing_db: { icon: XCircle, color: "text-destructive", label: "Falta no banco" },
};

// ── Main Component ──────────────────────────────────────────
export function AuditTabContent({
  dbCustomVars,
  loadingCustom,
  onRefresh,
  onRequestCreateVariable,
}: {
  dbCustomVars: DbCustomVar[];
  loadingCustom: boolean;
  onRefresh: () => void;
  onRequestCreateVariable?: (suggested: { nome: string; label: string; table: string; column: string }) => void;
}) {
  const [showSynced, setShowSynced] = useState(false);
  const [activeFilter, setActiveFilter] = useState<"all" | "missing" | "mapped">("all");
  const [activeTable, setActiveTable] = useState<string | null>(null);

  // ── Custom vars audit ──────────────────────────────────────
  const customAudit = useMemo(() => {
    const results: AuditItem[] = [];
    const catalogCustom = VARIABLES_CATALOG.filter((v) => v.category === "customizada");
    const catalogKeys = new Set(catalogCustom.map((v) => v.legacyKey.replace(/^\[|\]$/g, "")));
    const dbKeys = new Set(dbCustomVars.map((v) => v.nome));

    for (const v of catalogCustom) {
      const key = v.legacyKey.replace(/^\[|\]$/g, "");
      if (!dbKeys.has(key)) {
        results.push({ key, label: v.label, status: "missing_db", source: "catálogo", action: "Criar no banco (aba Customizadas)" });
      }
    }
    for (const v of dbCustomVars) {
      if (!catalogKeys.has(v.nome)) {
        results.push({ key: v.nome, label: v.label, status: "missing_catalog", source: "banco", action: "Adicionar ao variablesCatalog.ts" });
      }
    }
    for (const v of dbCustomVars) {
      if (catalogKeys.has(v.nome)) {
        results.push({ key: v.nome, label: v.label, status: "ok", source: "ambos", action: "" });
      }
    }

    return {
      missingCatalog: results.filter((r) => r.status === "missing_catalog").sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      missingDb: results.filter((r) => r.status === "missing_db").sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
      synced: results.filter((r) => r.status === "ok").sort((a, b) => a.label.localeCompare(b.label, "pt-BR")),
    };
  }, [dbCustomVars]);

  // ── Schema coverage audit ─────────────────────────────────
  const schemaAudit = useMemo(() => {
    const allLegacyKeys = new Set(VARIABLES_CATALOG.map((v) => v.legacyKey.replace(/^\[|\]$/g, "")));
    const fields: SchemaField[] = [];

    for (const table of SORTED_TABLES) {
      for (const col of table.columns) {
        const mapped = col.expectedKey ? allLegacyKeys.has(col.expectedKey) : false;
        fields.push({
          table: table.name,
          column: col.column,
          label: col.label,
          hasVariable: mapped,
          variableKey: col.expectedKey,
        });
      }
    }

    const byTable: Record<string, { total: number; mapped: number; missing: number }> = {};
    for (const t of SORTED_TABLES) {
      const tableFields = fields.filter((f) => f.table === t.name);
      byTable[t.name] = {
        total: tableFields.length,
        mapped: tableFields.filter((f) => f.hasVariable).length,
        missing: tableFields.filter((f) => !f.hasVariable).length,
      };
    }

    return { fields, byTable, totalMissing: fields.filter((f) => !f.hasVariable).length, totalMapped: fields.filter((f) => f.hasVariable).length };
  }, []);

  // ── Filtered schema fields ──────────────────────────────────
  const filteredFields = useMemo(() => {
    let items = schemaAudit.fields;
    if (activeTable) items = items.filter((f) => f.table === activeTable);
    if (activeFilter === "missing") items = items.filter((f) => !f.hasVariable);
    if (activeFilter === "mapped") items = items.filter((f) => f.hasVariable);
    return items;
  }, [schemaAudit, activeTable, activeFilter]);

  if (loadingCustom) {
    return (
      <div className="flex items-center justify-center py-10 text-muted-foreground gap-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-xs">Analisando variáveis...</span>
      </div>
    );
  }

  const totalCustomDivergences = customAudit.missingCatalog.length + customAudit.missingDb.length;

  // Flow groups for visual hierarchy
  const flowGroups = [
    { label: "Fluxo principal", description: "Cliente → Deal → Projeto → Proposta", tables: ["clientes", "deals", "projetos", "propostas_nativas", "proposta_versoes"] },
    { label: "Dados complementares", description: "Simulações, Consultores, Concessionárias", tables: ["simulacoes", "consultores", "concessionarias"] },
  ];

  return (
    <div className="divide-y divide-border">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-muted/10">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-warning" />
          <span className="text-xs font-semibold text-foreground">Auditoria de Variáveis</span>
          <span className="text-[10px] text-muted-foreground">— Cruzamento catálogo × banco × schema</span>
        </div>
        <Button size="sm" variant="outline" onClick={onRefresh} className="h-7 text-xs gap-1.5">
          <RefreshCw className="h-3 w-3" /> Reanalisar
        </Button>
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* SECTION 1: Data Flow Visual */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <TableProperties className="h-4 w-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Cobertura do Schema</span>
          <span className="text-[10px] text-muted-foreground">— Todos os dados que alimentam uma proposta</span>
        </div>

        {/* Data flow indicator */}
        <div className="flex items-center gap-1.5 flex-wrap text-[10px] text-muted-foreground bg-muted/20 rounded-lg px-3 py-2 border border-border/40">
          <span className="font-semibold text-foreground">Fluxo de dados:</span>
          {SORTED_TABLES.slice(0, 5).map((t, i) => (
            <span key={t.name} className="flex items-center gap-1">
              {i > 0 && <span className="text-primary font-bold">→</span>}
              <span className={cn(
                "px-1.5 py-0.5 rounded font-medium",
                activeTable === t.name ? "bg-primary text-primary-foreground" : "bg-card border border-border/40"
              )}>
                {t.icon} {t.label}
              </span>
            </span>
          ))}
          <span className="text-primary font-bold ml-1">+</span>
          <span className="text-muted-foreground">dados complementares</span>
        </div>

        {/* Summary cards — clickable filters */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={() => setActiveFilter("all")}
            className={cn(
              "rounded-lg border p-2.5 text-left transition-all",
              activeFilter === "all" ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border bg-card hover:bg-muted/20"
            )}
          >
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Total campos</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{schemaAudit.fields.length}</p>
            <p className="text-[10px] text-muted-foreground">{SORTED_TABLES.length} tabelas</p>
          </button>
          <button
            onClick={() => setActiveFilter("mapped")}
            className={cn(
              "rounded-lg border p-2.5 text-left transition-all",
              activeFilter === "mapped" ? "border-success/40 bg-success/5 ring-1 ring-success/20" : "border-border bg-card hover:bg-muted/20"
            )}
          >
            <p className="text-[10px] text-success uppercase tracking-wider font-medium">Com variável</p>
            <p className="text-lg font-bold text-success tabular-nums">{schemaAudit.totalMapped}</p>
            <p className="text-[10px] text-muted-foreground">Mapeados no catálogo</p>
          </button>
          <button
            onClick={() => setActiveFilter("missing")}
            className={cn(
              "rounded-lg border p-2.5 text-left transition-all",
              activeFilter === "missing" ? "border-destructive/40 bg-destructive/5 ring-1 ring-destructive/20" : "border-border bg-card hover:bg-muted/20"
            )}
          >
            <p className="text-[10px] text-destructive uppercase tracking-wider font-medium">Sem variável</p>
            <p className="text-lg font-bold text-destructive tabular-nums">{schemaAudit.totalMissing}</p>
            <p className="text-[10px] text-muted-foreground">Precisam mapeamento</p>
          </button>
        </div>

        {/* Table filter chips — grouped by flow */}
        <div className="space-y-1.5">
          {flowGroups.map((group) => (
            <div key={group.label} className="flex flex-wrap items-center gap-1.5">
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider w-[100px] shrink-0">{group.label}</span>
              {SORTED_TABLES.filter(t => group.tables.includes(t.name)).map((t) => {
                const stats = schemaAudit.byTable[t.name];
                const isActive = activeTable === t.name;
                return (
                  <button
                    key={t.name}
                    onClick={() => setActiveTable(isActive ? null : t.name)}
                    className={cn(
                      "flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                      isActive ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span>{t.icon}</span>
                    <span>{t.label}</span>
                    {stats.missing > 0 && (
                      <span className={cn(
                        "text-[8px] font-mono font-bold",
                        isActive ? "text-primary-foreground/70" : "text-destructive"
                      )}>
                        {stats.missing}
                      </span>
                    )}
                    {stats.missing === 0 && (
                      <CheckCircle2 className={cn("h-2.5 w-2.5", isActive ? "text-primary-foreground/70" : "text-success")} />
                    )}
                  </button>
                );
              })}
            </div>
          ))}

          {/* "All" reset button */}
          <div className="flex items-center gap-1.5 ml-[100px]">
            <button
              onClick={() => setActiveTable(null)}
              className={cn(
                "flex items-center gap-1 px-2.5 py-1 text-[10px] font-medium rounded-md transition-all",
                !activeTable ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted"
              )}
            >
              <Filter className="h-2.5 w-2.5" />
              Todas as tabelas
            </button>
          </div>
        </div>

        {/* Schema results table */}
        {filteredFields.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[40px]">Status</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Tabela</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Campo</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Descrição</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">Variável</th>
                  <th className="text-left px-3 py-2 font-semibold text-muted-foreground uppercase tracking-wider text-[10px] w-[80px]">Ação</th>
                </tr>
              </thead>
              <tbody>
                {filteredFields.map((field, idx) => {
                  const tableMeta = SORTED_TABLES.find((t) => t.name === field.table);
                  const suggestedKey = field.variableKey || `${field.table.replace(/s$/, "").replace("proposta_versoe", "proposta")}_${field.column}`;
                  return (
                    <tr key={`${field.table}.${field.column}`} className={cn(
                      "border-b border-border/40 transition-colors hover:bg-accent/5",
                      idx % 2 === 0 ? "bg-card" : "bg-muted/10"
                    )}>
                      <td className="px-3 py-2">
                        {field.hasVariable ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive/60" />
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[10px] text-muted-foreground">{tableMeta?.icon} {tableMeta?.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        <code className="font-mono text-foreground bg-muted/40 px-1.5 py-0.5 rounded text-[10px]">{field.column}</code>
                      </td>
                      <td className="px-3 py-2">
                        <span className="text-[11px] text-foreground">{field.label}</span>
                      </td>
                      <td className="px-3 py-2">
                        {field.hasVariable && field.variableKey ? (
                          <code className="font-mono text-success bg-success/5 px-1.5 py-0.5 rounded text-[10px]">[{field.variableKey}]</code>
                        ) : field.variableKey ? (
                          <span className="text-[10px] text-destructive/70 flex items-center gap-1">
                            <code className="font-mono bg-destructive/5 px-1.5 py-0.5 rounded">[{field.variableKey}]</code>
                            <span>← esperada</span>
                          </span>
                        ) : (
                          <code className="font-mono text-muted-foreground/50 bg-muted/20 px-1.5 py-0.5 rounded text-[10px] italic">[{suggestedKey}]</code>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        {!field.hasVariable && onRequestCreateVariable && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-[10px] gap-1 text-primary hover:text-primary hover:bg-primary/10"
                            onClick={() => onRequestCreateVariable({
                              nome: suggestedKey,
                              label: field.label,
                              table: field.table,
                              column: field.column,
                            })}
                          >
                            <PlusCircle className="h-3 w-3" />
                            Criar
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 mx-auto opacity-20 mb-1" />
            <p className="text-xs">Nenhum campo encontrado com esse filtro.</p>
          </div>
        )}
      </div>

      {/* ════════════════════════════════════════════════════════ */}
      {/* SECTION 2: Custom Variables Sync */}
      {/* ════════════════════════════════════════════════════════ */}
      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center gap-2">
          <Database className="h-4 w-4 text-warning" />
          <span className="text-xs font-semibold text-foreground">Variáveis Customizadas</span>
          <span className="text-[10px] text-muted-foreground">— catálogo × banco (proposta_variaveis_custom)</span>
          {totalCustomDivergences > 0 && (
            <Badge variant="outline" className="text-[9px] bg-warning/10 text-warning border-warning/20">{totalCustomDivergences} divergências</Badge>
          )}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Catálogo</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{VARIABLES_CATALOG.length}</p>
          </div>
          <div className="rounded-lg border border-border bg-card p-2.5 space-y-0.5">
            <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-medium">Banco</p>
            <p className="text-lg font-bold text-foreground tabular-nums">{dbCustomVars.length}</p>
          </div>
          <div className="rounded-lg border border-success/30 bg-success/5 p-2.5 space-y-0.5">
            <p className="text-[9px] text-success uppercase tracking-wider font-medium">Sync</p>
            <p className="text-lg font-bold text-success tabular-nums">{customAudit.synced.length}</p>
          </div>
          <div className={cn(
            "rounded-lg border p-2.5 space-y-0.5",
            totalCustomDivergences > 0 ? "border-warning/30 bg-warning/5" : "border-border bg-card"
          )}>
            <p className="text-[9px] text-warning uppercase tracking-wider font-medium">Divergências</p>
            <p className="text-lg font-bold text-warning tabular-nums">{totalCustomDivergences}</p>
          </div>
        </div>

        {/* Divergence sections */}
        {customAudit.missingDb.length > 0 && (
          <AuditSection
            title="Faltam no banco"
            icon={<XCircle className="h-3.5 w-3.5 text-destructive" />}
            count={customAudit.missingDb.length}
            badgeColor="bg-destructive/10 text-destructive border-destructive/20"
            items={customAudit.missingDb}
            defaultOpen
          />
        )}
        {customAudit.missingCatalog.length > 0 && (
          <AuditSection
            title="Faltam no catálogo"
            icon={<AlertTriangle className="h-3.5 w-3.5 text-warning" />}
            count={customAudit.missingCatalog.length}
            badgeColor="bg-warning/10 text-warning border-warning/20"
            items={customAudit.missingCatalog}
            defaultOpen
          />
        )}

        {/* Synced (collapsed) */}
        <button onClick={() => setShowSynced(!showSynced)} className="flex items-center gap-2 w-full text-left group">
          {showSynced ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
          <span className="text-[11px] font-medium text-foreground">Sincronizadas</span>
          <Badge variant="outline" className="text-[8px] bg-success/10 text-success border-success/20">{customAudit.synced.length}</Badge>
        </button>
        {showSynced && (
          <div className="ml-6 flex flex-wrap gap-1">
            {customAudit.synced.map((item) => (
              <Badge key={item.key} variant="outline" className="text-[9px] font-mono bg-success/5 text-success/80 border-success/20">[{item.key}]</Badge>
            ))}
          </div>
        )}

        {totalCustomDivergences === 0 && (
          <div className="text-center py-4 text-muted-foreground">
            <CheckCircle2 className="h-6 w-6 mx-auto opacity-20 mb-1" />
            <p className="text-[11px] font-medium">Tudo sincronizado!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Section sub-component ────────────────────────────────────
function AuditSection({
  title, icon, count, badgeColor, items, defaultOpen = false,
}: {
  title: string; icon: React.ReactNode; count: number; badgeColor: string; items: AuditItem[]; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left px-3 py-2 bg-muted/20 hover:bg-muted/30 transition-colors">
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
        {icon}
        <span className="text-[11px] font-semibold text-foreground">{title}</span>
        <Badge variant="outline" className={`text-[8px] ${badgeColor}`}>{count}</Badge>
      </button>
      {open && (
        <table className="w-full text-xs">
          <tbody>
            {items.map((item, idx) => {
              const cfg = statusConfig[item.status];
              const Icon = cfg.icon;
              return (
                <tr key={item.key} className={cn(
                  "border-t border-border/40",
                  idx % 2 === 0 ? "bg-card" : "bg-muted/10"
                )}>
                  <td className="px-3 py-2 w-[30px]"><Icon className={`h-3 w-3 ${cfg.color}`} /></td>
                  <td className="px-3 py-2"><span className="text-[11px] font-medium text-foreground">{item.label}</span></td>
                  <td className="px-3 py-2"><code className="font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded text-[10px]">[{item.key}]</code></td>
                  <td className="px-3 py-2"><Badge variant="outline" className="text-[8px] font-mono">{item.source}</Badge></td>
                  <td className="px-3 py-2"><span className="text-[10px] text-muted-foreground flex items-center gap-1"><Info className="h-2.5 w-2.5 shrink-0" />{item.action}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
