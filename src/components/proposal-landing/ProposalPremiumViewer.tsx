import { useState } from "react";
import { FileText, Download, Loader2, ChevronRight, RefreshCw, AlertTriangle } from "lucide-react";
import { getMaskedPdfUrl } from "@/services/proposal/proposalLinks";
import { registerProposalEvent } from "@/services/proposal/registerProposalEvent";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { usePdfReadiness } from "@/components/proposal-landing/hooks/usePdfReadiness";

interface ProposalPremiumViewerProps {
  token: string;
  clienteNome?: string;
  brand: any;
  onAccept: () => void;
  onReject: () => void;
  onRetry?: () => void;
  status?: string;
  version?: number;
}

export function ProposalPremiumViewer({
  token,
  clienteNome,
  brand,
  onAccept,
  onReject,
  onRetry,
  status,
  version,
}: ProposalPremiumViewerProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Sonda o PDF antes de renderizar o iframe (evita JSON cru na tela).
  const { data: readiness, refetch } = usePdfReadiness(token);
  const isReady = readiness?.status === "ready";
  const isFailed = readiness?.status === "failed";

  const handleDownload = async () => {
    if (downloading || !isReady) return;
    setDownloading(true);
    try {
      await registerProposalEvent(token, "pdf_download", "copy_pdf", {
        surface: "public_landing",
      });
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const directUrl = `${supabaseUrl}/functions/v1/proposal-pdf-serve?token=${encodeURIComponent(token)}&download=1`;
      window.location.href = directUrl;
    } finally {
      setTimeout(() => setDownloading(false), 1500);
    }
  };

  const statusBadge = isReady
    ? { color: "bg-green-500", label: "Documento Pronto" }
    : isFailed
    ? { color: "bg-red-500", label: "Erro na geração" }
    : { color: "bg-amber-400", label: "Preparando documento…" };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col">
      {/* Premium Header */}
      <header className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10 p-4 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {brand?.logo_white_url ? (
            <img src={brand.logo_white_url} alt="" className="h-8 object-contain" />
          ) : (
            <div className="h-8 w-8 bg-primary/20 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
          )}
          <div className="hidden sm:block">
            <h1 className="text-white text-sm font-bold leading-tight flex items-center gap-2">
              Proposta Solar
              {version && <span className="bg-white/10 text-[10px] px-1.5 py-0.5 rounded text-white/60">v{version}</span>}
            </h1>
            <p className="text-white/40 text-[10px] uppercase tracking-wider">{clienteNome || "Carregando..."}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 mr-4 border-r border-white/10 pr-4">
            <div className="text-right">
              <p className="text-[10px] text-white/40 uppercase font-bold tracking-tighter">Status</p>
              <div className="flex items-center gap-1.5 justify-end">
                <div className={`h-1.5 w-1.5 rounded-full ${statusBadge.color} ${isReady ? "animate-pulse" : ""}`} />
                <span className="text-[11px] text-white/80 font-medium">{statusBadge.label}</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading || !isReady}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all border border-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
            title={isReady ? "Baixar PDF" : "PDF sendo preparado"}
            aria-label="Baixar PDF"
          >
            {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
          </button>

          <Button
            onClick={onAccept}
            className="bg-primary hover:bg-primary/90 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-xl shadow-primary/20 flex items-center gap-2"
          >
            Aceitar Proposta <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 sm:p-8 flex flex-col items-center gap-8 bg-slate-950">
        <div className="w-full max-w-5xl relative bg-[#1e1e1e] rounded-2xl shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden min-h-[800px] border border-white/5">
          {/* Skeleton premium enquanto sonda ou iframe carrega */}
          {(!isReady || iframeLoading) && !isFailed && (
            <div className="absolute inset-0 z-10 bg-[#1e1e1e] flex flex-col items-center justify-center gap-4">
              <div className="w-full max-w-3xl space-y-4 p-8">
                <Skeleton className="h-12 w-3/4 bg-white/5" />
                <Skeleton className="h-[600px] w-full bg-white/5" />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-3 text-center px-6">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-white/80 text-sm font-semibold">
                  {isReady ? "Renderizando PDF de alta qualidade…" : "Estamos preparando sua proposta"}
                </p>
                {!isReady && (
                  <p className="text-white/40 text-xs max-w-sm">
                    O documento será exibido aqui automaticamente assim que ficar pronto.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Estado de falha — mensagem comercial, sem JSON */}
          {isFailed && (
            <div className="absolute inset-0 z-10 bg-[#1e1e1e] flex flex-col items-center justify-center gap-4 p-8 text-center">
              <AlertTriangle className="h-10 w-10 text-amber-400" />
              <p className="text-white text-base font-semibold">Não foi possível preparar o documento agora</p>
              <p className="text-white/50 text-sm max-w-sm">
                A landing comercial continua disponível. Você pode tentar gerar o PDF novamente em instantes.
              </p>
              <Button
                onClick={() => refetch()}
                variant="outline"
                className="mt-2 bg-white/5 border-white/10 text-white hover:bg-white/10"
              >
                <RefreshCw className="h-4 w-4 mr-2" /> Tentar novamente
              </Button>
            </div>
          )}

          {/* Iframe só monta quando o content-type confirmou application/pdf */}
          {isReady && (
            <iframe
              src={getMaskedPdfUrl(token)}
              className="w-full h-full min-h-[1000px] border-0"
              onLoad={() => setIframeLoading(false)}
              title="Visualizador de Proposta"
            />
          )}
        </div>

        <div className="w-full max-w-5xl flex justify-between items-center text-white/20 text-[10px] uppercase tracking-widest pb-12">
          <div>Certificado Digital ENERGY-CRM</div>
          <div className="flex gap-4">
            <button onClick={onRetry} className="hover:text-white/40 transition-colors flex items-center gap-1">
              <RefreshCw className="h-3 w-3" /> Atualizar
            </button>
            <span>Ver. {version}</span>
          </div>
        </div>
      </main>
    </div>
  );
}
