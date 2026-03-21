import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Download, ExternalLink, MessageCircle, Share, Smartphone, MoreVertical, Users, Check, Wrench, QrCode, Link2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

interface LinksInstalacaoPageProps {
  vendedor?: { nome: string; slug: string; codigo: string } | null;
  isAdminView?: boolean;
}

export function LinksInstalacaoPage({ vendedor, isAdminView = false }: LinksInstalacaoPageProps) {
  const { isInstalled, canInstall, promptInstall } = usePWAInstall();
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrData, setQrData] = useState<{ slug: string; type: "form" | "wa" } | null>(null);

  const { data: consultores = [], isLoading } = useQuery({
    queryKey: ["links-instalacao-consultores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultores")
        .select("id, nome, slug, codigo")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: !vendedor && isAdminView,
    staleTime: 30 * 1000,
  });

  const appUrl = getPublicUrl();
  const installUrl = `${appUrl}/instalar`;
  const waAppUrl = `${appUrl}/app`;
  const sistemaAppUrl = `${appUrl}/sistema`;
  const instaladorAppUrl = `${appUrl}/instalador`;
  const checklistUrl = `${appUrl}/checklist`;
  const avaliacaoUrl = `${appUrl}/avaliacao`;
  const calculadoraUrl = `${appUrl}/calculadora`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const vendorList = vendedor ? [vendedor] : (isAdminView ? consultores : []);

  const activeQrConsultor = qrData
    ? vendorList.find((c) => (c.slug || c.codigo) === qrData.slug)
    : null;
  const qrLink = qrData
    ? `${appUrl}/${qrData.type === "wa" ? "w" : "v"}/${qrData.slug}`
    : "";

  if (isLoading && isAdminView && !vendedor) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-56" />
            <Skeleton className="h-4 w-72 mt-1" />
          </div>
        </div>
        <Skeleton className="h-10 w-full rounded-lg" />
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Link2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              {vendedor ? "Meus Links" : "Links & Captação"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {vendedor
                ? "Seus links exclusivos para captar leads"
                : "Links de captação por consultor e instalação do app"
              }
            </p>
          </div>
        </div>
      </div>

      {/* §29 Tabs after header */}
      <Tabs defaultValue="form" className="w-full">
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="form" className="gap-1.5 text-xs sm:text-sm">
            <Users className="h-3.5 w-3.5" />
            Formulário
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5 text-xs sm:text-sm">
            <MessageCircle className="h-3.5 w-3.5" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="pwa" className="gap-1.5 text-xs sm:text-sm">
            <Smartphone className="h-3.5 w-3.5" />
            App PWA
          </TabsTrigger>
        </TabsList>

        {/* ── Tab: Formulário (/v/:slug) ── */}
        <TabsContent value="form">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {vendedor ? "Meu Link de Cadastro" : "Links de Cadastro de Leads"}
              </CardTitle>
              <CardDescription>
                {vendedor
                  ? "Seu link único para captar leads via formulário."
                  : "Cada consultor tem um link exclusivo. Leads são atribuídos diretamente."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ConsultorLinkList
                vendorList={vendorList}
                appUrl={appUrl}
                prefix="v"
                copiedId={copiedId}
                onCopy={handleCopy}
                onQr={(slug) => setQrData({ slug, type: "form" })}
                shareText={(link) => `Solicite seu orçamento de energia solar: ${link}`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: WhatsApp (/w/:slug) ── */}
        <TabsContent value="whatsapp">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="border-b border-border pb-3">
              <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                {vendedor ? "Meu Link WhatsApp" : "Links WhatsApp por Consultor"}
              </CardTitle>
              <CardDescription>
                {vendedor
                  ? "Seu link para clientes iniciarem conversa pelo WhatsApp."
                  : "Cada consultor tem um link WhatsApp exclusivo. A conversa é atribuída automaticamente."
                }
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <ConsultorLinkList
                vendorList={vendorList}
                appUrl={appUrl}
                prefix="w"
                copiedId={copiedId}
                onCopy={handleCopy}
                onQr={(slug) => setQrData({ slug, type: "wa" })}
                shareText={(link) => `Fale comigo pelo WhatsApp: ${link}`}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tab: App PWA ── */}
        <TabsContent value="pwa">
          <div className="space-y-6">
            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                  Instalar App no Celular
                </CardTitle>
                <CardDescription>
                  Instale o aplicativo no celular para acesso rápido
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-4">
                <div className="flex gap-2">
                  <Input readOnly value={installUrl} className="bg-muted/50 font-mono text-sm" />
                  <Button variant="outline" onClick={() => handleCopy(installUrl, "install")} className="shrink-0 gap-2">
                    {copiedId === "install" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    Copiar
                  </Button>
                </div>
                {isInstalled ? (
                  <p className="text-sm text-success font-medium">✅ App já está instalado neste dispositivo</p>
                ) : canInstall ? (
                  <Button onClick={() => promptInstall()} className="gap-2">
                    <Download className="h-4 w-4" />
                    Instalar Agora
                  </Button>
                ) : (
                  <div className="text-sm text-muted-foreground space-y-1">
                    <p className="font-medium text-foreground">Como instalar:</p>
                    <ul className="list-disc list-inside space-y-1 text-xs">
                      <li><strong>iPhone/iPad:</strong> Abra no Safari → toque em <Share className="inline h-3 w-3" /> Compartilhar → "Adicionar à Tela Inicial"</li>
                      <li><strong>Android:</strong> Abra no Chrome → toque em <MoreVertical className="inline h-3 w-3" /> menu → "Instalar app"</li>
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border shadow-sm">
              <CardHeader className="border-b border-border pb-3">
                <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Apps PWA
                </CardTitle>
                <CardDescription>
                  Links diretos para instalar cada app no celular
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pt-4">
                <PwaAppRow
                  icon={<MessageCircle className="h-5 w-5 text-success" />}
                  label="📱 Mensagens WhatsApp"
                  url={waAppUrl}
                  copiedId={copiedId}
                  copyKey="wa-pwa"
                  onCopy={handleCopy}
                  bgClass="bg-success/10"
                />
                <PwaAppRow
                  icon={<Smartphone className="h-5 w-5 text-primary" />}
                  label="🏢 Sistema Completo"
                  url={sistemaAppUrl}
                  copiedId={copiedId}
                  copyKey="sistema-pwa"
                  onCopy={handleCopy}
                  bgClass="bg-primary/10"
                />
                {isAdminView && (
                  <PwaAppRow
                    icon={<Wrench className="h-5 w-5 text-warning" />}
                    label="🔧 Portal do Instalador"
                    url={instaladorAppUrl}
                    copiedId={copiedId}
                    copyKey="inst-pwa"
                    onCopy={handleCopy}
                    bgClass="bg-warning/10"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* QR Code Dialog */}
      <Dialog open={!!qrData} onOpenChange={(open) => !open && setQrData(null)}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <QrCode className="h-5 w-5 text-primary" />
              QR Code — {activeQrConsultor?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-background p-4 rounded-xl border border-border">
              <QRCodeSVG value={qrLink} size={220} level="M" />
            </div>
            <p className="text-xs text-muted-foreground font-mono text-center break-all max-w-[280px]">{qrLink}</p>
            <Button variant="outline" size="sm" onClick={() => handleCopy(qrLink, "qr-link")} className="gap-2">
              {copiedId === "qr-link" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              Copiar Link
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}

/* ── Sub-components ── */

interface ConsultorLinkListProps {
  vendorList: { nome: string; slug?: string | null; codigo: string }[];
  appUrl: string;
  prefix: "v" | "w";
  copiedId: string | null;
  onCopy: (text: string, id: string) => void;
  onQr: (slug: string) => void;
  shareText: (link: string) => string;
}

function ConsultorLinkList({ vendorList, appUrl, prefix, copiedId, onCopy, onQr, shareText }: ConsultorLinkListProps) {
  if (vendorList.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm font-medium text-muted-foreground">Nenhum consultor ativo encontrado</p>
        <p className="text-xs text-muted-foreground/70 mt-1">Cadastre consultores para gerar links de captação</p>
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {vendorList.map((v) => {
        const slug = v.slug || v.codigo;
        const link = `${appUrl}/${prefix}/${slug}`;
        const id = `${prefix}-${slug}`;
        return (
          <div key={slug} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{v.nome}</p>
              <p className="text-xs text-muted-foreground font-mono truncate">{link}</p>
            </div>
            <div className="flex gap-1 shrink-0">
              <Button variant="outline" size="sm" title="Copiar" onClick={() => onCopy(link, id)}>
                {copiedId === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <Button variant="outline" size="sm" title="QR Code" onClick={() => onQr(slug)}>
                <QrCode className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" title="Compartilhar via WhatsApp" onClick={() => {
                const waText = encodeURIComponent(shareText(link));
                window.open(`https://wa.me/?text=${waText}`, "_blank");
              }}>
                <MessageCircle className="h-3.5 w-3.5" />
              </Button>
              <Button variant="outline" size="sm" title="Abrir" onClick={() => window.open(link, "_blank")}>
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PwaAppRowProps {
  icon: React.ReactNode;
  label: string;
  url: string;
  copiedId: string | null;
  copyKey: string;
  onCopy: (text: string, id: string) => void;
  bgClass?: string;
}

function PwaAppRow({ icon, label, url, copiedId, copyKey, onCopy, bgClass = "bg-primary/10" }: PwaAppRowProps) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/50 hover:bg-muted transition-colors">
      <div className={`h-10 w-10 rounded-lg ${bgClass} flex items-center justify-center shrink-0`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground font-mono truncate">{url}</p>
      </div>
      <div className="flex gap-1 shrink-0">
        <Button variant="outline" size="sm" onClick={() => onCopy(url, copyKey)}>
          {copiedId === copyKey ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        </Button>
        <Button variant="outline" size="sm" onClick={() => window.open(url, "_blank")}>
          <ExternalLink className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
