/**
 * WaQRCodeDialog — Reusable QR Code dialog for connecting WhatsApp instances.
 * Can be used from WaInstancesManager (admin) or VendorDashboardView (editor).
 */
import { useState, useEffect, useRef } from "react";
import { QrCode, RefreshCw, Check, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

interface WaQRCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  instanceId: string;
  instanceName?: string;
}

export function WaQRCodeDialog({ open, onOpenChange, instanceId, instanceName }: WaQRCodeDialogProps) {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [qrStatus, setQrStatus] = useState<"loading" | "waiting" | "connected" | "expired" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const cleanup = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    pollingRef.current = null;
    timeoutRef.current = null;
  };

  useEffect(() => {
    if (open && instanceId) {
      fetchQrCode();
    } else {
      cleanup();
      setQrCode(null);
      setQrStatus("loading");
      setErrorMsg(null);
    }
    return cleanup;
  }, [open, instanceId]);

  const fetchQrCode = async () => {
    cleanup();
    setQrStatus("loading");
    setQrCode(null);
    setErrorMsg(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Sessão inválida");

      const { data, error } = await supabase.functions.invoke("get-wa-qrcode", {
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: { instance_id: instanceId },
      });

      if (error) throw error;

      if (data?.status === "open") {
        setQrStatus("connected");
        queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
        return;
      }

      if (data?.qr_code_base64) {
        setQrCode(data.qr_code_base64);
        setQrStatus("waiting");
        startPolling();
      } else {
        setQrStatus("error");
        setErrorMsg("Não foi possível gerar o QR Code. Verifique se a instância existe na Evolution API.");
      }
    } catch (e: any) {
      console.error("[WaQRCodeDialog]", e);
      setQrStatus("error");
      setErrorMsg(e.message || "Erro ao buscar QR Code");
    }
  };

  const startPolling = () => {
    pollingRef.current = setInterval(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const { data, error } = await supabase.functions.invoke("get-wa-qrcode", {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: { instance_id: instanceId },
        });

        if (error) return;

        if (data?.status === "open") {
          setQrStatus("connected");
          cleanup();
          queryClient.invalidateQueries({ queryKey: ["wa-instances"] });
          toast({ title: "✅ WhatsApp conectado!" });
          setTimeout(() => onOpenChange(false), 2000);
          return;
        }

        if (data?.qr_code_base64) {
          setQrCode(data.qr_code_base64);
        }
      } catch (e) {
        console.warn("[WaQRCodeDialog polling]", e);
      }
    }, 3000);

    timeoutRef.current = setTimeout(() => {
      if (pollingRef.current) clearInterval(pollingRef.current);
      pollingRef.current = null;
      setQrStatus("expired");
    }, 60000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Conectar WhatsApp
            </DialogTitle>
            {instanceName && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Instância: {instanceName}
              </p>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 p-5 flex-1 min-h-0">
          {qrStatus === "connected" ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center">
                <Check className="w-8 h-8 text-success" />
              </div>
              <p className="text-lg font-semibold text-foreground">WhatsApp conectado!</p>
              <p className="text-sm text-muted-foreground">Fechando automaticamente...</p>
            </div>
          ) : qrStatus === "expired" ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
                <RefreshCw className="w-8 h-8 text-warning" />
              </div>
              <p className="text-sm font-semibold text-foreground">QR Code expirado</p>
              <p className="text-xs text-muted-foreground text-center">
                O tempo de escaneamento expirou. Clique abaixo para gerar um novo QR Code.
              </p>
              <Button variant="outline" onClick={fetchQrCode} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Gerar Novo QR Code
              </Button>
            </div>
          ) : qrStatus === "error" ? (
            <div className="flex flex-col items-center gap-3 py-6">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <Wifi className="w-8 h-8 text-destructive" />
              </div>
              <p className="text-sm font-semibold text-foreground">Erro ao gerar QR Code</p>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                {errorMsg || "Não foi possível conectar. Tente novamente."}
              </p>
              <Button variant="outline" onClick={fetchQrCode} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Tentar Novamente
              </Button>
            </div>
          ) : qrStatus === "loading" ? (
            <div className="w-64 h-64 rounded-xl border border-border bg-muted/30 flex items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <>
              {qrCode ? (
                <div className="rounded-xl border border-border bg-background p-3">
                  <img
                    src={qrCode.startsWith("data:") ? qrCode : `data:image/png;base64,${qrCode}`}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64 object-contain"
                  />
                </div>
              ) : (
                <div className="w-64 h-64 rounded-xl border border-border bg-muted/30 flex items-center justify-center">
                  <Spinner size="lg" />
                </div>
              )}
              <div className="flex items-center gap-2">
                <Spinner size="sm" />
                <p className="text-sm text-muted-foreground">Aguardando escaneamento...</p>
              </div>
              <p className="text-xs text-muted-foreground text-center max-w-xs">
                Abra o WhatsApp no celular → Configurações → Aparelhos conectados → Conectar aparelho → Escaneie o QR Code acima
              </p>
            </>
          )}
        </div>

        <div className="flex justify-end p-4 border-t border-border bg-muted/30">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
