
import { useState, useEffect } from "react";
import { FileText, Download, Loader2, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import { getMaskedPdfUrl } from "@/services/proposal/proposalLinks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

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
  version
}: ProposalPremiumViewerProps) {
  const [iframeLoading, setIframeLoading] = useState(true);
  const pdfUrl = getMaskedPdfUrl(token);

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
                   <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                   <span className="text-[11px] text-white/80 font-medium">Documento Pronto</span>
                </div>
             </div>
          </div>

          <a 
            href={pdfUrl} 
            download={`Proposta_${clienteNome}.pdf`}
            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-white transition-all border border-white/5"
            title="Baixar PDF"
          >
            <Download className="h-5 w-5" />
          </a>
          
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
          {iframeLoading && (
            <div className="absolute inset-0 z-10 bg-[#1e1e1e] flex flex-col items-center justify-center gap-4">
              <div className="w-full max-w-3xl space-y-4 p-8">
                <Skeleton className="h-12 w-3/4 bg-white/5" />
                <Skeleton className="h-[600px] w-full bg-white/5" />
              </div>
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 text-primary animate-spin" />
                <p className="text-white/40 text-sm font-medium animate-pulse">Renderizando PDF de alta qualidade...</p>
              </div>
            </div>
          )}
          
          <iframe 
            src={pdfUrl} 
            className="w-full h-full min-h-[1000px] border-0"
            onLoad={() => setIframeLoading(false)}
            title="Visualizador de Proposta"
          />
        </div>

        {/* Footer simple */}
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
