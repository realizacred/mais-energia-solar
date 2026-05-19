
import { supabase } from "@/integrations/supabase/client";
import { normalizeProposalSnapshot, type NormalizedProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";

export type PublicProposalMode = "web" | "pdf" | "pending" | "error";

export interface PublicProposalResolution {
  mode: PublicProposalMode;
  propostaId?: string;
  versaoId?: string;
  tokenData?: any;
  snapshot?: NormalizedProposalSnapshot;
  templateType?: "html" | "docx";
  pdfPath?: string;
  webTemplateHtml?: any;
  error?: string;
  statusComercial?: string;
}

/**
 * Resolve o estado de uma proposta pública a partir de um token.
 * SSOT para PropostaLanding e outras áreas públicas.
 */
export async function resolvePublicProposal(token: string): Promise<PublicProposalResolution> {
  try {
    // 1. Resolve token
    const { data: tdRows, error: tdErr } = await (supabase as any)
      .rpc("get_proposta_token_by_value", { p_token: token });
    
    const td = Array.isArray(tdRows) ? tdRows[0] : tdRows;

    if (tdErr || !td) {
      return { mode: "error", error: "Proposta não encontrada ou link inválido." };
    }

    if (td.invalidado_em) {
      return { mode: "error", error: "Esta versão da proposta foi invalidada por uma mais recente." };
    }

    if (new Date(td.expires_at) < new Date()) {
      return { mode: "error", error: "Esta proposta expirou." };
    }

    // 2. Busca dados da versão e proposta
    const [versaoRes, propostaRes] = await Promise.all([
      supabase.from("proposta_versoes")
        .select("id, snapshot, output_pdf_path, template_id_used, link_pdf, status")
        .eq("id", td.versao_id)
        .single(),
      supabase.from("propostas_nativas")
        .select("id, status, tenant_id")
        .eq("id", td.proposta_id)
        .maybeSingle()
    ]);

    if (versaoRes.error || !versaoRes.data) {
      return { mode: "error", error: "Dados da proposta não encontrados." };
    }

    const versao = versaoRes.data;
    const rawSnapshot = versao.snapshot as Record<string, any> | null;
    const normalizedSnapshot = normalizeProposalSnapshot(rawSnapshot);

    // 3. Determina o tipo de template
    const { data: templateRes } = await supabase
      .from("proposta_templates")
      .select("tipo, template_html")
      .eq("id", versao.template_id_used)
      .maybeSingle();

    const templateType = templateRes?.tipo === "html" ? "html" : "docx";

    // 4. Lógica de Decisão de Modo
    
    // Se for HTML, tentamos modo WEB
    if (templateType === "html") {
      let webTemplateHtml = rawSnapshot?.web_template_snapshot;
      
      // Se não tem no snapshot, tenta o HTML vivo do template (fallback)
      if (!webTemplateHtml && templateRes?.template_html) {
        webTemplateHtml = templateRes.template_html;
      }

      if (webTemplateHtml) {
        return {
          mode: "web",
          propostaId: td.proposta_id,
          versaoId: td.versao_id,
          tokenData: td,
          snapshot: normalizedSnapshot,
          templateType: "html",
          webTemplateHtml,
          pdfPath: versao.output_pdf_path,
          statusComercial: propostaRes.data?.status
        };
      }
    }

    // Se for DOCX ou se o HTML falhou, tentamos modo PDF
    if (versao.output_pdf_path || versao.link_pdf) {
      return {
        mode: "pdf",
        propostaId: td.proposta_id,
        versaoId: td.versao_id,
        tokenData: td,
        snapshot: normalizedSnapshot,
        templateType: "docx",
        pdfPath: versao.output_pdf_path || versao.link_pdf,
        statusComercial: propostaRes.data?.status
      };
    }

    // Se não tem PDF ainda, mas a versão existe, está pendente
    return {
      mode: "pending",
      propostaId: td.proposta_id,
      versaoId: td.versao_id,
      tokenData: td,
      templateType
    };

  } catch (err) {
    console.error("[publicProposalResolver] Unexpected error:", err);
    return { mode: "error", error: "Erro interno ao carregar proposta." };
  }
}
