/**
 * Hook for Variables Catalog audit — §16 compliant.
 * Centralizes all audit logic: schema coverage, custom vars sync, description quality.
 */
import { useMemo } from "react";
import { VARIABLES_CATALOG, type VariableCategory } from "@/lib/variablesCatalog";

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
  "template_id", "versao_atual", "versao_numero",
  "pipeline_id", "stage_id", "customer_id", "owner_id", "doc_checklist",
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
    name: "deals", label: "Deals (Kanban)", icon: "🎯", flowOrder: 2,
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
    name: "projetos", label: "Projetos", icon: "📁", flowOrder: 3,
    columns: [
      { column: "codigo", label: "Código do Projeto", expectedKey: "proposta_identificador" },
      { column: "projeto_num", label: "Nº Sequencial do Projeto" },
      { column: "potencia_kwp", label: "Potência kWp", expectedKey: "potencia_sistema" },
      { column: "numero_modulos", label: "Nº Módulos", expectedKey: "modulo_quantidade" },
      { column: "modelo_modulos", label: "Modelo Módulos", expectedKey: "modulo_modelo" },
      { column: "modelo_inversor", label: "Modelo Inversor", expectedKey: "inversor_modelo" },
      { column: "numero_inversores", label: "Nº Inversores", expectedKey: "inversores_utilizados" },
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
      { column: "rua_instalacao", label: "Rua Instalação" },
      { column: "numero_instalacao", label: "Número Instalação" },
      { column: "complemento_instalacao", label: "Complemento Instalação" },
      { column: "bairro_instalacao", label: "Bairro Instalação" },
      { column: "cidade_instalacao", label: "Cidade Instalação" },
      { column: "uf_instalacao", label: "UF Instalação" },
      { column: "cep_instalacao", label: "CEP Instalação" },
      { column: "lat_instalacao", label: "Latitude Instalação" },
      { column: "lon_instalacao", label: "Longitude Instalação" },
      { column: "observacoes", label: "Observações" },
    ],
  },
  {
    name: "propostas_nativas", label: "Propostas", icon: "📄", flowOrder: 4,
    columns: [
      { column: "titulo", label: "Título da Proposta", expectedKey: "proposta_titulo" },
      { column: "codigo", label: "Código da Proposta", expectedKey: "proposta_identificador" },
      { column: "proposta_num", label: "Número da Proposta" },
      { column: "status", label: "Status da Proposta" },
      { column: "validade_dias", label: "Validade (dias)", expectedKey: "proposta_validade" },
      { column: "aceita_at", label: "Data de Aceite" },
      { column: "enviada_at", label: "Data de Envio" },
      { column: "recusa_motivo", label: "Motivo de Recusa" },
      { column: "recusada_at", label: "Data de Recusa" },
      { column: "regra_gd", label: "Regra GD Aplicada" },
      { column: "origem_tarifa", label: "Origem da Tarifa" },
      { column: "precisao_calculo", label: "Precisão do Cálculo" },
      { column: "precisao_motivo", label: "Motivo da Precisão" },
      { column: "versao_atual", label: "Versão Atual" },
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
      { column: "inflacao_energetica", label: "Inflação Energética (%)" },
      { column: "perda_eficiencia_anual", label: "Perda de Eficiência Anual (%)" },
      { column: "sobredimensionamento", label: "Sobredimensionamento (%)" },
      { column: "validade_dias", label: "Validade (dias)", expectedKey: "proposta_validade" },
      { column: "valido_ate", label: "Válido Até" },
      { column: "gerado_em", label: "Gerado Em", expectedKey: "proposta_data" },
      { column: "enviado_em", label: "Enviado Em" },
      { column: "aceito_em", label: "Aceito Em" },
      { column: "rejeitado_em", label: "Rejeitado Em" },
      { column: "motivo_rejeicao", label: "Motivo Rejeição" },
      { column: "link_pdf", label: "Link do PDF" },
      { column: "public_slug", label: "Link Público (Slug)" },
      { column: "output_docx_path", label: "Arquivo DOCX" },
      { column: "output_pdf_path", label: "Arquivo PDF" },
      { column: "viewed_at", label: "Visualizado Em" },
      { column: "observacoes", label: "Observações" },
      { column: "status", label: "Status da Versão" },
    ],
  },
  {
    name: "simulacoes", label: "Simulações", icon: "🧮", flowOrder: 6,
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
    name: "consultores", label: "Consultores", icon: "👔", flowOrder: 7,
    columns: [
      { column: "nome", label: "Nome", expectedKey: "responsavel_nome" },
      { column: "telefone", label: "Telefone", expectedKey: "consultor_telefone" },
      { column: "email", label: "Email", expectedKey: "consultor_email" },
      { column: "codigo", label: "Código" },
      { column: "percentual_comissao", label: "% Comissão", expectedKey: "comissao_percentual" },
    ],
  },
  {
    name: "concessionarias", label: "Concessionárias", icon: "⚡", flowOrder: 8,
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

  return {
    customAudit,
    schemaAudit,
    descriptionAudit,
    ghostVariables,
    totalCustomDivergences,
    SORTED_TABLES,
    FLOW_GROUPS,
  };
}
