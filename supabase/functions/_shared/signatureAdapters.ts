/**
 * Signature Adapters — Multi-provider pattern for electronic signatures.
 * DA-27: Adapter pattern — ZapSign + Clicksign + Autentique
 * DA-28: Clicksign requires 3 API calls (upload, signer, list+notify)
 * RB-23: No console.log — only console.error with prefix
 */

// ─── Interface ────────────────────────────────────────

export interface SignatureEnvelopeParams {
  pdfUrl: string;
  docName: string;
  signers: Array<{
    name: string;
    email: string;
    cpf?: string;
    phone?: string;
    auth_method?: string;
  }>;
  sandbox: boolean;
  apiToken: string;
}

export interface SignatureEnvelopeResult {
  envelopeId: string;
  signUrl?: string;
  /** Per-signer short links (Autentique returns these) */
  signerLinks?: Array<{ name: string; shortLink: string }>;
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
    const query = `mutation CreateDocumentMutation(
      $document: DocumentInput!,
      $signers: [SignerInput!]!,
      $file: Upload!
    ) {
      createDocument(
        document: $document,
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

    const variables = {
      document: {
        name: params.docName,
      },
      signers: params.signers.map(s => ({
        email: s.email,
        action: "SIGN",
        name: s.name,
        ...(s.phone ? { phone: s.phone.replace(/\D/g, "") } : {}),
      })),
      file: null,
    };

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
      console.error("[AutentiqueAdapter] API error:", response.status, JSON.stringify(data));
      if (response.status === 401 || response.status === 403) {
        throw new Error("Token Autentique inválido ou expirado. Verifique nas configurações.");
      }
      const errMsg = data?.errors?.[0]?.message || JSON.stringify(data);
      throw new Error(`Erro Autentique (${response.status}): ${errMsg}`);
    }

    const doc = data?.data?.createDocument;
    if (!doc?.id) {
      console.error("[AutentiqueAdapter] No document id in response:", JSON.stringify(data));
      throw new Error("Autentique não retornou o ID do documento.");
    }

    // Collect signer links
    const signerLinks: Array<{ name: string; shortLink: string }> = [];
    let firstSignUrl: string | undefined;

    if (doc.signatures && Array.isArray(doc.signatures)) {
      for (const sig of doc.signatures) {
        const shortLink = sig?.link?.short_link;
        if (shortLink) {
          if (!firstSignUrl) firstSignUrl = shortLink;
          signerLinks.push({
            name: sig.name || sig.email || "Signatário",
            shortLink,
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
    case "document.signed":
    case "signature.signed":
      return { signatureStatus: "signed", docStatus: "signed", isSigned: true };
    case "document.refused":
    case "signature.refused":
      return { signatureStatus: "refused", docStatus: "cancelled", isSigned: false };
    case "signature.viewed":
      return { signatureStatus: "viewed", docStatus: "sent_for_signature", isSigned: false };
    case "document.cancelled":
      return { signatureStatus: "cancelled", docStatus: "cancelled", isSigned: false };
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
    case "zapsign":
    default:
      return new ZapSignAdapter();
  }
}

// ─── Webhook Detection ────────────────────────────────

export type WebhookProvider = "zapsign" | "clicksign" | "autentique" | "unknown";

/**
 * DA-29: Detect provider by webhook payload format.
 * Clicksign: { event: { name }, document: { key } }
 * ZapSign: { doc: { token, status } } or { token, status }
 * Autentique: { object: "webhook", event: { type }, data: { document: { id } } }
 */
export function detectWebhookProvider(body: Record<string, any>): WebhookProvider {
  if (body?.object === "webhook" && body?.event?.type) return "autentique";
  if (body?.event?.name && body?.document?.key) return "clicksign";
  if (body?.doc?.token || body?.doc?.status || body?.token) return "zapsign";
  return "unknown";
}
