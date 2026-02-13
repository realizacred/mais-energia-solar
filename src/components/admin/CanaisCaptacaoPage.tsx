import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, ExternalLink, MessageCircle, QrCode, Users, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QRCodeSVG } from "qrcode.react";

export function CanaisCaptacaoPage() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [qrSlug, setQrSlug] = useState<string | null>(null);

  const { data: consultores = [] } = useQuery({
    queryKey: ["canais-captacao-consultores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("consultores")
        .select("id, nome, slug, codigo, ativo")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  const appUrl = window.location.origin;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Link copiado!");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const activeConsultor = consultores.find((c) => c.slug === qrSlug || c.codigo === qrSlug);
  const qrLink = qrSlug ? `${appUrl}/v/${qrSlug}` : "";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Canais de Captação
          </CardTitle>
          <CardDescription>
            Cada consultor possui um link exclusivo para captar leads. Leads criados por esse link são atribuídos diretamente ao consultor, sem passar pela fila.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {consultores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum consultor ativo encontrado.</p>
          ) : (
            <div className="space-y-3">
              {consultores.map((v) => {
                const slug = v.slug || v.codigo;
                const leadLink = `${appUrl}/v/${slug}`;
                const id = `canal-${slug}`;
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
                        title="Copiar link"
                        onClick={() => handleCopy(leadLink, id)}
                      >
                        {copiedId === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Gerar QR Code"
                        onClick={() => setQrSlug(slug)}
                      >
                        <QrCode className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        title="Compartilhar via WhatsApp"
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
                        title="Abrir link"
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

      {/* QR Code Dialog */}
      <Dialog open={!!qrSlug} onOpenChange={(open) => !open && setQrSlug(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5" />
              QR Code — {activeConsultor?.nome}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={qrLink} size={220} level="M" />
            </div>
            <p className="text-xs text-muted-foreground font-mono text-center break-all max-w-[280px]">
              {qrLink}
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => handleCopy(qrLink, "qr-link")}
              >
                {copiedId === "qr-link" ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                Copiar Link
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
