/**
 * SuperAdminWebhooksPage — Visão global de webhooks de billing (PR-2).
 * Permite replay individual via super-admin-action.
 */
import { useState } from "react";
import { Webhook as WebhookIcon, Filter } from "lucide-react";
import { PageHeader, StatCard, SectionCard, StatusBadge, EmptyState, LoadingState } from "@/components/ui-kit";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useGlobalWebhookEvents, useBillingAction } from "@/hooks/super-admin/useSuperAdminBilling";
import { formatDateTime } from "@/lib/dateUtils";

const VARIANT: Record<string, any> = {
  received: "info", processed: "success", failed: "destructive", replayed: "info",
};
const PROVIDERS = ["asaas", "stripe", "mercadopago"];
const STATUSES = ["received", "processed", "failed", "replayed"];

export default function SuperAdminWebhooksPage() {
  const [provider, setProvider] = useState<string>("");
  const [status, setStatus] = useState<string>("");
  const [payload, setPayload] = useState<any>(null);

  const { data = [], isLoading, error } = useGlobalWebhookEvents(provider || undefined, status || undefined);
  const replay = useBillingAction("replay_webhook", "Webhook reprocessado");

  const total = data.length;
  const failed = data.filter((w: any) => w.status === "failed").length;
  const replayed = data.filter((w: any) => w.status === "replayed").length;

  return (
    <div className="space-y-6">
      <PageHeader icon={WebhookIcon} title="Webhooks" description="Eventos de billing recebidos e replay manual" />

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={WebhookIcon} label="Eventos" value={total} color="primary" />
        <StatCard icon={WebhookIcon} label="Falhas" value={failed} color="destructive" />
        <StatCard icon={WebhookIcon} label="Reprocessados" value={replayed} color="info" />
      </div>

      <SectionCard
        icon={Filter}
        title="Eventos"
        actions={
          <div className="flex gap-2">
            <Select value={provider || "all"} onValueChange={(v) => setProvider(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Provider" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos providers</SelectItem>
                {PROVIDERS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
              <SelectTrigger className="w-36"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos status</SelectItem>
                {STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {isLoading ? <LoadingState message="Carregando..." />
          : error ? <EmptyState icon={WebhookIcon} title="Erro" description={String((error as any).message)} />
          : data.length === 0 ? <EmptyState icon={WebhookIcon} title="Sem eventos" description="Nenhum webhook encontrado." />
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Recebido</TableHead>
                  <TableHead>Tenant</TableHead>
                  <TableHead>Provider</TableHead>
                  <TableHead>Evento</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Erro</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((w: any) => (
                  <TableRow key={w.id}>
                    <TableCell className="text-xs">{formatDateTime(w.received_at)}</TableCell>
                    <TableCell>{w.tenant_name ?? "—"}</TableCell>
                    <TableCell>{w.provider}</TableCell>
                    <TableCell className="font-mono text-xs">{w.event_type ?? "—"}</TableCell>
                    <TableCell><StatusBadge variant={VARIANT[w.status] ?? "muted"} dot>{w.status}</StatusBadge></TableCell>
                    <TableCell className="text-xs text-destructive max-w-xs truncate">{w.error_message ?? ""}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => setPayload(w)}>Payload</Button>
                      <Button size="sm" variant="outline" disabled={replay.isPending}
                        onClick={() => replay.mutate({ webhook_event_id: w.id })}>
                        Replay
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
      </SectionCard>

      <Dialog open={!!payload} onOpenChange={(o) => !o && setPayload(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Webhook payload</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-[60vh]">
            {payload ? JSON.stringify(payload, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </div>
  );
}
