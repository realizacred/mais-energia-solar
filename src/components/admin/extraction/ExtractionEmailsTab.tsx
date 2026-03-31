/**
 * ExtractionEmailsTab — Lista de emails recebidos (email_ingestion_messages).
 * §26: Header. §27: KPI cards. §4: Table. §12: Skeleton.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Mail, CheckCircle2, AlertTriangle, Inbox } from "lucide-react";
import { format, subDays } from "date-fns";

interface EmailMessage {
  id: string;
  sender: string | null;
  subject: string | null;
  received_at: string | null;
  created_at: string;
  result_status: string;
  attachment_count: number | null;
  error_message: string | null;
  external_message_id: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  imported: { label: "Processado", className: "bg-success/10 text-success border-success/20" },
  duplicate: { label: "Duplicado", className: "bg-muted text-muted-foreground" },
  skipped: { label: "Pulado", className: "bg-warning/10 text-warning border-warning/20" },
  failed: { label: "Erro", className: "bg-destructive/10 text-destructive border-destructive/20" },
};

const STALE_TIME = 1000 * 60 * 5;

export function ExtractionEmailsTab() {
  const thirtyDaysAgo = subDays(new Date(), 30).toISOString();

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ["email_ingestion_messages", "last30d"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_ingestion_messages")
        .select("id, sender, subject, received_at, created_at, result_status, attachment_count, error_message, external_message_id")
        .gte("created_at", thirtyDaysAgo)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as EmailMessage[];
    },
    staleTime: STALE_TIME,
  });

  const totalReceived = messages.length;
  const successCount = messages.filter(m => m.result_status === "imported").length;
  const errorCount = messages.filter(m => m.result_status === "failed").length;

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : totalReceived}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Recebidos (30d)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : successCount}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Processados</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-destructive/10 text-destructive shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {isLoading ? <Skeleton className="h-8 w-12" /> : errorCount}
              </p>
              <p className="text-sm text-muted-foreground mt-1">Com erro</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <EmptyState
          icon={Mail}
          title="Nenhum e-mail processado"
          description="Os e-mails recebidos com faturas aparecerão aqui após a sincronização da conta de e-mail."
        />
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Data</TableHead>
                <TableHead className="font-semibold text-foreground">Remetente</TableHead>
                <TableHead className="font-semibold text-foreground">Assunto</TableHead>
                <TableHead className="font-semibold text-foreground">Anexos</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {messages.map(msg => {
                const statusInfo = STATUS_CONFIG[msg.result_status] || {
                  label: msg.result_status,
                  className: "",
                };
                const dateStr = msg.received_at || msg.created_at;
                return (
                  <TableRow key={msg.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {format(new Date(dateStr), "dd/MM/yy HH:mm")}
                    </TableCell>
                    <TableCell className="text-sm text-foreground max-w-[200px] truncate">
                      {msg.sender || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-foreground max-w-[250px] truncate">
                      {msg.subject || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {msg.attachment_count ?? 0}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${statusInfo.className}`}>
                        {statusInfo.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {msg.error_message || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
