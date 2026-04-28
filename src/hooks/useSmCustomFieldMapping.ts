/**
 * useSmCustomFieldMapping — Mapeamento de custom fields SolarMarket → CRM.
 *
 * Permite ao admin escolher, para cada campo do SM (sm_custom_fields_raw),
 * uma de quatro ações:
 *  - 'map'         → vincular a um deal_custom_field existente (crm_field_id)
 *  - 'create'      → criar um novo deal_custom_field com o nome informado
 *  - 'map_native'  → gravar diretamente em um path nativo da proposta
 *                    (snapshot.tipo_telhado, snapshot.garantias.modulo_sm,
 *                     snapshot.garantias.inversor_sm, snapshot.garantias.microinversor_sm)
 *  - 'ignore'      → não migrar
 *
 * §16 (queries só em hooks) / §23 (staleTime obrigatório). RB-04 / RB-69.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CfAction = "map" | "create_new" | "map_native" | "ignore";

export const NATIVE_TARGETS = [
  { value: "snapshot.tipo_telhado", label: "Dimensionamento → Tipo de Telhado" },
  { value: "snapshot.garantias.modulo_sm", label: "Garantias → Garantia Módulo (SM)" },
  { value: "snapshot.garantias.inversor_sm", label: "Garantias → Garantia Inversor (SM)" },
  { value: "snapshot.garantias.microinversor_sm", label: "Garantias → Garantia Microinversor (SM)" },
] as const;

export interface SmField {
  external_id: string;
  key: string;
  label: string | null;
  type: string | null;
  topic: string | null;
}

export interface CfMappingRow {
  sm_field_key: string;
  sm_field_label: string | null;
  sm_field_type: string | null;
  sm_topic: string | null;
  action: CfAction;
  crm_field_id: string | null;
  crm_field_name_input: string | null;
  crm_field_context: string | null;
  crm_field_type: string | null;
  crm_native_target: string | null;
}

const QK_SM_FIELDS = (tenantId: string | null) => ["sm-fields-raw", tenantId] as const;
const QK_CF_MAPPING = (tenantId: string | null) => ["sm-cf-mapping", tenantId] as const;
const STALE = 1000 * 60 * 5;

const CONTEXT_PREFIX: Record<string, "cap" | "pre" | "pos"> = {
  projeto: "cap",
  pre_dimensionamento: "pre",
  pos_dimensionamento: "pos",
};

function normalizeSmFieldKey(raw: unknown): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return String(value ?? "").trim().replace(/^\[(.*)\]$/, "$1").trim();
}

function normalizeFieldBase(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^(cap|cape|capo|pre|pos)_/, "");
}

function buildFieldKey(context: string | null | undefined, name: string | null | undefined, smKey: string): string {
  const prefix = CONTEXT_PREFIX[context ?? ""] ?? "cap";
  const base = normalizeFieldBase(name?.trim() || smKey) || normalizeFieldBase(smKey) || "campo_sm";
  return `${prefix}_${base}`;
}

/** Lista campos do staging SolarMarket (sm_custom_fields_raw). */
export function useSmCustomFieldsStaging(tenantId: string | null) {
  return useQuery<SmField[]>({
    queryKey: QK_SM_FIELDS(tenantId),
    enabled: !!tenantId,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sm_custom_fields_raw")
        .select("external_id, payload")
        .eq("tenant_id", tenantId)
        .order("external_id");
      if (error) throw error;
      const seen = new Set<string>();
      const out: SmField[] = [];
      for (const row of (data ?? [])) {
        const p = row.payload ?? {};
        // payload.key pode vir como array (["capo_i"]) ou string "[capo_i]".
        const key = normalizeSmFieldKey(p.key);
        if (!key || seen.has(key)) continue;
        seen.add(key);
        out.push({
          external_id: String(row.external_id),
          key,
          label: p.label ?? null,
          type: p.type ?? null,
          topic: p.topic ?? null,
        });
      }
      return out;
    },
  });
}

/** Mapeamentos atuais (sm_custom_field_mapping) por sm_field_key. */
export function useCustomFieldMappings(tenantId: string | null) {
  return useQuery<Record<string, CfMappingRow>>({
    queryKey: QK_CF_MAPPING(tenantId),
    enabled: !!tenantId,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sm_custom_field_mapping")
        .select(
          "sm_field_key, sm_field_label, sm_field_type, sm_topic, action, crm_field_id, crm_field_name_input, crm_field_context, crm_field_type, crm_native_target",
        )
        .eq("tenant_id", tenantId);
      if (error) throw error;
      const out: Record<string, CfMappingRow> = {};
      for (const row of (data ?? [])) out[normalizeSmFieldKey(row.sm_field_key)] = row as CfMappingRow;
      return out;
    },
  });
}

export interface SaveCfMappingInput {
  tenantId: string;
  smField: SmField;
  action: CfAction;
  crm_field_id?: string | null;
  crm_field_name_input?: string | null;
  crm_field_context?: string | null;
  crm_field_type?: string | null;
  crm_native_target?: string | null;
}

/** Upsert de mapeamento (chave: tenant_id + sm_field_key). */
export function useSaveCustomFieldMapping() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SaveCfMappingInput) => {
      const smFieldKey = normalizeSmFieldKey(input.smField.key);
      const payload: Record<string, any> = {
        tenant_id: input.tenantId,
        sm_field_key: smFieldKey,
        sm_field_label: input.smField.label,
        sm_field_type: input.smField.type,
        sm_topic: input.smField.topic,
        action: input.action,
        crm_field_id: input.action === "map" ? input.crm_field_id ?? null : null,
        crm_field_name_input:
          input.action === "create_new" ? input.crm_field_name_input ?? null : null,
        crm_field_context:
          input.action === "create_new" ? input.crm_field_context ?? null : null,
        crm_field_type:
          input.action === "create_new" ? input.crm_field_type ?? null : null,
        crm_native_target:
          input.action === "map_native" ? input.crm_native_target ?? null : null,
      };
      const { error } = await (supabase as any)
        .from("sm_custom_field_mapping")
        .upsert(payload, { onConflict: "tenant_id,sm_field_key" });
      if (error) throw error;

      if (input.action !== "create_new") return;

      const fieldKey = buildFieldKey(
        input.crm_field_context,
        input.crm_field_name_input,
        smFieldKey,
      );
      const { data: existingField, error: existingError } = await (supabase as any)
        .from("deal_custom_fields")
        .select("id")
        .eq("tenant_id", input.tenantId)
        .eq("field_key", fieldKey)
        .maybeSingle();
      if (existingError) throw existingError;

      const fieldId = existingField?.id ?? (await (async () => {
        const { data: createdField, error: createError } = await (supabase as any)
          .from("deal_custom_fields")
          .insert({
            tenant_id: input.tenantId,
            title: input.crm_field_name_input?.trim() || smFieldKey,
            field_key: fieldKey,
            field_type: input.crm_field_type ?? "text",
            field_context: input.crm_field_context ?? "projeto",
            options: [],
            ordem: 999,
            is_active: true,
          })
          .select("id")
          .single();
        if (createError) throw createError;
        return createdField.id;
      })());

      const { error: linkError } = await (supabase as any)
        .from("sm_custom_field_mapping")
        .update({ crm_field_id: fieldId })
        .eq("tenant_id", input.tenantId)
        .eq("sm_field_key", smFieldKey);
      if (linkError) throw linkError;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: QK_CF_MAPPING(vars.tenantId) });
      qc.invalidateQueries({ queryKey: ["deal-custom-fields"] });
      qc.invalidateQueries({ queryKey: ["deal-custom-fields-active"] });
    },
  });
}
