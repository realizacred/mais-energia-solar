/**
 * Signature Adapters — Multi-provider pattern for electronic signatures.
 * DA-27: Adapter pattern — ZapSign + Clicksign + Autentique
 * DA-28: Clicksign requires 3 API calls (upload, signer, list+notify)
 * RB-23: No console.log — only console.error with prefix
 */

// ─── Interface ────────────────────────────────────────

export interface SignatureSettingsExtra {
  signer_mode?: "simplified" | "complete";
  refusable?: boolean;
  reminder?: null | "DAILY" | "WEEKLY";
  deadline_days?: number | null;
}

export interface SignatureEnvelopeParams {
  pdfUrl: string;
  docName: string;
  signers: Array<{
    name: string;
    email: string;
    cpf?: string;
    phone?: string;
    auth_method?: string;
    /** Role identifier — used by some providers to differentiate Contratante vs Contratada */
    role?: string;
  }>;
  sandbox: boolean;
  apiToken: string;
  /** Provider-specific extra settings (e.g. Autentique reminder/deadline) */
  settingsExtra?: SignatureSettingsExtra;
}

export interface SignatureEnvelopeResult {
  envelopeId: string;
  signUrl?: string;
  /** Per-signer short links (Autentique returns these) */
  signerLinks?: Array<{ name: string; email?: string; shortLink?: string; providerSignerId?: string }>;
}

export interface WebhookParseResult {
  docToken: string | null;
  status: string | null;
}

export interface SignatureAdapter {
  readonly providerId: string;
  createEnvelope(params: SignatureEnvelopeParams): Promise<SignatureEnvelopeResult>;
}

// ─── Shared timeout fetch ─────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 30000): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// ─── ZapSign Adapter ──────────────────────────────────

const ZAPSIGN_API_URL = "https://api.zapsign.com.br/api/v1";

export class ZapSignAdapter implements SignatureAdapter {
  readonly providerId = "zapsign";

  async createEnvelope(params: SignatureEnvelopeParams): Promise<SignatureEnvelopeResult> {
    const body = {
      sandbox: params.sandbox,
      name: params.docName,
      url_pdf: params.pdfUrl,
      signers: params.signers.map(s => ({
        name: s.name,
        email: s.email,
        phone_country: "55",
        phone_number: s.phone?.replace(/\D/g, "") || undefined,
        auth_mode: s.auth_method || "assinaturaTela",
        send_automatic_email: true,
      })),
    };

    let response: Response;
    try {
      response = await fetchWithTimeout(`${ZAPSIGN_API_URL}/docs/`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${params.apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (err: any) {
      console.error("[ZapSignAdapter] API fetch error:", err.message);
      throw new Error("Falha na comunicação com ZapSign. Tente novamente.");
    }

    const data = await response.json();

    if (!response.ok) {
      console.error("[ZapSignAdapter] API error:", response.status, JSON.stringify(data));
      if (response.status === 401 || response.status === 403) {
        throw new Error("Token ZapSign inválido ou expirado. Verifique nas configurações.");
      }
      throw new Error(`Erro ZapSign (${response.status}): ${data?.detail || data?.message || JSON.stringify(data)}`);
    }

    return {
      envelopeId: data.token || data.open_id,
      signUrl: data.signers?.[0]?.sign_url || undefined,
    };
  }
}

// ─── ZapSign Webhook Parser ───────────────────────────

export function parseZapSignWebhook(body: Record<string, any>): WebhookParseResult {
  const docToken = body?.doc?.token || body?.token;
  const eventStatus = body?.doc?.status || body?.status;
  return { docToken, status: eventStatus };
}

export function mapZapSignStatus(status: string): { signatureStatus: string; docStatus: string; isSigned: boolean } | null {
  switch (status) {
    case "signed":
    case "completed":
      return { signatureStatus: "signed", docStatus: "signed", isSigned: true };
    case "refused":
    case "rejected":
      return { signatureStatus: "refused", docStatus: "cancelled", isSigned: false };
    case "link_opened":
    case "opened":
      return { signatureStatus: "viewed", docStatus: "sent_for_signature", isSigned: false };
    case "cancelled":
      return { signatureStatus: "cancelled", docStatus: "cancelled", isSigned: false };
    default:
      return null;
  }
}

// ─── Clicksign Adapter ────────────────────────────────

function clicksignBaseUrl(sandbox: boolean): string {
  return sandbox ? "https://sandbox.clicksign.com" : "https://app.clicksign.com";
}

export class ClickSignAdapter implements SignatureAdapter {
  readonly providerId = "clicksign";

  async createEnvelope(params: SignatureEnvelopeParams): Promise<SignatureEnvelopeResult> {
    const baseUrl = clicksignBaseUrl(params.sandbox);
    const tokenParam = `access_token=${params.apiToken}`;

    // Step 1: Download PDF and convert to base64 (avoids expired signed URLs)
    let pdfBase64: string;
    try {
      const pdfResponse = await fetchWithTimeout(params.pdfUrl, {}, 60000);
      if (!pdfResponse.ok) {
        throw new Error(`HTTP ${pdfResponse.status}`);
      }
      const pdfBuffer = new Uint8Array(await pdfResponse.arrayBuffer());
      // Deno-compatible base64 encoding
      let binary = "";
      for (let i = 0; i < pdfBuffer.length; i++) {
        binary += String.fromCharCode(pdfBuffer[i]);
      }
      pdfBase64 = btoa(binary);
    } catch (err: any) {
      console.error("[ClickSignAdapter] PDF download error:", err.message);
      throw new Error("Falha ao baixar o PDF para envio à Clicksign.");
    }

    const docBody = {
      document: {
        path: `/${params.docName.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`,
        content_base64: `data:application/pdf;base64,${pdfBase64}`,
      },
    };

    let docResponse: Response;
    try {
      docResponse = await fetchWithTimeout(`${baseUrl}/api/v2/documents?${tokenParam}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(docBody),
      });
    } catch (err: any) {
      console.error("[ClickSignAdapter] Document upload error:", err.message);
      throw new Error("Falha na comunicação com Clicksign. Tente novamente.");
    }

    const docData = await docResponse.json();

    if (!docResponse.ok) {
      console.error("[ClickSignAdapter] Document API error:", docResponse.status, JSON.stringify(docData));
      if (docResponse.status === 401 || docResponse.status === 403) {
        throw new Error("Token Clicksign inválido ou expirado. Verifique nas configurações.");
      }
      throw new Error(`Erro Clicksign (${docResponse.status}): ${docData?.errors || JSON.stringify(docData)}`);
    }

    const documentKey = docData?.document?.key;
    if (!documentKey) {
      console.error("[ClickSignAdapter] No document key in response:", JSON.stringify(docData));
      throw new Error("Clicksign não retornou a chave do documento.");
    }

    // Step 2 & 3: Create signers and link them
    let firstSignUrl: string | undefined;

    for (const signer of params.signers) {
      // Create signer
      const signerBody = {
        signer: {
          name: signer.name,
          email: signer.email,
          phone_number: signer.phone?.replace(/\D/g, "") || undefined,
          documentation: signer.cpf?.replace(/\D/g, "") || undefined,
          has_documentation: !!signer.cpf,
          selfie_enabled: false,
          handwritten_enabled: false,
          official_document_enabled: false,
          liveness_enabled: false,
          facial_biometrics_enabled: false,
        },
      };

      let signerResponse: Response;
      try {
        signerResponse = await fetchWithTimeout(`${baseUrl}/api/v2/signers?${tokenParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(signerBody),
        });
      } catch (err: any) {
        console.error("[ClickSignAdapter] Signer creation error:", err.message);
        throw new Error(`Falha ao criar signatário ${signer.name} na Clicksign.`);
      }

      const signerData = await signerResponse.json();
      if (!signerResponse.ok) {
        console.error("[ClickSignAdapter] Signer API error:", signerResponse.status, JSON.stringify(signerData));
        throw new Error(`Erro ao criar signatário ${signer.name}: ${signerData?.errors || JSON.stringify(signerData)}`);
      }

      const signerKey = signerData?.signer?.key;
      if (!signerKey) {
        throw new Error(`Clicksign não retornou a chave do signatário ${signer.name}.`);
      }

      // Link signer to document (create list)
      const listBody = {
        list: {
          document_key: documentKey,
          signer_key: signerKey,
          sign_as: "sign",
          message: `Por favor, assine o documento: ${params.docName}`,
        },
      };

      let listResponse: Response;
      try {
        listResponse = await fetchWithTimeout(`${baseUrl}/api/v2/lists?${tokenParam}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(listBody),
        });
      } catch (err: any) {
        console.error("[ClickSignAdapter] List creation error:", err.message);
        throw new Error(`Falha ao vincular signatário ${signer.name} ao documento.`);
      }

      const listData = await listResponse.json();
      if (!listResponse.ok) {
        console.error("[ClickSignAdapter] List API error:", listResponse.status, JSON.stringify(listData));
        throw new Error(`Erro ao vincular signatário: ${listData?.errors || JSON.stringify(listData)}`);
      }

      const listKey = listData?.list?.key;

      // Notify signer (send email)
      if (listKey) {
        try {
          const notifyResponse = await fetchWithTimeout(`${baseUrl}/api/v2/notifications?${tokenParam}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notification: { list_key: listKey, message: `Assine o documento: ${params.docName}` } }),
          });
          if (!notifyResponse.ok) {
            console.error("[ClickSignAdapter] Notification warning:", notifyResponse.status);
            // Non-fatal: signer can still access via URL
          }
        } catch (err: any) {
          console.error("[ClickSignAdapter] Notification error (non-fatal):", err.message);
        }
      }

      // Capture first sign URL
      if (!firstSignUrl && listData?.list?.url) {
        firstSignUrl = listData.list.url;
      }
    }

    return {
      envelopeId: documentKey,
      signUrl: firstSignUrl,
    };
  }
}

// ─── Clicksign Webhook Parser ─────────────────────────

export function parseClickSignWebhook(body: Record<string, any>): WebhookParseResult {
  const docToken = body?.document?.key || null;
  const eventName = body?.event?.name || null;
  return { docToken, status: eventName };
}

export function mapClickSignStatus(eventName: string): { signatureStatus: string; docStatus: string; isSigned: boolean } | null {
  switch (eventName) {
    case "document_signed":
    case "auto_close":
      return { signatureStatus: "signed", docStatus: "signed", isSigned: true };
    case "document_refused":
      return { signatureStatus: "refused", docStatus: "cancelled", isSigned: false };
    case "signer_link_opened":
      return { signatureStatus: "viewed", docStatus: "sent_for_signature", isSigned: false };
    case "document_cancelled":
      return { signatureStatus: "cancelled", docStatus: "cancelled", isSigned: false };
    default:
      return null;
  }
}

// ─── Autentique Adapter ───────────────────────────────

const AUTENTIQUE_API_URL = "https://api.autentique.com.br/v2/graphql";

export class AutentiqueAdapter implements SignatureAdapter {
  readonly providerId = "autentique";

  async createEnvelope(params: SignatureEnvelopeParams): Promise<SignatureEnvelopeResult> {
    // Step 1: Download PDF
    let pdfBlob: Blob;
    try {
      const pdfResponse = await fetchWithTimeout(params.pdfUrl, {}, 60000);
      if (!pdfResponse.ok) throw new Error(`HTTP ${pdfResponse.status}`);
      pdfBlob = await pdfResponse.blob();
    } catch (err: any) {
      console.error("[AutentiqueAdapter] PDF download error:", err.message);
      throw new Error("Falha ao baixar o PDF para envio à Autentique.");
    }

    // Step 2: Create document with signers via GraphQL multipart
    const extra = params.settingsExtra ?? {};
    const signerMode = extra.signer_mode ?? "complete";
    const reminder = extra.reminder ?? null;
    const refusable = !!extra.refusable;
    const deadlineDays = extra.deadline_days ?? null;
    const deadlineAt =
      deadlineDays && deadlineDays > 0
        ? new Date(Date.now() + deadlineDays * 86400000).toISOString().slice(0, 19).replace("T", " ")
        : null;

    // Build DocumentInput dynamically
    const documentInputFields: string[] = ["name: $name"];
    const documentVarsDecl: string[] = ["$name: String!"];
    const documentVarsValues: Record<string, unknown> = { name: params.docName };

    if (refusable) {
      documentVarsDecl.push("$refusable: Boolean");
      documentInputFields.push("refusable: $refusable");
      documentVarsValues.refusable = true;
    }
    if (reminder) {
      documentVarsDecl.push("$reminder: ReminderEnum");
      documentInputFields.push("reminder: $reminder");
      documentVarsValues.reminder = reminder;
    }
    if (deadlineAt) {
      documentVarsDecl.push("$deadline_at: DateTime");
      documentInputFields.push("deadline_at: $deadline_at");
      documentVarsValues.deadline_at = deadlineAt;
    }

    const query = `mutation CreateDocumentMutation(
      ${documentVarsDecl.join(", ")},
      $signers: [SignerInput!]!,
      $file: Upload!
    ) {
      createDocument(
        document: { ${documentInputFields.join(", ")} },
        signers: $signers,
        file: $file,
        sandbox: ${params.sandbox ? "true" : "false"}
      ) {
        id
        name
        signatures {
          public_id
          name
          email
          action { name }
          link { short_link }
        }
      }
    }`;

    const variables: Record<string, unknown> = {
      ...documentVarsValues,
      // Autentique: only ONE of email/phone is allowed per signer.
      // When phone is used, delivery_method is required (DELIVERY_METHOD_WHATSAPP).
      // We always prefer email when present (most reliable) and only fallback to phone.
      signers: params.signers.map(s => {
        const phoneDigits = s.phone ? s.phone.replace(/\D/g, "") : "";
        const validPhone = phoneDigits.length >= 10 ? phoneDigits : "";
        const isContratante = !s.role || s.role.toLowerCase() === "contratante";
        const baseSigner: Record<string, unknown> = {
          action: "SIGN",
          name: s.name,
        };
        if (s.email) {
          baseSigner.email = s.email;
        } else if (validPhone) {
          baseSigner.phone = validPhone;
          baseSigner.delivery_method = "DELIVERY_METHOD_WHATSAPP";
        } else {
          // Will fail upstream validation — but defend with email-only
          baseSigner.email = s.email || "";
        }
        // Simplified mode: no need to inform CPF / birthdate (only for Contratante)
        if (signerMode === "simplified" && isContratante) {
          baseSigner.ignore_cpf = true;
          baseSigner.ignore_birthdate = true;
        }
        return baseSigner;
      }),
      file: null,
    };

    console.log("[AutentiqueAdapter] Sandbox mode:", params.sandbox);
    console.log("[AutentiqueAdapter] GraphQL query:", query);
    console.log("[AutentiqueAdapter] Payload variables:", JSON.stringify({ ...variables, file: "<upload>" }, null, 2));

    const operations = JSON.stringify({ query, variables });
    const map = JSON.stringify({ "0": ["variables.file"] });

    const formData = new FormData();
    formData.append("operations", operations);
    formData.append("map", map);
    formData.append("0", pdfBlob, `${params.docName.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`);

    let response: Response;
    try {
      response = await fetchWithTimeout(AUTENTIQUE_API_URL, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${params.apiToken}`,
        },
        body: formData,
      }, 60000);
    } catch (err: any) {
      console.error("[AutentiqueAdapter] API fetch error:", err.message);
      throw new Error("Falha na comunicação com Autentique. Tente novamente.");
    }

    const data = await response.json();

    if (!response.ok || data?.errors?.length) {
      // Full error log for debugging — Autentique returns 200 with errors array on validation
      console.error("[AutentiqueAdapter] Full API error response:", JSON.stringify(data));
      console.error("[AutentiqueAdapter] Signers payload sent:", JSON.stringify(variables.signers));
      if (response.status === 401 || response.status === 403) {
        throw new Error("Token Autentique inválido ou expirado. Verifique nas configurações.");
      }
      // Extract validation details if present
      const validation = data?.errors?.[0]?.extensions?.validation;
      if (validation) {
        const fields = Object.entries(validation).map(([k, v]) => `${k}: ${(v as string[]).join(", ")}`).join(" | ");
        throw new Error(`Autentique rejeitou os dados: ${fields}`);
      }
      const errMsg = data?.errors?.[0]?.message || JSON.stringify(data);
      throw new Error(`Erro Autentique (${response.status}): ${errMsg}`);
    }

    const doc = data?.data?.createDocument;
    if (!doc?.id) {
      console.error("[AutentiqueAdapter] No document id in response:", JSON.stringify(data));
      throw new Error("Autentique não retornou o ID do documento.");
    }

    // Collect signer identifiers/links
    const signerLinks: Array<{ name: string; email?: string; shortLink?: string; providerSignerId?: string }> = [];
    let firstSignUrl: string | undefined;

    if (doc.signatures && Array.isArray(doc.signatures)) {
      for (const sig of doc.signatures) {
        const shortLink = sig?.link?.short_link;
        const providerSignerId = sig?.public_id;
        if (shortLink) {
          if (!firstSignUrl) firstSignUrl = shortLink;
        }
        if (shortLink || providerSignerId) {
          signerLinks.push({
            name: sig.name || sig.email || "Signatário",
            email: sig.email || undefined,
            shortLink,
            providerSignerId,
          });
        }
      }
    }

    return {
      envelopeId: doc.id,
      signUrl: firstSignUrl,
      signerLinks,
    };
  }
}

// ─── Autentique Webhook Parser ────────────────────────

/**
 * Autentique webhook payload:
 * { id, object: "webhook", name, event: { type: "signature.signed", ... }, data: { document: { id }, signature: { public_id } } }
 */
export function parseAutentiqueWebhook(body: Record<string, any>): WebhookParseResult {
  const docId = body?.data?.document?.id || null;
  const eventType = body?.event?.type || null;
  return { docToken: docId, status: eventType };
}

export function mapAutentiqueStatus(eventType: string): { signatureStatus: string; docStatus: string; isSigned: boolean } | null {
  switch (eventType) {
    // Assinatura concluída
    case "document.signed":
    case "signature.signed":
    case "signature.accepted":
      return { signatureStatus: "signed", docStatus: "signed", isSigned: true };

    // Recusa / rejeição
    case "document.refused":
    case "signature.refused":
    case "signature.rejected":
      return { signatureStatus: "refused", docStatus: "cancelled", isSigned: false };

    // Visualização
    case "signature.viewed":
      return { signatureStatus: "viewed", docStatus: "sent_for_signature", isSigned: false };

    // Cancelamento
    case "document.cancelled":
    case "signature.deleted":
      return { signatureStatus: "cancelled", docStatus: "cancelled", isSigned: false };

    // Falha na entrega — marcar como erro mas manter documento ativo
    case "signature.delivery_failed":
      return { signatureStatus: "delivery_failed", docStatus: "sent_for_signature", isSigned: false };

    // Biometria aprovada — tratamos como visualização avançada (não é assinatura final)
    case "signature.biometric_approved":
      return { signatureStatus: "viewed", docStatus: "sent_for_signature", isSigned: false };

    // Biometria reprovada
    case "signature.biometric_unapproved":
    case "signature.biometric_rejected":
      return { signatureStatus: "refused", docStatus: "cancelled", isSigned: false };

    // Eventos informativos — ignorar (created, updated)
    case "signature.created":
    case "signature.updated":
      return null;

    default:
      return null;
  }
}

// ─── Assinafy Adapter ─────────────────────────────────
// REST API. Auth via X-Api-Key header.
// Workspace account_id is required for upload — user provides credentials as
// "ACCOUNT_ID:API_KEY" in the apiToken field (parsed below).
// Flow: 1) upload PDF → document_id  2) create signer(s) → signer_ids
//       3) POST /documents/{doc}/assignments method=virtual signer_ids=[...]

function assinafyBaseUrl(sandbox: boolean): string {
  return sandbox ? "https://sandbox.assinafy.com.br/v1" : "https://api.assinafy.com.br/v1";
}

function parseAssinafyToken(raw: string): { accountId: string; apiKey: string } {
  const idx = raw.indexOf(":");
  if (idx <= 0) {
    throw new Error(
      "Token Assinafy deve estar no formato ACCOUNT_ID:API_KEY (workspace + chave). Veja o tutorial.",
    );
  }
  return { accountId: raw.slice(0, idx).trim(), apiKey: raw.slice(idx + 1).trim() };
}

export class AssinafyAdapter implements SignatureAdapter {
  readonly providerId = "assinafy";

  async createEnvelope(params: SignatureEnvelopeParams): Promise<SignatureEnvelopeResult> {
    const { accountId, apiKey } = parseAssinafyToken(params.apiToken);
    const baseUrl = assinafyBaseUrl(params.sandbox);
    const authHeaders = { "X-Api-Key": apiKey };

    // Step 1: download PDF
    let pdfBlob: Blob;
    try {
      const r = await fetchWithTimeout(params.pdfUrl, {}, 60000);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      pdfBlob = await r.blob();
    } catch (err: any) {
      console.error("[AssinafyAdapter] PDF download error:", err.message);
      throw new Error("Falha ao baixar o PDF para envio à Assinafy.");
    }

    // Step 2: upload document (multipart)
    const safeName = `${params.docName.replace(/[^a-zA-Z0-9._-]/g, "_")}.pdf`;
    const fd = new FormData();
    fd.append("file", pdfBlob, safeName);

    let uploadRes: Response;
    try {
      uploadRes = await fetchWithTimeout(`${baseUrl}/accounts/${accountId}/documents`, {
        method: "POST",
        headers: authHeaders,
        body: fd,
      }, 60000);
    } catch (err: any) {
      console.error("[AssinafyAdapter] Upload fetch error:", err.message);
      throw new Error("Falha na comunicação com Assinafy. Tente novamente.");
    }
    const uploadJson = await uploadRes.json().catch(() => ({} as any));
    if (!uploadRes.ok) {
      console.error("[AssinafyAdapter] Upload error:", uploadRes.status, JSON.stringify(uploadJson));
      if (uploadRes.status === 401 || uploadRes.status === 403) {
        throw new Error("Credenciais Assinafy inválidas. Verifique ACCOUNT_ID e API Key.");
      }
      throw new Error(`Erro Assinafy upload (${uploadRes.status}): ${uploadJson?.message || JSON.stringify(uploadJson)}`);
    }
    // Upload returns either {id, ...} (legacy) or {data: {id, ...}}
    const documentId: string | undefined = uploadJson?.data?.id || uploadJson?.id;
    if (!documentId) {
      console.error("[AssinafyAdapter] Missing document id:", JSON.stringify(uploadJson));
      throw new Error("Assinafy não retornou o ID do documento.");
    }

    // Step 3: create signers
    const signerIds: string[] = [];
    for (const s of params.signers) {
      const phoneDigits = s.phone ? s.phone.replace(/\D/g, "") : "";
      const cpfDigits = s.cpf ? s.cpf.replace(/\D/g, "") : "";
      const signerBody: Record<string, unknown> = {
        full_name: s.name,
        email: s.email || undefined,
      };
      if (cpfDigits) signerBody.government_id = cpfDigits;
      if (phoneDigits.length >= 10) signerBody.telephone = phoneDigits;

      let sRes: Response;
      try {
        sRes = await fetchWithTimeout(`${baseUrl}/accounts/${accountId}/signers`, {
          method: "POST",
          headers: { ...authHeaders, "Content-Type": "application/json" },
          body: JSON.stringify(signerBody),
        });
      } catch (err: any) {
        console.error("[AssinafyAdapter] Signer fetch error:", err.message);
        throw new Error(`Falha ao criar signatário ${s.name} na Assinafy.`);
      }
      const sJson = await sRes.json().catch(() => ({} as any));
      if (!sRes.ok) {
        console.error("[AssinafyAdapter] Signer error:", sRes.status, JSON.stringify(sJson));
        throw new Error(`Erro ao criar signatário ${s.name}: ${sJson?.message || JSON.stringify(sJson)}`);
      }
      const signerId: string | undefined = sJson?.data?.id || sJson?.id;
      if (!signerId) {
        throw new Error(`Assinafy não retornou ID do signatário ${s.name}.`);
      }
      signerIds.push(signerId);
    }

    // Step 4: create virtual assignment (request signatures)
    const assignBody = {
      method: "virtual",
      signers: signerIds.map((id) => ({
        id,
        verification_method: "Email",
        notification_methods: ["Email"],
      })),
    };

    let aRes: Response;
    try {
      aRes = await fetchWithTimeout(`${baseUrl}/documents/${documentId}/assignments`, {
        method: "POST",
        headers: { ...authHeaders, "Content-Type": "application/json" },
        body: JSON.stringify(assignBody),
      });
    } catch (err: any) {
      console.error("[AssinafyAdapter] Assignment fetch error:", err.message);
      throw new Error("Falha ao solicitar assinaturas na Assinafy.");
    }
    const aJson = await aRes.json().catch(() => ({} as any));
    if (!aRes.ok) {
      console.error("[AssinafyAdapter] Assignment error:", aRes.status, JSON.stringify(aJson));
      throw new Error(`Erro Assinafy assignment (${aRes.status}): ${aJson?.message || JSON.stringify(aJson)}`);
    }

    const assignmentData = aJson?.data || aJson;
    const signerLinks: Array<{ name: string; shortLink: string }> = [];
    let firstSignUrl: string | undefined;
    const urls = assignmentData?.signing_urls || [];
    if (Array.isArray(urls)) {
      for (const u of urls) {
        const link = u?.url;
        if (link) {
          if (!firstSignUrl) firstSignUrl = link;
          // Best effort name lookup by signer id
          const idx = signerIds.indexOf(u?.signer_id);
          const name = idx >= 0 ? params.signers[idx]?.name : (u?.signer_id || "Signatário");
          signerLinks.push({ name: name || "Signatário", shortLink: link });
        }
      }
    }

    return {
      envelopeId: documentId,
      signUrl: firstSignUrl,
      signerLinks,
    };
  }
}

// ─── Assinafy Webhook Parser ──────────────────────────
/**
 * Assinafy webhook payloads are envelope-shaped:
 *   { event_type: "document.certificated", data: { document: { id, status, ... } } }
 *   { event: "document.certificated", data: { id: "<documentId>", ... } }
 * Statuses (per docs): uploaded, metadata_processing, metadata_ready, pending_signature,
 *   certificating, certificated, rejected_by_signer, rejected_by_user, expired, failed.
 */
export function parseAssinafyWebhook(body: Record<string, any>): WebhookParseResult {
  const docToken =
    body?.data?.document?.id ||
    body?.data?.id ||
    body?.document?.id ||
    body?.document_id ||
    null;
  const status =
    body?.event_type ||
    body?.event ||
    body?.data?.document?.status ||
    body?.data?.status ||
    null;
  return { docToken, status };
}

export function mapAssinafyStatus(status: string): { signatureStatus: string; docStatus: string; isSigned: boolean } | null {
  switch (status) {
    case "document.certificated":
    case "certificated":
      return { signatureStatus: "signed", docStatus: "signed", isSigned: true };
    case "document.rejected_by_signer":
    case "rejected_by_signer":
      return { signatureStatus: "refused", docStatus: "cancelled", isSigned: false };
    case "document.rejected_by_user":
    case "rejected_by_user":
    case "document.expired":
    case "expired":
      return { signatureStatus: "cancelled", docStatus: "cancelled", isSigned: false };
    case "document.pending_signature":
    case "pending_signature":
      return { signatureStatus: "sent", docStatus: "sent_for_signature", isSigned: false };
    case "document.failed":
    case "failed":
      return { signatureStatus: "delivery_failed", docStatus: "sent_for_signature", isSigned: false };
    default:
      return null;
  }
}

// ─── Factory ──────────────────────────────────────────

export function getSignatureAdapter(provider: string): SignatureAdapter {
  switch (provider) {
    case "clicksign":
      return new ClickSignAdapter();
    case "autentique":
      return new AutentiqueAdapter();
    case "assinafy":
      return new AssinafyAdapter();
    case "zapsign":
    default:
      return new ZapSignAdapter();
  }
}

// ─── Webhook Detection ────────────────────────────────

export type WebhookProvider = "zapsign" | "clicksign" | "autentique" | "assinafy" | "unknown";

/**
 * DA-29: Detect provider by webhook payload format.
 * Clicksign: { event: { name }, document: { key } }
 * ZapSign: { doc: { token, status } } or { token, status }
 * Autentique: { object: "webhook", event: { type }, data: { document: { id } } }
 * Assinafy: { event_type|event: "document.*", data: { document|id } } — REST/JSON envelope
 */
export function detectWebhookProvider(body: Record<string, any>): WebhookProvider {
  if (body?.object === "webhook" && body?.event?.type) return "autentique";
  if (body?.event?.name && body?.document?.key) return "clicksign";
  const assinafyEvent = typeof body?.event_type === "string" ? body.event_type
    : (typeof body?.event === "string" ? body.event : "");
  if (assinafyEvent && /^(document|assignment)\./.test(assinafyEvent)) return "assinafy";
  if (body?.doc?.token || body?.doc?.status || body?.token) return "zapsign";
  return "unknown";
}
