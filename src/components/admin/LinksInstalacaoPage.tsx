import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Download, ExternalLink, MessageCircle, Share, Smartphone, MoreVertical, Users, Check } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface LinksInstalacaoPageProps {
  /** Pass vendedor data to show only that vendor's link */
  vendedor?: { nome: string; slug: string; codigo: string } | null;
}

export function LinksInstalacaoPage({ vendedor }: LinksInstalacaoPageProps) {
  const { isInstalled, isIOS, isAndroid, canInstall, promptInstall } = usePWAInstall();
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // In admin mode (no vendedor prop), load all vendedores
  const { data: vendedores = [] } = useQuery({
    queryKey: ["vendedores-links"],
    queryFn: async () => {
      const { data } = await supabase
        .from("vendedores")
        .select("id, nome, slug, codigo")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    enabled: !vendedor,
    staleTime: 5 * 60 * 1000,
  });

  const appUrl = window.location.origin;
  const installUrl = `${appUrl}/instalar`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleInstallClick = async () => {
    if (canInstall) {
      await promptInstall();
    }
  };

  const vendorList = vendedor ? [vendedor] : vendedores;

  return (
    <div className="space-y-6">
      {/* PWA Install Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            Instalar App no Celular
          </CardTitle>
          <CardDescription>
            Instale o aplicativo no celular para acesso rápido ao WhatsApp, leads e mais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input readOnly value={installUrl} className="bg-muted/50 font-mono text-sm" />
            <Button
              variant="secondary"
              onClick={() => handleCopy(installUrl, "install")}
              className="shrink-0"
            >
              {copiedId === "install" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
              Copiar
            </Button>
          </div>

          {isInstalled ? (
            <p className="text-sm text-success font-medium">✅ App já está instalado neste dispositivo</p>
          ) : canInstall ? (
            <Button onClick={handleInstallClick} className="gap-2">
              <Download className="h-4 w-4" />
              Instalar Agora
            </Button>
          ) : (
            <div className="text-sm text-muted-foreground space-y-1">
              <p className="font-medium">Como instalar:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>iPhone/iPad:</strong> Abra no Safari → toque em <Share className="inline h-3 w-3" /> Compartilhar → "Adicionar à Tela Inicial"</li>
                <li><strong>Android:</strong> Abra no Chrome → toque em <MoreVertical className="inline h-3 w-3" /> menu → "Instalar app"</li>
              </ul>
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Envie o link acima para qualquer vendedor ou membro da equipe. Ao abrir no celular, poderão instalar o app.
          </p>
        </CardContent>
      </Card>

      {/* Vendor Lead Links Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Links de Cadastro de Leads
          </CardTitle>
          <CardDescription>
            Cada vendedor tem um link único para captar leads. Compartilhe com clientes via WhatsApp ou redes sociais.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {vendorList.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum consultor ativo encontrado.</p>
          ) : (
            <div className="space-y-3">
              {vendorList.map((v) => {
                const slug = v.slug || v.codigo;
                const leadLink = `${appUrl}/v/${slug}`;
                const id = `lead-${slug}`;
                return (
                  <div key={slug} className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{v.nome}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">{leadLink}</p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(leadLink, id)}
                      >
                        {copiedId === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const waText = encodeURIComponent(`Solicite seu orçamento de energia solar: ${leadLink}`);
                          window.open(`https://wa.me/?text=${waText}`, "_blank");
                        }}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(leadLink, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
