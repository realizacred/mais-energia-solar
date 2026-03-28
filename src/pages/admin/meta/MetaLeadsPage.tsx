import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, ExternalLink } from "lucide-react";
import { formatDateTime } from "@/lib/formatters/index";
import { MetaNavTabs } from "@/components/admin/meta/MetaNavTabs";
import { SearchInput } from "@/components/ui-kit/SearchInput";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function useMetaLeads() {
  return useQuery({
    queryKey: ["meta-leads-list"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_leads")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  converted: "bg-success/15 text-success border-success/30",
  processed: "bg-primary/15 text-primary border-primary/30",
  duplicate: "bg-muted text-muted-foreground border-border",
  no_automation: "bg-muted text-muted-foreground border-border",
  crm_error: "bg-destructive/15 text-destructive border-destructive/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendente",
  converted: "Convertido",
  processed: "Processado",
  duplicate: "Duplicado",
  no_automation: "Sem automação",
  crm_error: "Erro CRM",
  error: "Erro",
};

type StatusFilter = "ALL" | "converted" | "pending" | "error" | "duplicate";

export default function MetaLeadsPage() {
  const { data: leads, isLoading } = useMetaLeads();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const filtered = useMemo(() => {
    let result = leads ?? [];
    if (statusFilter !== "ALL") {
      if (statusFilter === "error") {
        result = result.filter((l) => l.processing_status === "error" || l.processing_status === "crm_error");
      } else {
        result = result.filter((l) => l.processing_status === statusFilter);
      }
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (l) =>
          l.lead_name?.toLowerCase().includes(q) ||
          l.lead_email?.toLowerCase().includes(q) ||
          l.lead_phone?.includes(q)
      );
    }
    return result;
  }, [leads, statusFilter, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserPlus}
        title="Meta Ads — Leads"
        description="Leads capturados via Facebook Lead Ads"
      />

      <MetaNavTabs />

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex h-9 items-center rounded-md bg-muted p-1 text-muted-foreground">
          {(["ALL", "converted", "pending", "error", "duplicate"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium transition-all",
                statusFilter === s
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:bg-background/50 hover:text-foreground"
              )}
            >
              {s === "ALL" ? "Todos" : STATUS_LABELS[s] || s}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar por nome, email ou telefone..." />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !filtered.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <UserPlus className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>
              {leads?.length === 0
                ? "Nenhum lead recebido ainda. Os leads aparecerão automaticamente ao conectar o Facebook Ads."
                : "Nenhum lead encontrado com os filtros aplicados."}
            </p>
            {leads?.length === 0 && (
              <a href="/admin/meta-facebook-config" className="text-primary text-sm underline mt-1 inline-block">
                Configurar integração
              </a>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{filtered.length} leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Nome</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Telefone</th>
                    <th className="pb-2 font-medium">Campanha</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Recebido</th>
                    <th className="pb-2 w-10" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-medium">{lead.lead_name || "—"}</td>
                      <td className="py-2.5">{lead.lead_email || "—"}</td>
                      <td className="py-2.5 whitespace-nowrap">{lead.lead_phone || "—"}</td>
                      <td className="py-2.5 max-w-[150px] truncate text-muted-foreground">
                        {(lead as any).campaign_name || "—"}
                      </td>
                      <td className="py-2.5">
                        <Badge variant="outline" className={cn("text-[10px]", STATUS_COLORS[lead.processing_status] ?? "")}>
                          {STATUS_LABELS[lead.processing_status] || lead.processing_status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-muted-foreground whitespace-nowrap">
                        {formatDateTime(lead.received_at)}
                      </td>
                      <td className="py-2.5">
                        {lead.processing_status === "converted" && (lead as any).lead_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => window.open(`/admin/leads?id=${(lead as any).lead_id}`, "_blank")}
                            title="Ver no CRM"
                          >
                            <ExternalLink className="w-3.5 h-3.5 text-primary" />
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
