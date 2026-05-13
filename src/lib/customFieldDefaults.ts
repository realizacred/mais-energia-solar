/**
 * customFieldDefaults — SSOT para valores padrão por tipo de campo customizado.
 *
 * Regras (alinhadas a deal_custom_fields.field_type):
 *  - percent / number / currency / monetary → 0
 *  - text / textarea / select               → ""
 *  - multi_select / multiselect / file      → []
 *  - boolean                                → false
 *  - date                                   → null
 *  - desconhecido                           → null
 *
 * Use sempre em conjunto com `seedCustomFieldDefaults` para inicializar campos
 * configurados sem sobrescrever valores já salvos (preserva inclusive 0/false/"").
 */

export type CustomFieldType =
  | "text" | "textarea"
  | "number" | "currency" | "monetary" | "percent"
  | "boolean"
  | "date"
  | "select" | "multi_select" | "multiselect"
  | "file"
  | string;

export function getDefaultCustomFieldValue(fieldType: CustomFieldType): any {
  switch (fieldType) {
    case "percent":
    case "number":
    case "currency":
    case "monetary":
      return 0;
    case "boolean":
      return false;
    case "date":
      return null;
    case "multi_select":
    case "multiselect":
    case "file":
      return [];
    case "select":
    case "text":
    case "textarea":
    default:
      return "";
  }
}

/**
 * Aplica defaults APENAS em campos configurados que estão `undefined`.
 * Preserva qualquer valor já existente (incluindo 0, false, "", []).
 *
 * @returns objeto com defaults aplicados ou o próprio `current` se nada mudou.
 */
export function seedCustomFieldDefaults(
  fields: Array<{ field_key: string; field_type: CustomFieldType }>,
  current: Record<string, any>,
): Record<string, any> {
  let changed = false;
  const next = { ...current };
  for (const f of fields) {
    if (next[f.field_key] === undefined) {
      next[f.field_key] = getDefaultCustomFieldValue(f.field_type);
      changed = true;
    }
  }
  return changed ? next : current;
}
