/**
 * WaConnectionCard — Shows WhatsApp connection status for vendors with a linked instance.
 * Allows generating QR Code to connect/reconnect.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { QrCode, Wifi, WifiOff, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { WaQRCodeDialog } from "@/components/admin/wa/WaQRCodeDialog";

export function WaConnectionCard() {
  const [showQR, setShowQR] = useState(false);

  const { data: instanceData, isLoading } = useQuery({
    queryKey: ["vendor-wa-instance"],
    queryFn: async () => {
      // Get current user's linked instances via wa_instance_consultores
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get consultor record for current user
      const { data: consultor } = await supabase
        .from("consultores")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!consultor) return null;

      // Get linked instances
      const { data: links } = await supabase
        .from("wa_instance_consultores")
        .select("instance_id")
        .eq("consultor_id", consultor.id);

      if (!links?.length) return null;

      // Get first linked instance details
      const { data: instance } = await supabase
        .from("wa_instances")
        .select("id, nome, status, phone_number, profile_name")
        .eq("id", links[0].instance_id)
        .single();

      return instance;
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
        <CardContent className="flex items-center gap-4 p-5">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // Don't render if no linked instance
  if (!instanceData) return null;

  const isConnected = instanceData.status === "connected";

  return (
    <>
      <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Smartphone className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">
                Conexão WhatsApp
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="outline"
                  className={`text-xs gap-1.5 ${
                    isConnected
                      ? "bg-success/10 text-success border-success/20"
                      : "bg-muted text-muted-foreground border-border"
                  }`}
                >
                  {isConnected ? (
                    <Wifi className="h-3 w-3" />
                  ) : (
                    <WifiOff className="h-3 w-3" />
                  )}
                  {isConnected ? "Conectado" : "Desconectado"}
                </Badge>
                {instanceData.profile_name && (
                  <span className="text-xs text-muted-foreground">{instanceData.profile_name}</span>
                )}
              </div>
            </div>
          </div>
          {!isConnected && (
            <Button variant="outline" size="sm" onClick={() => setShowQR(true)} className="gap-2 shrink-0">
              <QrCode className="h-4 w-4" />
              Gerar QR Code
            </Button>
          )}
        </CardContent>
      </Card>

      <WaQRCodeDialog
        open={showQR}
        onOpenChange={setShowQR}
        instanceId={instanceData.id}
        instanceName={instanceData.nome}
      />
    </>
  );
}
