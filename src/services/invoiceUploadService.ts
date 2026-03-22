/**
 * Invoice upload helpers — avoid sending large PDFs as base64 to Edge Functions.
 */
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

function sanitizeFileName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

export async function uploadInvoiceTempPdf(file: File): Promise<string> {
  const { tenantId } = await getCurrentTenantId();
  const safeName = sanitizeFileName(file.name || "fatura.pdf");
  const path = `${tenantId}/imports/${Date.now()}-${crypto.randomUUID()}-${safeName}`;

  const { error } = await supabase.storage.from("faturas-energia").upload(path, file, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (error) throw error;
  return path;
}
