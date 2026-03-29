/**
 * Hook for Variables Catalog audit — §16 compliant.
 * Centralizes all audit logic: schema coverage, custom vars sync, description quality.
 */
import { useMemo } from "react";
import { VARIABLES_CATALOG, CATEGORY_LABELS, CATEGORY_ORDER, type VariableCategory } from "@/lib/variablesCatalog";

// ── Types ──────────────────────────────────────────────────
export interface DbCustomVar {
  id: string;
  nome: string;
  label: string;
  expressao: string;
  tipo_resultado: string;
  categoria: string;
  precisao: number;
  ativo: boolean;
}

export type AuditStatus = "ok" | "missing_catalog" | "missing_db";

export interface AuditItem {
  key: string;
  label: string;
  status: AuditStatus;
  source: "catálogo" | "banco" | "ambos";
  action: string;
}

export interface SchemaField {
  table: string;
  column: string;
  label: string;
  hasVariable: boolean;
  variableKey?: string;
}

export interface GhostVariable {
  key: string;
  label: string;
  category: VariableCategory;
  reason: string;
}

export interface DescriptionIssue {
  key: string;
  label: string;
  category: VariableCategory;
  issue: "missing" | "too_short";
}

export type VariableSource = "snapshot" | "db_lead" | "db_cliente" | "db_consultor" | "db_projeto" | "db_proposta" | "db_versao" | "computed" | "custom_vc" | "unknown";

export const SOURCE_LABELS: Record<VariableSource, { label: string; icon: string; color: string }> = {
  snapshot: { label: "Snapshot", icon: "📸", color: "text-info" },
  db_lead: { label: "BD: Lead", icon: "🎯", color: "text-primary" },
  db_cliente: { label: "BD: Cliente", icon: "👤", color: "text-primary" },
  db_consultor: { label: "BD: Consultor", icon: "👔", color: "text-primary" },
  db_projeto: { label: "BD: Projeto", icon: "📁", color: "text-primary" },
  db_proposta: { label: "BD: Proposta", icon: "📄", color: "text-primary" },
  db_versao: { label: "BD: Versão", icon: "📋", color: "text-primary" },
  computed: { label: "Calculada", icon: "🧮", color: "text-warning" },
  custom_vc: { label: "Customizada", icon: "🧩", color: "text-success" },
  unknown: { label: "Desconhecida", icon: "❓", color: "text-destructive" },
};

export interface CategoryAuditEntry {
  category: VariableCategory;
  label: string;
  icon: string;
  total: number;
  variables: Array<{
    key: string;
    canonicalKey: string;
    label: string;
    description: string;
    unit: string;
    example: string;
    hasSchemaMapping: boolean;
    notImplemented?: boolean;
    source: VariableSource;
    resolver: string;
  }>;
}

// ── System columns to ignore ──────────────────────────────
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
  "sm_id", "sm_project_id", "sm_raw_payload", "origem",
  "calc_hash", "idempotency_key", "snapshot", "snapshot_locked",
  "irradiance_source_point",
  "gerado_por", "engine_version", "grupo",
  "template_id", "versao_numero",
  "pipeline_id", "stage_id", "customer_id", "owner_id", "doc_checklist",
  "deal_id", "deal_num", "legacy_key",
  "aceite_estimativa", "aceite_motivo", "data_aceite_estimativa",
  "aneel_run_id", "ano_gd", "fio_b_percent_aplicado",
  "metadata", "missing_variables", "snapshot_hash", "tariff_version_id",
  "vigencia_tarifa", "template_id_used",
  "final_snapshot", "finalized_at", "generated_at", "generation_error", "generation_status",
  "irradiance_source_point",
  "cofins_percentual", "pis_percentual", "nome_aneel_oficial",
  "tarifa_fio_b_gd", "ultima_sync_tarifas",
  "assinatura_url",
]);

// ── Schema tables ──────────────────────────────────────────
export type SchemaColType = "string" | "number" | "date" | "boolean";

export const SCHEMA_TABLES: {
  name: string;
  label: string;
  icon: string;
  flowOrder: number;
  columns: { column: string; label: string; expectedKey?: string; colType?: SchemaColType }[];
}[] = [
  {
    name: "clientes", label: "Clientes", icon: "👤", flowOrder: 1,
    columns: [
      { column: "nome", label: "Nome", expectedKey: "cliente_nome" },
      { column: "telefone", label: "Telefone", expectedKey: "cliente_celular" },
      { column: "email", label: "Email", expectedKey: "cliente_email" },
      { column: "cpf_cnpj", label: "CPF/CNPJ", expectedKey: "cliente_cnpj_cpf" },
      { column: "data_nascimento", label: "Data de Nascimento", expectedKey: "cliente_data_nascimento", colType: "date" },
      { column: "cep", label: "CEP", expectedKey: "cliente_cep" },
      { column: "estado", label: "Estado", expectedKey: "cliente_estado" },
      { column: "cidade", label: "Cidade", expectedKey: "cliente_cidade" },
      { column: "bairro", label: "Bairro", expectedKey: "cliente_bairro" },
      { column: "rua", label: "Rua", expectedKey: "cliente_endereco" },
      { column: "numero", label: "Número", expectedKey: "cliente_numero" },
      { column: "complemento", label: "Complemento", expectedKey: "cliente_complemento" },
      { column: "empresa", label: "Empresa", expectedKey: "cliente_empresa" },
      { column: "potencia_kwp", label: "Potência kWp", expectedKey: "cliente_potencia_kwp", colType: "number" },
      { column: "valor_projeto", label: "Valor do Projeto", expectedKey: "cliente_valor_projeto", colType: "number" },
      { column: "data_instalacao", label: "Data de Instalação", expectedKey: "cliente_data_instalacao", colType: "date" },
      { column: "numero_placas", label: "Número de Placas", expectedKey: "cliente_numero_placas", colType: "number" },
      { column: "modelo_inversor", label: "Modelo do Inversor", expectedKey: "cliente_modelo_inversor", colType: "string" },
      { column: "observacoes", label: "Observações", expectedKey: "cliente_observacoes", colType: "string" },
    ],
  },
  {
    name: "deals", label: "Deals (Kanban)", icon: "🎯", flowOrder: 2,
    columns: [
      { column: "title", label: "Título do Projeto", expectedKey: "deal_title" },
      { column: "value", label: "Valor do Negócio", expectedKey: "preco" },
      { column: "status", label: "Status (open/won/lost)", expectedKey: "deal_status", colType: "string" },
      { column: "kwp", label: "Potência kWp", expectedKey: "potencia_sistema" },
      { column: "etiqueta", label: "Etiqueta do Projeto", expectedKey: "deal_etiqueta", colType: "string" },
      { column: "notas", label: "Notas / Observações", expectedKey: "deal_notas", colType: "string" },
      { column: "expected_close_date", label: "Previsão de Fechamento", expectedKey: "deal_expected_close_date", colType: "date" },
    ],
  },
  {
    name: "projetos", label: "Projetos", icon: "📁", flowOrder: 3,
    columns: [
      { column: "codigo", label: "Código do Projeto", expectedKey: "proposta_identificador" },
      { column: "projeto_num", label: "Nº Sequencial do Projeto", expectedKey: "projeto_id_externo" },
      { column: "potencia_kwp", label: "Potência kWp", expectedKey: "potencia_sistema" },
      { column: "numero_modulos", label: "Nº Módulos", expectedKey: "modulo_quantidade" },
      { column: "modelo_modulos", label: "Modelo Módulos", expectedKey: "modulo_modelo" },
      { column: "modelo_inversor", label: "Modelo Inversor", expectedKey: "inversor_modelo" },
      { column: "numero_inversores", label: "Nº Inversores", expectedKey: "inversores_utilizados" },
      { column: "tipo_instalacao", label: "Tipo de Instalação", expectedKey: "projeto_tipo_instalacao", colType: "string" },
      { column: "valor_total", label: "Valor Total", expectedKey: "preco" },
      { column: "valor_equipamentos", label: "Valor Equipamentos", expectedKey: "projeto_valor_equipamentos", colType: "number" },
      { column: "valor_mao_obra", label: "Valor Mão de Obra", expectedKey: "projeto_valor_mao_obra", colType: "number" },
      { column: "data_venda", label: "Data da Venda", expectedKey: "projeto_data_venda", colType: "date" },
      { column: "data_previsao_instalacao", label: "Previsão Instalação", expectedKey: "projeto_data_previsao_instalacao", colType: "date" },
      { column: "data_instalacao", label: "Data Instalação", expectedKey: "projeto_data_instalacao", colType: "date" },
      { column: "data_comissionamento", label: "Data Comissionamento", expectedKey: "projeto_data_comissionamento", colType: "date" },
      { column: "status", label: "Status do Projeto", expectedKey: "projeto_status", colType: "string" },
      { column: "area_util_m2", label: "Área Útil m²", expectedKey: "area_util" },
      { column: "geracao_mensal_media_kwh", label: "Geração Mensal Média", expectedKey: "geracao_mensal" },
      { column: "forma_pagamento", label: "Forma de Pagamento", expectedKey: "projeto_forma_pagamento", colType: "string" },
      { column: "valor_entrada", label: "Valor Entrada", expectedKey: "projeto_valor_entrada", colType: "number" },
      { column: "valor_financiado", label: "Valor Financiado", expectedKey: "projeto_valor_financiado", colType: "number" },
      { column: "numero_parcelas", label: "Nº Parcelas", expectedKey: "projeto_numero_parcelas", colType: "number" },
      { column: "valor_parcela", label: "Valor Parcela", expectedKey: "projeto_valor_parcela", colType: "number" },
      { column: "prazo_estimado_dias", label: "Prazo Estimado (dias)", expectedKey: "projeto_prazo_estimado_dias", colType: "number" },
      { column: "prazo_vistoria_dias", label: "Prazo Vistoria (dias)", expectedKey: "projeto_prazo_vistoria_dias", colType: "number" },
      { column: "rua_instalacao", label: "Rua Instalação", expectedKey: "projeto_rua_instalacao", colType: "string" },
      { column: "numero_instalacao", label: "Número Instalação", expectedKey: "projeto_numero_instalacao", colType: "string" },
      { column: "complemento_instalacao", label: "Complemento Instalação", expectedKey: "projeto_complemento_instalacao", colType: "string" },
      { column: "bairro_instalacao", label: "Bairro Instalação", expectedKey: "projeto_bairro_instalacao", colType: "string" },
      { column: "cidade_instalacao", label: "Cidade Instalação", expectedKey: "projeto_cidade_instalacao", colType: "string" },
      { column: "uf_instalacao", label: "UF Instalação", expectedKey: "projeto_uf_instalacao", colType: "string" },
      { column: "cep_instalacao", label: "CEP Instalação", expectedKey: "projeto_cep_instalacao", colType: "string" },
      { column: "lat_instalacao", label: "Latitude Instalação", expectedKey: "projeto_lat_instalacao", colType: "number" },
      { column: "lon_instalacao", label: "Longitude Instalação", expectedKey: "projeto_lon_instalacao", colType: "number" },
      { column: "observacoes", label: "Observações", expectedKey: "projeto_observacoes", colType: "string" },
    ],
  },
  {
    name: "propostas_nativas", label: "Propostas", icon: "📄", flowOrder: 4,
    columns: [
      { column: "titulo", label: "Título da Proposta", expectedKey: "proposta_titulo" },
      { column: "codigo", label: "Código da Proposta", expectedKey: "proposta_identificador" },
      { column: "proposta_num", label: "Número da Proposta", expectedKey: "proposta_num", colType: "number" },
      { column: "status", label: "Status da Proposta", expectedKey: "proposta_status", colType: "string" },
      { column: "validade_dias", label: "Validade (dias)", expectedKey: "proposta_validade" },
      { column: "aceita_at", label: "Data de Aceite", expectedKey: "proposta_aceita_at", colType: "date" },
      { column: "enviada_at", label: "Data de Envio", expectedKey: "proposta_enviada_at", colType: "date" },
      { column: "recusa_motivo", label: "Motivo de Recusa", expectedKey: "proposta_recusa_motivo", colType: "string" },
      { column: "recusada_at", label: "Data de Recusa", expectedKey: "proposta_recusada_at", colType: "date" },
      { column: "regra_gd", label: "Regra GD Aplicada", expectedKey: "proposta_regra_gd", colType: "string" },
      { column: "origem_tarifa", label: "Origem da Tarifa", expectedKey: "proposta_origem_tarifa", colType: "string" },
      { column: "precisao_calculo", label: "Precisão do Cálculo", expectedKey: "proposta_precisao_calculo", colType: "string" },
      { column: "precisao_motivo", label: "Motivo da Precisão", expectedKey: "proposta_precisao_motivo", colType: "string" },
      { column: "versao_atual", label: "Versão Atual", expectedKey: "proposta_versao_atual", colType: "number" },
    ],
  },
  {
    name: "proposta_versoes", label: "Versões da Proposta", icon: "📋", flowOrder: 5,
    columns: [
      { column: "valor_total", label: "Valor Total", expectedKey: "preco_total" },
      { column: "economia_mensal", label: "Economia Mensal", expectedKey: "economia_mensal" },
      { column: "economia_mensal_percent", label: "Economia Mensal (%)", expectedKey: "economia_percentual" },
      { column: "payback_meses", label: "Payback (meses)", expectedKey: "payback_meses" },
      { column: "potencia_kwp", label: "Potência kWp", expectedKey: "potencia_sistema" },
      { column: "consumo_mensal", label: "Consumo Mensal", expectedKey: "consumo_mensal" },
      { column: "geracao_mensal", label: "Geração Mensal", expectedKey: "geracao_mensal" },
      { column: "geracao_anual", label: "Geração Anual", expectedKey: "geracao_anual" },
      { column: "tarifa_distribuidora", label: "Tarifa Distribuidora", expectedKey: "tarifa_distribuidora" },
      { column: "distribuidora_nome", label: "Nome Distribuidora", expectedKey: "dis_energia" },
      { column: "custo_disponibilidade", label: "Custo de Disponibilidade", expectedKey: "custo_disponibilidade_kwh" },
      { column: "tir", label: "TIR (%)", expectedKey: "tir" },
      { column: "vpl", label: "VPL (R$)", expectedKey: "vpl" },
      { column: "inflacao_energetica", label: "Inflação Energética (%)", expectedKey: "proposta_inflacao_energetica", colType: "number" },
      { column: "perda_eficiencia_anual", label: "Perda de Eficiência Anual (%)", expectedKey: "proposta_perda_eficiencia_anual", colType: "number" },
      { column: "sobredimensionamento", label: "Sobredimensionamento (%)", expectedKey: "proposta_sobredimensionamento", colType: "number" },
      { column: "validade_dias", label: "Validade (dias)", expectedKey: "proposta_validade" },
      { column: "valido_ate", label: "Válido Até", expectedKey: "proposta_valido_ate", colType: "date" },
      { column: "gerado_em", label: "Gerado Em", expectedKey: "proposta_data" },
      { column: "enviado_em", label: "Enviado Em", expectedKey: "proposta_enviado_em", colType: "date" },
      { column: "aceito_em", label: "Aceito Em", expectedKey: "proposta_aceito_em", colType: "date" },
      { column: "rejeitado_em", label: "Rejeitado Em", expectedKey: "proposta_rejeitado_em", colType: "date" },
      { column: "motivo_rejeicao", label: "Motivo Rejeição", expectedKey: "proposta_motivo_rejeicao", colType: "string" },
      { column: "link_pdf", label: "Link do PDF", expectedKey: "proposta_link_pdf" },
      { column: "public_slug", label: "Link Público (Slug)", expectedKey: "proposta_link" },
      { column: "output_docx_path", label: "Arquivo DOCX", expectedKey: "proposta_output_docx_path", colType: "string" },
      { column: "output_pdf_path", label: "Arquivo PDF", expectedKey: "proposta_output_pdf_path", colType: "string" },
      { column: "viewed_at", label: "Visualizado Em", expectedKey: "proposta_viewed_at", colType: "date" },
      { column: "observacoes", label: "Observações", expectedKey: "proposta_observacoes", colType: "string" },
      { column: "status", label: "Status da Versão", expectedKey: "proposta_versao_status", colType: "string" },
    ],
  },
  {
    name: "simulacoes", label: "Simulações", icon: "🧮", flowOrder: 6,
    columns: [
      { column: "tipo_conta", label: "Tipo de Conta", expectedKey: "simulacao_tipo_conta", colType: "string" },
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
      { column: "co2_evitado_kg", label: "CO₂ Evitado (kg)", expectedKey: "simulacao_co2_evitado_kg", colType: "number" },
      { column: "tarifa_kwh_usada", label: "Tarifa kWh Usada", expectedKey: "tarifa_atual" },
      { column: "irradiacao_usada", label: "Irradiação Usada", expectedKey: "fator_geracao" },
    ],
  },
  {
    name: "consultores", label: "Consultores", icon: "👔", flowOrder: 7,
    columns: [
      { column: "nome", label: "Nome", expectedKey: "responsavel_nome" },
      { column: "telefone", label: "Telefone", expectedKey: "consultor_telefone" },
      { column: "email", label: "Email", expectedKey: "consultor_email" },
      { column: "codigo", label: "Código", expectedKey: "consultor_codigo", colType: "string" },
      { column: "percentual_comissao", label: "% Comissão", expectedKey: "comissao_percentual" },
    ],
  },
  {
    name: "concessionarias", label: "Concessionárias", icon: "⚡", flowOrder: 8,
    columns: [
      { column: "nome", label: "Nome", expectedKey: "dis_energia" },
      { column: "sigla", label: "Sigla", expectedKey: "concessionaria_sigla", colType: "string" },
      { column: "estado", label: "Estado", expectedKey: "concessionaria_estado", colType: "string" },
      { column: "tarifa_energia", label: "Tarifa Energia", expectedKey: "tarifa_distribuidora" },
      { column: "tarifa_fio_b", label: "Tarifa Fio B", expectedKey: "concessionaria_tarifa_fio_b", colType: "number" },
      { column: "custo_disponibilidade_monofasico", label: "Custo Disp. Monofásico", expectedKey: "concessionaria_custo_disponibilidade_monofasico", colType: "number" },
      { column: "custo_disponibilidade_bifasico", label: "Custo Disp. Bifásico", expectedKey: "concessionaria_custo_disponibilidade_bifasico", colType: "number" },
      { column: "custo_disponibilidade_trifasico", label: "Custo Disp. Trifásico", expectedKey: "concessionaria_custo_disponibilidade_trifasico", colType: "number" },
      { column: "aliquota_icms", label: "Alíquota ICMS", expectedKey: "concessionaria_aliquota_icms", colType: "number" },
      { column: "possui_isencao_scee", label: "Isenção SCEE", expectedKey: "concessionaria_possui_isencao_scee", colType: "boolean" },
      { column: "percentual_isencao", label: "% Isenção", expectedKey: "concessionaria_percentual_isencao", colType: "number" },
    ],
  },
];

export const SORTED_TABLES = [...SCHEMA_TABLES].sort((a, b) => a.flowOrder - b.flowOrder);

export const FLOW_GROUPS = [
  { label: "Fluxo principal", description: "Cliente → Deal → Projeto → Proposta", tables: ["clientes", "deals", "projetos", "propostas_nativas", "proposta_versoes"] },
  { label: "Dados complementares", description: "Simulações, Consultores, Concessionárias", tables: ["simulacoes", "consultores", "concessionarias"] },
];

// ── Hook ──────────────────────────────────────────────────
export function useVariablesAudit(dbCustomVars: DbCustomVar[]) {
  // ── Custom vars sync audit ──────────────────────────────
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

  // ── Schema coverage audit ────────────────────────────────
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

    return {
      fields,
      byTable,
      totalMissing: fields.filter((f) => !f.hasVariable).length,
      totalMapped: fields.filter((f) => f.hasVariable).length,
    };
  }, []);

  // ── Description quality audit ────────────────────────────
  const descriptionAudit = useMemo(() => {
    const issues: DescriptionIssue[] = [];

    for (const v of VARIABLES_CATALOG) {
      if (!v.description || v.description.trim() === "") {
        issues.push({
          key: v.legacyKey.replace(/^\[|\]$/g, ""),
          label: v.label,
          category: v.category,
          issue: "missing",
        });
      } else if (v.description.trim().length < 10) {
        issues.push({
          key: v.legacyKey.replace(/^\[|\]$/g, ""),
          label: v.label,
          category: v.category,
          issue: "too_short",
        });
      }
    }

    return {
      issues,
      totalIncomplete: issues.length,
      totalMissing: issues.filter((i) => i.issue === "missing").length,
      totalTooShort: issues.filter((i) => i.issue === "too_short").length,
    };
  }, []);

  // ── Ghost variable detection ─────────────────────────────
  // Catalog variables that have an expectedKey in SCHEMA_TABLES but no matching column exists,
  // OR variables that reference no known schema table at all
  const ghostVariables = useMemo(() => {
    const allExpectedKeys = new Set<string>();
    for (const table of SORTED_TABLES) {
      for (const col of table.columns) {
        if (col.expectedKey) allExpectedKeys.add(col.expectedKey);
      }
    }

    const ghosts: GhostVariable[] = [];
    // Check if any catalog variable references a key that was removed from schema mapping
    // A "ghost" is a variable that existed with an expectedKey but the mapping was removed
    // We detect by looking at variables that mention a table prefix but don't appear in any schema table
    // Explicit prefix map: variable key prefix → table name
    // Using explicit mapping avoids regex bugs (e.g., "simulacoes" → "simulacoe" instead of "simulacao")
    const EXPLICIT_PREFIXES: Record<string, string> = {
      cliente: "clientes",
      deal: "deals",
      projeto: "projetos",
      proposta: "propostas_nativas",
      proposta_versao: "proposta_versoes",
      simulacao: "simulacoes",
      consultor: "consultores",
      concessionaria: "concessionarias",
    };
    const tablePrefixes = new Map<string, string>(Object.entries(EXPLICIT_PREFIXES));

    for (const v of VARIABLES_CATALOG) {
      if (v.category === "customizada") continue; // custom vars are tracked separately
      if (v.notImplemented) continue;

      const key = v.legacyKey.replace(/^\[|\]$/g, "");
      // Check if this key appears in any schema table's expectedKey
      if (allExpectedKeys.has(key)) continue; // It's mapped, all good

      // Check if key looks like it should be in a schema table (e.g. "cliente_nome" → "clientes")
      for (const [prefix, tableName] of tablePrefixes) {
        if (key.startsWith(prefix + "_")) {
          const colName = key.substring(prefix.length + 1);
          const table = SORTED_TABLES.find((t) => t.name === tableName);
          if (table) {
            const colExists = table.columns.some((c) => c.column === colName);
            if (!colExists) {
              ghosts.push({
                key,
                label: v.label,
                category: v.category,
                reason: `Coluna "${colName}" não encontrada em "${tableName}"`,
              });
            }
          }
          break;
        }
      }
    }

    return ghosts;
  }, []);

  const totalCustomDivergences = customAudit.missingCatalog.length + customAudit.missingDb.length;

  // ── Category audit ─────────────────────────────────────
  const categoryAudit = useMemo(() => {
    const CATEGORY_ICONS: Record<VariableCategory, string> = {
      entrada: "📥", sistema_solar: "☀️", financeiro: "💰", conta_energia: "⚡",
      comercial: "🏢", cliente: "👤", contrato: "📄", assinatura: "✍️",
      pagamento: "💳", tabelas: "📊", series: "📈",
      premissas: "⚙️", tarifa: "🏷️", aneel: "🔄", gd: "🌞",
      calculo: "🧮", cdd: "🔗", customizada: "🧩",
    };

    // Build set of all expectedKeys for cross-reference
    const allExpectedKeys = new Set<string>();
    for (const table of SORTED_TABLES) {
      for (const col of table.columns) {
        if (col.expectedKey) allExpectedKeys.add(col.expectedKey);
      }
    }

    // ── Source resolution map ──
    // Based on analysis of 5 domain resolvers in supabase/functions/_shared/resolvers/
    const RESOLVER_MAP: Record<string, { source: VariableSource; resolver: string }> = {};
    const addToMap = (keys: string[], source: VariableSource, resolver: string) => {
      for (const k of keys) RESOLVER_MAP[k] = { source, resolver };
    };

    // resolveEntrada.ts — snapshot.ucs[], snapshot top-level, ext.lead, ext.cliente
    addToMap([
      "tipo", "tipo_uc1", "consumo_mensal", "consumo_mensal_uc1",
      "consumo_mensal_p", "consumo_mensal_p_uc1", "consumo_mensal_fp", "consumo_mensal_fp_uc1",
      "dis_energia", "concessionaria_id", "subgrupo", "subgrupo_uc1", "grupo_tarifario",
      "tarifa_distribuidora", "tarifa_distribuidora_uc1",
      "tarifa_te_p", "tarifa_te_p_uc1", "tarifa_tusd_p", "tarifa_tusd_p_uc1",
      "tarifa_te_fp", "tarifa_te_fp_uc1", "tarifa_tusd_fp", "tarifa_tusd_fp_uc1",
      "demanda_preco", "demanda_preco_uc1", "demanda_contratada", "demanda_contratada_uc1", "demanda_adicional",
      "outros_encargos_atual", "outros_encargos_atual_uc1", "outros_encargos_novo", "outros_encargos_novo_uc1",
      "estado", "cidade", "distancia", "taxa_desempenho", "desvio_azimutal", "inclinacao", "fator_geracao",
      "tipo_telhado", "cape_telhado", "estrutura", "fase", "fase_uc1", "tensao_rede", "tensao",
      "custo_disponibilidade_kwh", "custo_disponibilidade_kwh_uc1",
      "topologia", "fator_simultaneidade", "tipo_sistema",
      "rateio_sugerido_creditos", "rateio_sugerido_creditos_uc1", "rateio_creditos", "rateio_creditos_uc1",
      "imposto_energia", "imposto_energia_uc1", "nome_uc1",
      "demanda_g_uc1", "demanda_g_preco_uc1",
      "t_e_comp_fp_1_uc1", "t_e_comp_fp_2_uc1", "t_e_comp_p_1_uc1", "t_e_comp_p_2_uc1",
      "t_e_comp_bt_1_uc1", "t_e_comp_bt_2_uc1", "regra_comp_uc1", "dod", "cidade_estado", "qtd_ucs",
      "area_util",
    ], "snapshot", "resolveEntrada");
    // Monthly consumption keys
    for (const m of ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]) {
      addToMap([`consumo_${m}`, `consumo_${m}_uc1`, `consumo_mensal_p_${m}`, `consumo_mensal_p_${m}_uc1`,
        `consumo_mensal_fp_${m}`, `consumo_mensal_fp_${m}_uc1`, `fator_geracao_${m}`], "snapshot", "resolveEntrada");
    }

    // resolveSistemaSolar.ts — snapshot.itens[], snapshot.tecnico, ext.projeto, ext.cliente
    addToMap([
      "potencia_sistema", "potencia_kwp", "potencia_ideal_total",
      "geracao_mensal", "geracao_anual",
      "numero_modulos", "modulo_quantidade", "vc_total_modulo",
      "modulo_fabricante", "modulo_modelo", "modulo_potencia", "vc_modulo_potencia",
      "inversor_fabricante", "inversor_modelo", "inversor_potencia_nominal", "inversores_utilizados", "inversor_quantidade",
      "otimizador_fabricante", "otimizador_modelo", "otimizador_potencia", "otimizador_quantidade",
      "transformador_nome", "transformador_potencia",
      "bateria_fabricante", "bateria_modelo", "bateria_tipo", "bateria_energia", "bateria_quantidade",
      "bateria_capacidade", "bateria_tensao_operacao", "bateria_tensao_nominal", "bateria_potencia_maxima_saida",
      "autonomia", "energia_diaria_armazenamento", "armazenamento_necessario",
      "layout_arranjo_linhas", "layout_arranjos_total", "layout_orientacao",
      "creditos_gerados", "kit_fechado_quantidade", "segmentos_utilizados",
      "area_necessaria", "peso_total", "estrutura_tipo", "kit_codigo",
    ], "snapshot", "resolveSistemaSolar");
    for (const m of ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]) {
      addToMap([`geracao_${m}`], "snapshot", "resolveSistemaSolar");
    }
    for (let i = 0; i <= 25; i++) addToMap([`geracao_anual_${i}`], "snapshot", "resolveSistemaSolar");
    for (let i = 1; i <= 5; i++) {
      addToMap([`inversor_fabricante_${i}`, `inversor_modelo_${i}`, `inversor_potencia_nominal_${i}`, `inversor_quantidade_${i}`], "snapshot", "resolveSistemaSolar");
      addToMap([`bateria_fabricante_${i}`, `bateria_modelo_${i}`], "snapshot", "resolveSistemaSolar");
    }

    // resolveFinanceiro.ts — snapshot.financeiro, versaoData, ext.projeto
    addToMap([
      "valor_total", "preco_final", "preco_total", "preco", "capo_i", "vc_a_vista",
      "preco_kwp", "preco_watt",
      "economia_mensal", "economia_anual", "roi_25_anos", "economia_25_anos",
      "payback", "payback_meses", "payback_anos",
      "kit_fechado_preco_total", "vpl", "tir", "roi_anual",
      "margem_lucro", "margem_percentual", "desconto_percentual", "desconto_valor",
      "custo_modulos", "custo_inversores", "custo_estrutura", "custo_instalacao", "custo_kit",
      "comissao_percentual", "comissao_valor", "comissao_res", "comissao_rep",
      "distribuidor_categoria", "preco_por_extenso",
      "modulo_custo_un", "modulo_preco_un", "modulo_custo_total", "modulo_preco_total",
      "inversor_custo_un", "inversor_preco_un", "inversor_custo_total", "inversor_preco_total",
      "inversores_custo_total", "inversores_preco_total",
      "otimizador_custo_un", "otimizador_preco_un", "otimizador_custo_total", "otimizador_preco_total",
      "instalacao_custo_total", "instalacao_preco_total",
      "estrutura_custo_total", "estrutura_preco_total",
      "equipamentos_custo_total", "kits_custo_total", "componentes_custo_total",
      "baterias_custo_total", "baterias_preco_total",
      "transformadores_custo_total", "transformadores_preco_total",
      "solar_25", "renda_25", "poupanca_25",
    ], "snapshot", "resolveFinanceiro");
    for (let i = 1; i <= 5; i++) {
      addToMap([`f_nome_${i}`, `f_entrada_${i}`, `f_valor_${i}`, `f_prazo_${i}`, `f_taxa_${i}`, `f_parcela_${i}`], "snapshot", "resolveFinanceiro");
      addToMap([`inversor_custo_un_${i}`, `inversor_preco_un_${i}`, `inversor_preco_total_${i}`], "snapshot", "resolveFinanceiro");
      addToMap([`item_a_nome_${i}`, `item_a_custo_${i}`, `item_a_preco_${i}`], "snapshot", "resolveFinanceiro");
    }
    for (let i = 0; i <= 25; i++) {
      addToMap([`investimento_anual_${i}`, `economia_anual_valor_${i}`, `fluxo_caixa_acumulado_anual_${i}`], "snapshot", "resolveFinanceiro");
    }
    addToMap(["f_ativo_nome","f_ativo_entrada","f_ativo_valor","f_ativo_prazo","f_ativo_taxa","f_ativo_parcela",
      "f_banco","f_taxa_juros","f_parcelas","f_valor_parcela","f_entrada","f_valor_financiado","f_cet"], "snapshot", "resolveFinanceiro");

    // resolveClienteComercial.ts — ext.cliente, ext.lead, ext.consultor, ext.tenantNome
    addToMap([
      "cliente_nome", "vc_nome", "cliente_celular", "cliente_email", "cliente_cnpj_cpf",
      "cliente_empresa", "cliente_cep", "cliente_endereco", "cliente_numero", "cliente_complemento",
      "cliente_bairro", "cliente_cidade", "cliente_estado",
    ], "db_cliente", "resolveClienteComercial");
    addToMap([
      "proposta_data", "proposta_titulo", "proposta_identificador", "proposta_validade", "proposta_versao",
    ], "db_proposta", "resolveClienteComercial");
    addToMap([
      "responsavel_nome", "consultor_nome", "consultor_telefone", "consultor_email",
    ], "db_consultor", "resolveClienteComercial");
    addToMap(["empresa_nome"], "db_proposta", "resolveClienteComercial");
    // Conta de energia fields
    addToMap([
      "gasto_atual_mensal", "gasto_com_solar_mensal", "economia_percentual",
      "creditos_mensal", "tarifa_atual", "imposto_percentual", "bandeira_tarifaria",
      "custo_disponibilidade_valor", "gasto_energia_mensal_atual", "gasto_energia_mensal_novo",
      "gasto_energia_mensal_bt_atual", "gasto_energia_mensal_bt_novo",
      "gasto_energia_mensal_p_atual", "gasto_energia_mensal_p_novo",
      "gasto_energia_mensal_fp_atual", "gasto_energia_mensal_fp_novo",
      "gasto_demanda_mensal_atual", "gasto_demanda_mensal_novo",
      "economia_energia_mensal", "economia_energia_mensal_p",
      "economia_demanda_mensal", "economia_demanda_mensal_p",
      "gasto_total_mensal_atual", "gasto_total_mensal_novo",
      "creditos_alocados", "consumo_abatido",
      "valor_imposto_energia", "tarifacao_energia_compensada_bt",
    ], "snapshot", "resolveClienteComercial");
    addToMap(["co2_evitado_ano"], "computed", "resolveClienteComercial");
    // Premissas
    addToMap([
      "inflacao_energetica", "inflacao_ipca", "imposto", "vpl_taxa_desconto",
      "perda_eficiencia_anual", "troca_inversor", "troca_inversor_custo",
      "sobredimensionamento", "vida_util_sistema",
    ], "snapshot", "resolveClienteComercial");
    addToMap(["vc_observacao"], "db_lead", "resolveClienteComercial");
    for (const m of ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"]) {
      addToMap([`creditos_${m}`, `creditos_alocados_${m}`], "snapshot", "resolveClienteComercial");
    }
    // UC-specific conta_energia fields
    for (let i = 1; i <= 10; i++) {
      addToMap([
        `gasto_atual_mensal_uc${i}`, `gasto_com_solar_mensal_uc${i}`, `economia_percentual_uc${i}`,
        `gasto_energia_mensal_atual_uc${i}`, `gasto_energia_mensal_novo_uc${i}`,
        `gasto_energia_mensal_bt_atual_uc${i}`, `gasto_energia_mensal_bt_novo_uc${i}`,
        `gasto_energia_mensal_p_atual_uc${i}`, `gasto_energia_mensal_p_novo_uc${i}`,
        `gasto_energia_mensal_fp_atual_uc${i}`, `gasto_energia_mensal_fp_novo_uc${i}`,
        `gasto_demanda_mensal_atual_uc${i}`, `gasto_demanda_mensal_novo_uc${i}`,
        `economia_energia_mensal_uc${i}`, `economia_demanda_mensal_uc${i}`,
        `gasto_total_mensal_atual_uc${i}`, `gasto_total_mensal_novo_uc${i}`,
      ], "snapshot", "resolveClienteComercial");
    }

    // ── Cliente (complementares — db_cliente via resolveClienteComercial) ──
    addToMap([
      "cliente_data_nascimento", "cliente_potencia_kwp", "cliente_valor_projeto",
      "cliente_data_instalacao", "cliente_numero_placas", "cliente_modelo_inversor",
      "cliente_observacoes",
    ], "db_cliente", "resolveClienteComercial");

    // ── Comercial: Empresa/Tenant ──
    addToMap([
      "empresa_cnpj_cpf", "empresa_cidade", "empresa_estado", "empresa_endereco",
      "empresa_telefone", "empresa_email", "empresa_logo_url",
    ], "db_proposta", "resolveClienteComercial");

    // ── Comercial: Consultor/Responsável/Representante ──
    addToMap(["consultor_codigo"], "db_consultor", "resolveClienteComercial");
    addToMap([
      "responsavel_email", "responsavel_celular",
      "representante_nome", "representante_email", "representante_celular",
    ], "db_consultor", "resolveClienteComercial");

    // ── Comercial: Deal ──
    addToMap([
      "deal_title", "deal_status", "deal_etiqueta", "deal_notas", "deal_expected_close_date",
    ], "db_projeto", "resolveClienteComercial");

    // ── Comercial: Proposta (detalhes — db_proposta/db_versao) ──
    addToMap([
      "proposta_num", "proposta_status", "proposta_valido_ate", "proposta_link_pdf",
      "proposta_aceita_at", "proposta_enviada_at", "proposta_recusa_motivo", "proposta_recusada_at",
      "proposta_regra_gd", "proposta_origem_tarifa", "proposta_precisao_calculo",
      "proposta_precisao_motivo", "proposta_versao_atual",
    ], "db_proposta", "resolveClienteComercial");
    addToMap([
      "proposta_inflacao_energetica", "proposta_perda_eficiencia_anual", "proposta_sobredimensionamento",
      "proposta_enviado_em", "proposta_aceito_em", "proposta_rejeitado_em",
      "proposta_motivo_rejeicao", "proposta_output_docx_path", "proposta_output_pdf_path",
      "proposta_viewed_at", "proposta_observacoes", "proposta_versao_status",
      "proposta_link",
    ], "db_versao", "resolveClienteComercial");

    // ── Comercial: Projeto (detalhes) ──
    addToMap([
      "projeto_id_externo", "projeto_tipo_instalacao", "projeto_valor_equipamentos",
      "projeto_valor_mao_obra", "projeto_data_venda", "projeto_data_previsao_instalacao",
      "projeto_data_instalacao", "projeto_data_comissionamento", "projeto_status",
      "projeto_forma_pagamento", "projeto_valor_entrada", "projeto_valor_financiado",
      "projeto_numero_parcelas", "projeto_valor_parcela",
      "projeto_prazo_estimado_dias", "projeto_prazo_vistoria_dias",
      "projeto_rua_instalacao", "projeto_numero_instalacao", "projeto_complemento_instalacao",
      "projeto_bairro_instalacao", "projeto_cidade_instalacao", "projeto_uf_instalacao",
      "projeto_cep_instalacao", "projeto_lat_instalacao", "projeto_lon_instalacao",
      "projeto_observacoes",
    ], "db_projeto", "resolveClienteComercial");

    // ── Comercial: Concessionária (detalhes) ──
    addToMap([
      "concessionaria_sigla", "concessionaria_estado", "concessionaria_tarifa_fio_b",
      "concessionaria_custo_disponibilidade_monofasico", "concessionaria_custo_disponibilidade_bifasico",
      "concessionaria_custo_disponibilidade_trifasico", "concessionaria_aliquota_icms",
      "concessionaria_percentual_isencao", "concessionaria_possui_isencao_scee",
    ], "snapshot", "resolveEntrada");

    // ── Comercial: Simulação ──
    addToMap([
      "simulacao_tipo_conta", "simulacao_co2_evitado_kg",
    ], "snapshot", "resolveClienteComercial");

    // ── Comercial: Comissão ──
    addToMap(["comissao_percentual"], "db_consultor", "resolveClienteComercial");

    // ── Tabelas (séries tabulares — snapshot/computed) ──
    addToMap([
      "tabela_consumo_mensal", "tabela_geracao_mensal", "tabela_economia_mensal",
      "tabela_equipamentos", "tabela_parcelas",
    ], "snapshot", "resolveSistemaSolar");

    // ── Séries (projeções anuais — snapshot/computed) ──
    addToMap([
      "s_economia_anual", "s_geracao_anual", "s_geracao_mensal",
      "s_investimento_anual", "s_fluxo_caixa_acumulado_anual",
      "s_tarifa_distribuidora_anual", "s_consumo_mensal", "s_creditos_mensal",
      "s_creditos_gerados", "s_creditos_alocados",
    ], "computed", "resolveFinanceiro");
    // UC-specific series
    addToMap([
      "s_creditos_alocados_uc1", "s_consumo_mensal_uc1", "s_creditos_mensal_uc1",
      "s_economia_anual_uc1", "s_fluxo_caixa_acumulado_anual_uc1",
      "s_geracao_anual_uc1", "s_investimento_anual_uc1", "s_tarifa_distribuidora_anual_uc1",
    ], "computed", "resolveFinanceiro");

    // ── Customizadas explícitas (não caem no prefixo vc_ genérico) ──
    addToMap([
      "vc_consumo", "vc_aumento", "vc_media_sonsumo_mensal", "vc_consumo_anual", "vc_economia_acumulada",
      "vc_s_consumo_mensal_media", "vc_s_consumo_mt_p", "vc_s_consumo_mt_fp",
      "vc_s_consumo_mt_p_e_fp", "vc_s_geracao_mensal_media",
      "vc_valor_entrada", "vc_valor_parcelas_4", "vc_valor_parcela_troca_medidor",
      "vc_saldo_solar_25_anos", "vc_saldo_renda_fixa_25_anos", "vc_saldo_poupanca_25_anos",
      "vc_roi_primeiro_mes", "vc_tarifa_solar", "vc_preco_watt",
      "vc_investimento_solar_rendimento", "vc_economia_conta_total_rs", "vc_economia_conta_total_pc",
      "vc_total_modulo", "vc_p_total_cc", "vc_string_box_cc",
      "vc_potencia_sistema", "vc_modulo_potencia", "vc_inversor_potencia_nominal", "vc_estrutura",
      "vc_garantiaservico", "vc_grafico_de_comparacao", "vc_valor_gerac_prevista",
      "vc_cartao_credito_taxa_1", "vc_cartao_credito_taxa_2", "vc_cartao_credito_taxa_3", "vc_cartao_credito_taxa_4",
      "vc_cal_icms_enel", "vc_valor_icms_enel", "vc_valor_icms_enel_fator_simultaneidade",
      "vc_incluir_seguro", "vc_calculo_seguro",
    ], "custom_vc", "proposal-generate (evaluateExpression)");

    // ── Tarifa / Distribuidora (frontend: resolveProposalVariables → tariff engine) ──
    addToMap([
      "tarifa_te_kwh", "tarifa_tusd_total_kwh", "tarifa_fio_b_real_kwh", "tarifa_fio_b_usado_kwh",
      "tarifa_precisao", "tarifa_precisao_motivo", "tarifa_origem",
      "tarifa_vigencia_inicio", "tarifa_vigencia_fim",
    ], "computed", "resolveProposalVariables (tariff engine)");

    // ── ANEEL Sync (frontend: resolveProposalVariables → ANEEL sync data) ──
    addToMap([
      "aneel_last_sync_at", "aneel_run_id", "aneel_snapshot_hash_curto",
    ], "computed", "resolveProposalVariables (ANEEL sync)");

    // ── GD (frontend: resolveProposalVariables → GD rules) ──
    addToMap([
      "gd_regra", "gd_ano_aplicado", "gd_fio_b_percent_cobrado", "gd_fio_b_percent_compensado",
    ], "computed", "resolveProposalVariables (GD rules)");

    // ── Cálculo (frontend: resolveProposalVariables → GD calculation engine) ──
    addToMap([
      "calc_consumo_mensal_kwh", "calc_custo_disponibilidade_kwh", "calc_consumo_compensavel_kwh",
      "calc_geracao_mensal_kwh", "calc_energia_compensada_kwh", "calc_valor_credito_kwh",
      "calc_economia_mensal_rs", "alerta_estimado_texto_pdf",
    ], "computed", "resolveProposalVariables (GD calc)");

    // resolvePagamento.ts — snapshot.pagamento_opcoes
    addToMap([
      "vc_cartao_credito_parcela_1", "vc_cartao_credito_parcela_2", "vc_cartao_credito_parcela_3", "vc_cartao_credito_parcela_4",
      "vc_parcela_1", "vc_parcela_2", "vc_parcela_3",
      "vc_taxa_1", "vc_taxa_2", "vc_taxa_3",
      "vc_entrada_1", "vc_entrada_2", "vc_entrada_3",
      "vc_prazo_1", "vc_prazo_2", "vc_prazo_3",
      "vc_financeira_nome",
    ], "snapshot", "resolvePagamento");

    const entries: CategoryAuditEntry[] = CATEGORY_ORDER.map((cat) => {
      const catVars = VARIABLES_CATALOG.filter((v) => v.category === cat);
      return {
        category: cat,
        label: CATEGORY_LABELS[cat],
        icon: CATEGORY_ICONS[cat],
        total: catVars.length,
        variables: catVars.map((v) => {
          const key = v.legacyKey.replace(/^\[|\]$/g, "");
          const mapping = RESOLVER_MAP[key];
          let source: VariableSource = mapping?.source ?? "unknown";
          let resolver = mapping?.resolver ?? "";
          // Custom variables
          if (key.startsWith("vc_") && !mapping) { source = "custom_vc"; resolver = "proposal-generate (evaluateExpression)"; }
          // Not implemented → unknown
          if (v.notImplemented) { source = "unknown"; resolver = ""; }
          return {
            key,
            canonicalKey: v.canonicalKey,
            label: v.label,
            description: v.description,
            unit: v.unit,
            example: v.example,
            hasSchemaMapping: allExpectedKeys.has(key),
            notImplemented: v.notImplemented,
            source,
            resolver,
          };
        }),
      };
    });

    return entries;
  }, []);

  // ── Resolver coverage stats (honest KPI) ────────────────
  const resolverCoverage = useMemo(() => {
    const totalCatalog = VARIABLES_CATALOG.length;
    const withResolver = categoryAudit.reduce((sum, cat) => {
      return sum + cat.variables.filter(v => !v.notImplemented && v.source !== "unknown").length;
    }, 0);
    const ghostCount = categoryAudit.reduce((sum, cat) => {
      return sum + cat.variables.filter(v => v.source === "unknown" && !v.notImplemented).length;
    }, 0);
    const pendingCount = categoryAudit.reduce((sum, cat) => {
      return sum + cat.variables.filter(v => v.notImplemented).length;
    }, 0);
    return {
      totalCatalog,
      withResolver,
      ghostCount,
      pendingCount,
      coveragePct: totalCatalog > 0 ? Math.round((withResolver / totalCatalog) * 100) : 0,
    };
  }, [categoryAudit]);

  return {
    customAudit,
    schemaAudit,
    descriptionAudit,
    ghostVariables,
    totalCustomDivergences,
    categoryAudit,
    resolverCoverage,
    SORTED_TABLES,
    FLOW_GROUPS,
  };
}
