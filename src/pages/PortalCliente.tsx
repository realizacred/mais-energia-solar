
import { useState, useMemo } from "react";
import { useParams } from "react-router-dom";
import { usePortalProject } from "@/hooks/usePortalData";
import { useProjectDocuments } from "@/hooks/useProjectDocuments";
import { useRecibos } from "@/hooks/useRecibos";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Building2, FileText, DollarSign, MessageCircle, 
  MapPin, Zap, Receipt, Download, Upload, Info
} from "lucide-react";
import { formatBRLInteger as formatBRL } from "@/lib/formatters";

export default function PortalCliente() {
  const { token } = useParams<{ token: string }>();
  const { data: project, isLoading: loadingProject, error: projectError } = usePortalProject(token);
  
  const { data: docsData, isLoading: loadingDocs } = useProjectDocuments({ 
    projetoId: project?.id 
  });
  
  const { data: recibos = [], isLoading: loadingRecibos } = useRecibos({ 
    projeto_id: project?.id || undefined 
  });

  const brandPrimary = project?.brand?.color_primary || "#F07B24";

  if (loadingProject) {
    return (
      <div className="min-h-screen bg-background p-4 md:p-8 flex justify-center">
        <div className="w-full max-w-4xl space-y-6">
          <Skeleton className="h-20 w-full" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (projectError || !project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-8">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h1 className="text-lg font-bold text-foreground mb-2">Link inválido ou desativado</h1>
          <p className="text-sm text-muted-foreground">
            Este portal não está acessível. Solicite um novo link ao seu consultor.
          </p>
        </Card>
      </div>
    );
  }

  const handleWhatsApp = () => {
    if (!project.consultor_telefone) return;
    const tel = project.consultor_telefone.replace(/\D/g, "");
    const msg = `Olá ${project.consultor_nome}! Sou o cliente ${project.cliente_nome} e gostaria de falar sobre meu projeto ${project.codigo || ""}`;
    window.open(`https://wa.me/55${tel}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background">
      {/* HEADER */}
      <header className="border-b border-border px-4 md:px-8 py-4 sticky top-0 z-10 bg-white shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {project.brand?.logo_url ? (
              <img src={project.brand.logo_url} alt={project.brand.company_name} className="h-9 w-auto object-contain" />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Sun className="w-5 h-5" style={{ color: brandPrimary }} />
              </div>
            )}
            <div>
              <h1 className="text-sm font-bold text-foreground truncate">
                {project.brand?.company_name || "Portal do Cliente"}
              </h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Acompanhamento Solar</p>
            </div>
          </div>
          <Badge 
            variant="outline" 
            className="hidden sm:flex items-center gap-1.5 px-3 py-1 border-primary/20 bg-primary/5"
            style={{ borderColor: `${brandPrimary}33`, color: brandPrimary }}
          >
            <Zap className="w-3 h-3" />
            Em andamento
          </Badge>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
        {/* WELCOME */}
        <section className="space-y-2">
          <h2 className="text-xl md:text-2xl font-bold text-foreground">
            Olá, {project.cliente_nome?.split(' ')[0]}! 👋
          </h2>
          <p className="text-sm text-muted-foreground">
            Acompanhe aqui o progresso da sua instalação solar.
          </p>
        </section>

        {/* STATUS CARD */}
        <Card className="overflow-hidden border-none shadow-md bg-gradient-to-br from-white to-muted/20">
          <CardContent className="p-0">
            <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Status Atual</p>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: project.etapa_cor || brandPrimary }} />
                  <h3 className="text-lg font-bold" style={{ color: project.etapa_cor || brandPrimary }}>
                    {project.etapa_nome || "Análise Inicial"}
                  </h3>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right hidden sm:block">
                  <p className="text-xs text-muted-foreground">Código do projeto</p>
                  <p className="text-sm font-mono font-bold">{project.codigo || "—"}</p>
                </div>
                <Button 
                  onClick={handleWhatsApp}
                  className="gap-2 shadow-sm hover:scale-105 transition-transform"
                  style={{ backgroundColor: "#25D366", color: "white" }}
                >
                  <MessageCircle className="w-4 h-4" />
                  Falar com Consultor
                </Button>
              </div>
            </div>
            
            {/* PROGRESS BAR PLACEHOLDER */}
            <div className="px-5 pb-5 space-y-2">
              <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-1000" 
                  style={{ 
                    width: '35%', 
                    backgroundColor: brandPrimary 
                  }} 
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground font-medium uppercase">
                <span>Venda</span>
                <span>Engenharia</span>
                <span>Instalação</span>
                <span>Ligação</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* RESUMO */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-muted/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" style={{ color: brandPrimary }} />
                Resumo do Projeto
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Potência</p>
                  <p className="text-sm font-bold">{project.potencia_kwp ? `${project.potencia_kwp.toLocaleString('pt-BR')} kWp` : '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold">Valor Total</p>
                  <p className="text-sm font-bold">{project.valor_total ? formatBRL(project.valor_total) : '—'}</p>
                </div>
              </div>
              <div className="space-y-1 pt-2 border-t border-muted/50">
                <p className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Endereço da Instalação
                </p>
                <p className="text-xs leading-relaxed">
                  {project.address?.rua}, {project.address?.numero}<br />
                  {project.address?.bairro} — {project.address?.cidade}/{project.address?.estado}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* FINANCEIRO */}
          <Card className="shadow-sm">
            <CardHeader className="pb-3 border-b border-muted/50">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" style={{ color: brandPrimary }} />
                Financeiro
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4">
              {loadingRecibos ? (
                <Skeleton className="h-20 w-full" />
              ) : recibos.length === 0 ? (
                <div className="py-4 text-center">
                  <Info className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                  <p className="text-xs text-muted-foreground">Nenhum recibo emitido ainda.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {recibos.map((r: any) => (
                    <div key={r.id} className="flex items-center justify-between p-2 rounded-lg border border-muted/50 text-xs">
                      <div>
                        <p className="font-bold">{r.template || "Recibo"}</p>
                        <p className="text-muted-foreground">{new Date(r.created_at).toLocaleDateString('pt-BR')}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold">{formatBRL(r.valor)}</span>
                        {r.pdf_url && (
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* DOCUMENTOS */}
        <Card className="shadow-sm">
          <CardHeader className="pb-3 border-b border-muted/50 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" style={{ color: brandPrimary }} />
              Meus Documentos
            </CardTitle>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 border-dashed">
              <Upload className="w-3.5 h-3.5" />
              Enviar Documento
            </Button>
          </CardHeader>
          <CardContent className="pt-4">
            {loadingDocs ? (
              <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : docsData?.documents.length === 0 ? (
              <div className="py-8 text-center bg-muted/10 rounded-xl border border-dashed border-muted">
                <FileText className="w-10 h-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                <p className="text-sm font-medium text-foreground">Sem documentos no momento</p>
                <p className="text-xs text-muted-foreground mt-1">Aguarde a geração do seu contrato ou envie seus dados.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {docsData?.documents.map((doc: any) => (
                  <div 
                    key={doc.id} 
                    className="flex items-center gap-3 p-3 rounded-xl border border-muted bg-white hover:border-primary/30 transition-colors group"
                  >
                    <div className="w-10 h-10 rounded-lg bg-muted/30 flex items-center justify-center shrink-0 group-hover:bg-primary/5">
                      <FileText className="w-5 h-5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold truncate">{doc.display_name || doc.file_name}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(doc.created_at).toLocaleDateString('pt-BR')}</p>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
          © {new Date().getFullYear()} {project.brand?.company_name} — Todos os direitos reservados
        </p>
      </footer>
    </div>
  );
}

function Sun(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}
