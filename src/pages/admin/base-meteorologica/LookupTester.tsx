/**
 * LookupTester — Tests irradiance lookup against active version via canonical RPC.
 * Displays version used + data for reproducibility audit.
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { VersionRow } from "./types";
import { BRASILIA } from "./types";

interface LookupTesterProps {
  activeVersion: VersionRow | undefined;
}

export function LookupTester({ activeVersion }: LookupTesterProps) {
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const handleTest = async () => {
    if (!activeVersion) {
      toast.error("Nenhuma versão ativa para testar.");
      return;
    }
    setTesting(true);
    setResult(null);
    setError("");
    try {
      const { data, error: rpcError } = await supabase.rpc("get_irradiance_for_simulation", {
        _version_id: activeVersion.id,
        _lat: BRASILIA.lat,
        _lon: BRASILIA.lon,
        _radius_deg: 0.3,
      });
      if (rpcError) throw rpcError;
      setResult(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleTest}
        disabled={testing || !activeVersion}
        className="gap-1.5 text-xs"
      >
        {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MapPin className="h-3.5 w-3.5" />}
        Testar Lookup (Brasília)
      </Button>

      {error && (
        <div className="p-2 rounded bg-destructive/5 border border-destructive/20 text-xs text-destructive">
          ❌ {error}
        </div>
      )}

      {result && (
        <div className="p-2 rounded bg-muted/30 border border-border/40">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Resultado — Brasília ({BRASILIA.lat}, {BRASILIA.lon})
            </p>
            {result.version_id && (
              <Badge variant="outline" className="text-[9px]">
                v: {result.version_tag ?? result.version_id?.slice(0, 8)}
              </Badge>
            )}
          </div>
          <ScrollArea className="max-h-40">
            <pre className="text-[10px] font-mono text-foreground whitespace-pre-wrap">
              {JSON.stringify(result, null, 2)}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  );
}
