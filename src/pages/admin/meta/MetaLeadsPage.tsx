import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserPlus } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

function useMetaLeads() {
  return useQuery({
    queryKey: ["meta-leads-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_leads")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });
}

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  processed: "bg-primary/15 text-primary border-primary/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function MetaLeadsPage() {
  const { data: leads, isLoading } = useMetaLeads();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={UserPlus}
        title="Meta Ads — Leads"
        description="Leads capturados via Facebook Lead Ads"
      />

      {isLoading ? (
        <Card className="animate-pulse"><CardContent className="p-6 h-40" /></Card>
      ) : !leads?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum lead capturado ainda. Configure o webhook na{" "}
            <a href="/admin/meta-facebook-config" className="underline text-primary">integração Meta</a>.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{leads.length} leads recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Nome</th>
                    <th className="pb-2 font-medium">Email</th>
                    <th className="pb-2 font-medium">Telefone</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Recebido</th>
                  </tr>
                </thead>
                <tbody>
                  {leads.map((lead) => (
                    <tr key={lead.id} className="border-b last:border-0">
                      <td className="py-2.5">{lead.lead_name || "—"}</td>
                      <td className="py-2.5">{lead.lead_email || "—"}</td>
                      <td className="py-2.5">{lead.lead_phone || "—"}</td>
                      <td className="py-2.5">
                        <Badge variant="outline" className={STATUS_COLORS[lead.processing_status] ?? ""}>
                          {lead.processing_status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-muted-foreground">
                        {format(new Date(lead.received_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
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
