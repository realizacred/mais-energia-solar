/**
 * useLazyTemplateAssign — On-demand template assignment for migrated SM proposals.
 *
 * When a migrated proposal (template_id_used IS NULL) is opened,
 * this hook assigns a default WEB template to the version and proposal,
 * enabling proper rendering via the unified semantic block pipeline.
 *
 * §16: Query in hook. §23: staleTime mandatory.
 * Rules: no background batch, no interruption to migration, on-demand only.
 */

import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_TEMPLATE_ID = "e4434ef7-7943-4be6-82e6-85ddbc484563"; // "Premium Consultivo" (html)

interface LazyAssignResult {
  success: boolean;
  templateId: string | null;
  error?: string;
}

/**
 * Returns a function `assignIfNeeded(versaoId, propostaId)` that:
 * 1. Checks if versao already has template_id_used
 * 2. If NULL → assigns default template to both versao and proposta
 * 3. Returns the assigned template ID
 *
 * Idempotent: multiple calls for same versaoId are no-ops after first assignment.
 */
export function useLazyTemplateAssign() {
  const [assigning, setAssigning] = useState(false);
  const assignedCache = useRef(new Set<string>());

  const assignIfNeeded = useCallback(
    async (
      versaoId: string | null | undefined,
      propostaId: string | null | undefined
    ): Promise<LazyAssignResult> => {
      if (!versaoId) return { success: false, templateId: null, error: "No versaoId" };

      // Already assigned in this session — skip
      if (assignedCache.current.has(versaoId)) {
        return { success: true, templateId: DEFAULT_TEMPLATE_ID };
      }

      try {
        setAssigning(true);

        // 1. Check current state
        const { data: versao, error: fetchErr } = await supabase
          .from("proposta_versoes")
          .select("template_id_used, snapshot")
          .eq("id", versaoId)
          .single();

        if (fetchErr) return { success: false, templateId: null, error: fetchErr.message };

        // Already has template — no-op
        if (versao.template_id_used) {
          assignedCache.current.add(versaoId);
          return { success: true, templateId: versao.template_id_used };
        }

        // 2. Validate snapshot exists (don't assign template to empty version)
        const snap = versao.snapshot;
        if (!snap || (typeof snap === "object" && Object.keys(snap as object).length === 0)) {
          return { success: false, templateId: null, error: "Snapshot vazio — não é possível atribuir template" };
        }

        // 3. Verify default template exists
        const { data: tmpl, error: tmplErr } = await supabase
          .from("proposta_templates")
          .select("id")
          .eq("id", DEFAULT_TEMPLATE_ID)
          .eq("ativo", true)
          .maybeSingle();

        if (tmplErr || !tmpl) {
          return { success: false, templateId: null, error: "Template padrão não encontrado" };
        }

        // 4. Update version
        const { error: verUpd } = await supabase
          .from("proposta_versoes")
          .update({ template_id_used: DEFAULT_TEMPLATE_ID } as any)
          .eq("id", versaoId);

        if (verUpd) {
          return { success: false, templateId: null, error: verUpd.message };
        }

        // 5. Update proposal (if provided)
        if (propostaId) {
          await supabase
            .from("propostas_nativas")
            .update({ template_id: DEFAULT_TEMPLATE_ID } as any)
            .eq("id", propostaId)
            .then(({ error }) => {
              if (error) console.error("[useLazyTemplateAssign] proposta update error:", error.message);
            });
        }

        assignedCache.current.add(versaoId);
        return { success: true, templateId: DEFAULT_TEMPLATE_ID };
      } catch (err: any) {
        return { success: false, templateId: null, error: err.message || "Erro desconhecido" };
      } finally {
        setAssigning(false);
      }
    },
    []
  );

  return { assignIfNeeded, assigning };
}
