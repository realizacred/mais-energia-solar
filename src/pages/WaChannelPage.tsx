import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MessageCircle, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function WaChannelPage() {
  const { slug } = useParams<{ slug: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["wa-channel", slug],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("resolve-wa-channel", {
        body: { slug },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        consultor_nome: string;
        slug: string;
        phone_number: string;
        tenant_id: string;
      };
    },
    enabled: !!slug,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });

  const waUrl = data
    ? `https://wa.me/${data.phone_number}?text=${encodeURIComponent(
        `Olá! Vim pelo link do consultor ${data.consultor_nome}. #CANAL:${data.slug}`
      )}`
    : null;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted/30 p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        {isLoading && (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Carregando...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center gap-3">
            <AlertCircle className="h-10 w-10 text-destructive/60" />
            <p className="text-sm text-destructive font-medium">Consultor não encontrado</p>
            <p className="text-xs text-muted-foreground">Verifique o link e tente novamente.</p>
          </div>
        )}

        {data && waUrl && (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center">
              <MessageCircle className="h-8 w-8 text-success" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Fale com {data.consultor_nome}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Clique abaixo para iniciar uma conversa pelo WhatsApp
              </p>
            </div>
            <Button
              size="lg"
              className="w-full bg-success hover:bg-success/90 text-white gap-2 text-base py-6"
              onClick={() => window.open(waUrl, "_blank")}
            >
              <MessageCircle className="h-5 w-5" />
              Abrir WhatsApp
            </Button>
            <p className="text-[10px] text-muted-foreground/60">
              Atendimento via WhatsApp
            </p>
          </>
        )}
      </div>
    </div>
  );
}
