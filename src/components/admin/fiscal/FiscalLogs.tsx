import { useState, useEffect } from "react";
import { FileText, Loader2, Search } from "lucide-react";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

export function FiscalLogs() {
  const [activeTab, setActiveTab] = useState<"requests" | "webhooks">("requests");
  const [requests, setRequests] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [reqRes, whRes] = await Promise.all([
      supabase.from("fiscal_provider_requests")
        .select("id, endpoint, method, response_status, duration_ms, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("fiscal_provider_webhooks")
        .select("id, event_type, processed, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setRequests(reqRes.data || []);
    setWebhooks(whRes.data || []);
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Tab switcher */}
      <div className="flex gap-2">
        <button onClick={() => setActiveTab("requests")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "requests" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          Requests ({requests.length})
        </button>
        <button onClick={() => setActiveTab("webhooks")} className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${activeTab === "webhooks" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
          Webhooks ({webhooks.length})
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : activeTab === "requests" ? (
        requests.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum request registrado" description="Logs de chamadas à API Asaas aparecerão aqui." />
        ) : (
          <div className="space-y-1.5">
            {requests.filter(r => !search || r.endpoint?.includes(search)).map(r => (
              <div key={r.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 text-sm">
                <Badge variant="outline" className="text-[9px] font-mono shrink-0">{r.method}</Badge>
                <span className="font-mono text-xs truncate flex-1">{r.endpoint}</span>
                <Badge variant={r.response_status && r.response_status < 400 ? "default" : "destructive"} className="text-[9px]">{r.response_status || "?"}</Badge>
                {r.duration_ms && <span className="text-[10px] text-muted-foreground">{r.duration_ms}ms</span>}
                <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(r.created_at), "dd/MM HH:mm")}</span>
              </div>
            ))}
          </div>
        )
      ) : (
        webhooks.length === 0 ? (
          <EmptyState icon={FileText} title="Nenhum webhook recebido" description="Eventos de nota fiscal do Asaas aparecerão aqui." />
        ) : (
          <div className="space-y-1.5">
            {webhooks.filter(w => !search || w.event_type?.includes(search)).map(w => (
              <div key={w.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-muted/30 text-sm">
                <span className="font-mono text-xs truncate flex-1">{w.event_type || "unknown"}</span>
                <Badge variant={w.processed ? "default" : "outline"} className="text-[9px]">{w.processed ? "Processado" : "Pendente"}</Badge>
                {w.error_message && <span className="text-[10px] text-destructive truncate max-w-[120px]">{w.error_message}</span>}
                <span className="text-[10px] text-muted-foreground shrink-0">{format(new Date(w.created_at), "dd/MM HH:mm")}</span>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
