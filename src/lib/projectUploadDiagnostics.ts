/**
 * Diagnóstico temporário para uploads de documentos no projeto.
 * Não altera comportamento — apenas observabilidade.
 *
 * Uso: chamar logUploadDiagnostics(payload) dentro do catch do upload.
 */
import { supabase } from "@/integrations/supabase/client";

export interface UploadDiagnosticsPayload {
  section: "Campos importantes" | "Outros campos";
  bucket: string;
  path: string | null;
  tenant_id: string | null;
  field_id?: string | null;
  field_key?: string | null;
  field_type?: string | null;
  deal_id?: string | null;
  cliente_id?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  file_mime?: string | null;
  error: unknown;
}

function extractStorageError(err: any) {
  if (!err || typeof err !== "object") return { message: String(err) };
  return {
    message: err.message ?? null,
    name: err.name ?? null,
    status: err.status ?? err.statusCode ?? null,
    error: err.error ?? null,
    stack: err.stack ?? null,
  };
}

export async function logUploadDiagnostics(payload: UploadDiagnosticsPayload) {
  try {
    const { data: userData } = await supabase.auth.getUser();
    const user_id = userData?.user?.id ?? null;

    let roles: string[] = [];
    if (user_id) {
      const { data: rolesData, error: rolesErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user_id);
      if (!rolesErr && rolesData) roles = rolesData.map((r: any) => r.role);
    }

    const errorInfo = extractStorageError(payload.error);

    /* eslint-disable no-console */
    console.groupCollapsed(
      `%c[ProjectUploadDiagnostics] ${payload.section} — upload FAIL`,
      "color:#fff;background:#b91c1c;padding:2px 6px;border-radius:3px;"
    );
    console.log("section:", payload.section);
    console.log("bucket:", payload.bucket);
    console.log("path:", payload.path);
    console.log("tenant_id:", payload.tenant_id);
    console.log("user_id:", user_id);
    console.log("roles:", roles);
    console.log("field:", {
      id: payload.field_id ?? null,
      key: payload.field_key ?? null,
      type: payload.field_type ?? null,
    });
    console.log("entity:", {
      deal_id: payload.deal_id ?? null,
      cliente_id: payload.cliente_id ?? null,
    });
    console.log("file:", {
      name: payload.file_name ?? null,
      size: payload.file_size ?? null,
      mime: payload.file_mime ?? null,
    });
    console.log("storage_error:", errorInfo);
    console.groupEnd();
    /* eslint-enable no-console */

    return { user_id, roles, errorInfo };
  } catch (diagErr) {
    // não pode quebrar o fluxo
    // eslint-disable-next-line no-console
    console.warn("[ProjectUploadDiagnostics] failed to collect diagnostics:", diagErr);
    return null;
  }
}
