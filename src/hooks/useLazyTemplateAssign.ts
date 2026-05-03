/**
 * useLazyTemplateAssign — DEPRECATED após auditoria CRÍTICA de templates.
 *
 * Antes atribuía um DEFAULT_TEMPLATE_ID hardcoded a versões de propostas
 * migradas que estavam sem template_id_used. Isso quebrava o critério de
 * verdade "template ativo no editor = template usado em /pl/:slug".
 *
 * Agora é um no-op: nenhuma atribuição automática é feita.
 * O template_id_used só pode ser definido explicitamente via Wizard.
 *
 * Mantido como shim para não quebrar consumidores existentes.
 */

import { useCallback, useState } from "react";

interface LazyAssignResult {
  success: boolean;
  templateId: string | null;
  error?: string;
}

export function useLazyTemplateAssign() {
  const [assigning] = useState(false);

  const assignIfNeeded = useCallback(
    async (
      _versaoId: string | null | undefined,
      _propostaId: string | null | undefined
    ): Promise<LazyAssignResult> => {
      // No-op: atribuição automática desativada.
      // Editor é a única fonte de verdade para template_id_used.
      return {
        success: false,
        templateId: null,
        error: "Atribuição automática de template desativada. Selecione um modelo no editor.",
      };
    },
    []
  );

  return { assignIfNeeded, assigning };
}
