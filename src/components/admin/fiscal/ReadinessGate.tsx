import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, XCircle, Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface ReadinessItem {
  key: string;
  label: string;
  status: "green" | "yellow" | "red";
  message: string;
}

interface ReadinessData {
  overall: "green" | "yellow" | "red";
  items: ReadinessItem[];
  can_issue: boolean;
}

export function ReadinessGate({ onStatusChange }: { onStatusChange?: (canIssue: boolean) => void }) {
  const [data, setData] = useState<ReadinessData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("fiscal-readiness-status");
      if (error) throw error;
      setData(result);
      onStatusChange?.(result.can_issue);
    } catch (e) {
      console.error("ReadinessGate error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStatus(); }, []);

  const statusIcon = (s: string) => {
    if (s === "green") return <CheckCircle2 className="h-4 w-4 text-success" />;
    if (s === "yellow") return <AlertTriangle className="h-4 w-4 text-warning" />;
    return <XCircle className="h-4 w-4 text-destructive" />;
  };

  const overallBg = data?.overall === "green" ? "bg-success/10 border-success/30" : data?.overall === "yellow" ? "bg-warning/10 border-warning/30" : "bg-destructive/10 border-destructive/30";

  if (loading) return <div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-3">
      <div className={cn("flex items-center justify-between p-3 rounded-lg border", overallBg)}>
        <div className="flex items-center gap-2">
          {statusIcon(data?.overall || "red")}
          <span className="text-sm font-semibold">
            {data?.overall === "green" ? "Pronto para emitir" : data?.overall === "yellow" ? "Atenção: itens pendentes" : "Bloqueado: itens obrigatórios"}
          </span>
        </div>
        <Button variant="ghost" size="sm" onClick={fetchStatus} className="gap-1.5">
          <RefreshCw className="h-3.5 w-3.5" /> Atualizar
        </Button>
      </div>

      <div className="space-y-1.5">
        {data?.items.map((item) => (
          <div key={item.key} className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30">
            {statusIcon(item.status)}
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium">{item.label}</span>
              <p className="text-xs text-muted-foreground truncate">{item.message}</p>
            </div>
            <Badge variant="outline" className={cn("text-[10px]",
              item.status === "green" ? "border-success/40 text-success" :
              item.status === "yellow" ? "border-warning/40 text-warning" :
              "border-destructive/40 text-destructive"
            )}>
              {item.status === "green" ? "OK" : item.status === "yellow" ? "Alerta" : "Bloqueio"}
            </Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
