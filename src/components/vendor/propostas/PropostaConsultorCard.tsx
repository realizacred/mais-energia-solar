/**
 * PropostaConsultorCard — Card read-only de proposta oficial (Portal Consultor).
 *
 * Ações permitidas (todas via SSOT, sem geração local):
 *  - Abrir proposta pública (token oficial)
 *  - Copiar link do PDF oficial
 *  - Abrir PDF oficial (storage proposta-documentos via signedUrl)
 *  - Enviar via WhatsApp (Drawer com personalização)
 *  - Enviar via Email (mailto: com link público — sem engine paralela)
 */
import { useState } from "react";
import {
  ExternalLink,
  Copy,
  FileText,
  MessageCircle,
  Mail,
  Eye,
  CheckCircle2,
  Clock,
  Loader2,
  Send,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateProposalToken } from "@/services/proposal/proposalDetail.service";
import { formatBRL } from "@/lib/formatters";
import type { PropostaConsultor } from "@/hooks/useMinhasPropostasConsultor";
import { getProposalWebUrl, getProposalPdfSignedUrl } from "@/services/proposal/proposalLinks";
import { ProposalMessageDrawer } from "@/components/admin/projetos/ProposalMessageDrawer";

interface Props {
  proposta: PropostaConsultor;
  onChanged?: () => void;
}

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
  gerada: { label: "Gerada", cls: "bg-info/15 text-info border-info/20" },
  enviada: { label: "Enviada", cls: "bg-primary/15 text-primary border-primary/20" },
  vista: { label: "Visualizada", cls: "bg-warning/15 text-warning border-warning/20" },
  aceita: { label: "Aceita", cls: "bg-success/15 text-success border-success/20" },
  recusada: { label: "Recusada", cls: "bg-destructive/15 text-destructive border-destructive/20" },
  expirada: { label: "Expirada", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelada: { label: "Cancelada", cls: "bg-muted text-muted-foreground" },
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return "—";
  }
}

async function resolveOfficialUrl(proposta: PropostaConsultor): Promise<string> {
  let token = proposta.public_token;
  
  // Se não tem token, tenta gerar via RPC ou service
  if (!token && proposta.versao_id) {
    try {
      token = await getOrCreateProposalToken(proposta.id, proposta.versao_id, "tracked");
    } catch (e) {
      console.error("[PropostaConsultorCard] Falha ao obter token:", e);
    }
  }
  
  if (!token) throw new Error("Proposta ainda não possui um link público gerado");
  return getProposalWebUrl(token);
}

export function PropostaConsultorCard({ proposta, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msgOpen, setMsgOpen] = useState(false);
  
  const status = STATUS_LABEL[proposta.status] ?? {
    label: proposta.status,
    cls: "bg-muted text-muted-foreground",
  };

  const handleOpenPublic = async () => {
    setBusy("open");
    try {
      const url = await resolveOfficialUrl(proposta);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Não foi possível abrir", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleCopyLink = async () => {
    // CORREÇÃO 2: Copiar link do PDF
    if (!proposta.output_pdf_path) {
      toast({ 
        title: "PDF ainda não gerado", 
        description: "Gere a proposta primeiro para obter o link do PDF.", 
        variant: "destructive" 
      });
      return;
    }

    setBusy("copy");
    try {
      const url = await getProposalPdfSignedUrl(proposta.output_pdf_path);
      if (!url) throw new Error("Falha ao gerar link do PDF");
      
      await navigator.clipboard.writeText(url);
      toast({ title: "Link do PDF copiado! 📋" });
    } catch (e: any) {
      toast({ title: "Erro ao copiar link", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleOpenPdf = async () => {
    if (!proposta.output_pdf_path) {
      toast({
        title: "PDF oficial indisponível",
        description: "Solicite ao administrador para gerar a versão final.",
        variant: "destructive",
      });
      return;
    }
    setBusy("pdf");
    try {
      const url = await getProposalPdfSignedUrl(proposta.output_pdf_path);
      if (!url) throw new Error("PDF não encontrado");
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast({ title: "Erro ao abrir PDF", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const handleSendWhatsapp = () => {
    // CORREÇÃO 3: Abrir modal de mensagem
    if (!proposta.versao_id || !proposta.projeto_id) {
      toast({ title: "Dados da proposta incompletos", variant: "destructive" });
      return;
    }
    setMsgOpen(true);
  };

  const handleSendEmail = async () => {
    setBusy("email");
    try {
      const url = await resolveOfficialUrl(proposta);
      const subject = encodeURIComponent(
        `Proposta ${proposta.codigo ?? proposta.titulo ?? ""}`.trim(),
      );
      const body = encodeURIComponent(
        `Olá!\n\nSegue a proposta oficial:\n${url}\n\nQualquer dúvida estou à disposição.`,
      );
      window.location.href = `mailto:?subject=${subject}&body=${body}`;
    } catch (e: any) {
      toast({ title: "Erro ao preparar email", description: e.message, variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const codeLabel =
    proposta.codigo ||
    (proposta.proposta_num ? `PROP-${proposta.proposta_num}` : proposta.titulo) ||
    "Sem código";

  return (
    <>
      <Card className="border-l-[3px] border-l-primary/40">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs text-muted-foreground">{codeLabel}</span>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${status.cls}`}>
                  {status.label}
                </Badge>
                {proposta.is_principal && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/30">
                    Principal
                  </Badge>
                )}
              </div>
              <h3 className="text-sm font-semibold text-foreground mt-1 truncate">
                {proposta.cliente_nome || proposta.titulo || "Cliente"}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground">Potência</p>
              <p className="font-semibold text-foreground">
                {proposta.potencia_kwp != null ? `${Number(proposta.potencia_kwp).toFixed(2)} kWp` : "—"}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground">Geração</p>
              <p className="font-semibold text-foreground">
                {proposta.geracao_mensal != null
                  ? `${Number(proposta.geracao_mensal).toFixed(0)} kWh`
                  : "—"}
              </p>
            </div>
            <div className="rounded-md border border-border bg-muted/30 px-2 py-1.5">
              <p className="text-[9px] text-muted-foreground">Valor</p>
              <p className="font-semibold text-foreground">
                {proposta.valor_total != null ? formatBRL(Number(proposta.valor_total)) : "—"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Validade: {formatDate(proposta.valido_ate)}
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3 w-3" />
              {proposta.total_aberturas ?? 0} aberturas
            </span>
            {proposta.aceita_at && (
              <span className="flex items-center gap-1 text-success">
                <CheckCircle2 className="h-3 w-3" />
                Aceita {formatDate(proposta.aceita_at)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1">
            <Button size="sm" variant="default" onClick={handleOpenPublic} disabled={!!busy}>
              {busy === "open" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ExternalLink className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Abrir</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleCopyLink} disabled={!!busy}>
              {busy === "copy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Copiar link</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleOpenPdf} disabled={!!busy}>
              {busy === "pdf" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
              <span className="ml-1.5">PDF oficial</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleSendWhatsapp} disabled={!!busy || !proposta.versao_id}>
              {busy === "wa" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageCircle className="h-3.5 w-3.5" />}
              <span className="ml-1.5">WhatsApp</span>
            </Button>
            <Button size="sm" variant="outline" onClick={handleSendEmail} disabled={!!busy}>
              {busy === "email" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              <span className="ml-1.5">Email</span>
            </Button>
            {(proposta.primeiro_acesso_em || proposta.ultimo_acesso_em) && (
              <span className="ml-auto text-[10px] text-muted-foreground self-center inline-flex items-center gap-1">
                <Send className="h-3 w-3" />
                Último acesso: {formatDate(proposta.ultimo_acesso_em ?? proposta.primeiro_acesso_em)}
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      {proposta.versao_id && proposta.projeto_id && (
        <ProposalMessageDrawer
          open={msgOpen}
          onOpenChange={setMsgOpen}
          versaoId={proposta.versao_id}
          propostaId={proposta.id}
          projetoId={proposta.projeto_id}
          clienteId={proposta.cliente_id}
          propostaData={{
            cliente_nome: proposta.cliente_nome,
            codigo: proposta.codigo,
            status: proposta.status,
          }}
          versaoData={{
            valor_total: proposta.valor_total,
            potencia_kwp: proposta.potencia_kwp,
            economia_mensal: proposta.economia_mensal,
            payback_meses: proposta.payback_meses,
            geracao_mensal: proposta.geracao_mensal,
            public_slug: proposta.public_slug,
          }}
        />
      )}
    </>
  );
}
