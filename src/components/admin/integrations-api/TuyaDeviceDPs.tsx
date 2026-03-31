/**
 * TuyaDeviceDPs — Dynamic Data Points listing for Tuya devices.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { tuyaIntegrationService } from "@/services/tuyaIntegrationService";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Cpu, RefreshCw, Loader2 } from "lucide-react";

interface Props {
  configId: string;
}

export function TuyaDeviceDPs({ configId }: Props) {
  const [loadingDPs, setLoadingDPs] = useState(false);
  const [dps, setDps] = useState<any[] | null>(null);

  const { data: meters = [] } = useQuery({
    queryKey: ["tuya_meters_for_dps", configId],
    queryFn: async () => {
      const { data } = await supabase
        .from("meter_devices")
        .select("id, external_device_id, name")
        .eq("integration_config_id", configId)
        .eq("is_active", true)
        .limit(10);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });

  async function fetchDPs(deviceExternalId: string) {
    setLoadingDPs(true);
    try {
      const resp = await tuyaIntegrationService.getDeviceFunctions(configId, deviceExternalId);
      const fns = resp?.result?.functions || resp?.functions || [];
      // console.log("[TuyaDeviceDPs] response:", JSON.stringify(resp).slice(0, 500), "DPs found:", fns.length);
      setDps(fns);
    } catch (err) {
      console.error("[TuyaDeviceDPs] error:", err);
      setDps([]);
    } finally {
      setLoadingDPs(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5" /> Data Points (DPs) do Dispositivo
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {meters.length === 0 ? (
          <p className="text-xs text-muted-foreground">Nenhum medidor importado. Importe primeiro.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {meters.map(m => (
              <Button
                key={m.id}
                variant="outline"
                size="sm"
                className="text-xs"
                disabled={loadingDPs}
                onClick={() => fetchDPs(m.external_device_id)}
              >
                {loadingDPs ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                {m.name}
              </Button>
            ))}
          </div>
        )}

        {loadingDPs && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full rounded" />
            ))}
          </div>
        )}

        {dps && !loadingDPs && (
          <div className="space-y-2">
            {dps.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum DP encontrado para este dispositivo.</p>
            ) : (
              dps.map((dp: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-xs border-b border-border pb-2 last:border-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] font-mono">{dp.code}</Badge>
                    <span className="text-muted-foreground">{dp.name || dp.code}</span>
                    {dp.rw === "rw" && <Badge className="text-[9px] bg-primary/10 text-primary border-primary/20">escrita</Badge>}
                    {dp.rw === "ro" && <Badge variant="secondary" className="text-[9px]">leitura</Badge>}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">{dp.type || "—"}</Badge>
                    {dp.values && (
                      <span className="text-[10px] text-muted-foreground max-w-[200px] truncate">
                        {typeof dp.values === "string" ? dp.values : JSON.stringify(dp.values)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
