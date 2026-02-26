import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, RefreshCw, ShieldCheck, ShieldX, Webhook, KeyRound, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  fetchMetaDiagnostics,
  type LeadAccessDiagnosticStatus,
  type MetaDiagnosticsResult,
  type TokenDiagnosticStatus,
  type WebhookDiagnosticStatus,
} from "@/services/metaDiagnosticsService";

function StatusPill({ status }: { status: TokenDiagnosticStatus | LeadAccessDiagnosticStatus | WebhookDiagnosticStatus }) {
  const cfg = {
    VALID: { label: "VALID", variant: "default" as const, icon: ShieldCheck, text: "text-success" },
    EXPIRED: { label: "EXPIRED", variant: "secondary" as const, icon: ShieldX, text: "text-warning" },
    INVALID: { label: "INVALID", variant: "destructive" as const, icon: ShieldX, text: "text-destructive" },
    GRANTED: { label: "GRANTED", variant: "default" as const, icon: ShieldCheck, text: "text-success" },
    REVOKED: { label: "REVOKED", variant: "destructive" as const, icon: ShieldX, text: "text-destructive" },
    SUBSCRIBED: { label: "SUBSCRIBED", variant: "default" as const, icon: Webhook, text: "text-success" },
    NOT_SUBSCRIBED: { label: "NOT_SUBSCRIBED", variant: "destructive" as const, icon: Webhook, text: "text-destructive" },
  }[status];

  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="gap-1.5">
      <Icon className={cn("h-3.5 w-3.5", cfg.text)} />
      {cfg.label}
    </Badge>
  );
}

function DiagnosticRow({
  title,
  status,
  message,
  details,
}: {
  title: string;
  status: TokenDiagnosticStatus | LeadAccessDiagnosticStatus | WebhookDiagnosticStatus;
  message: string;
  details?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border p-4 space-y-2">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground break-words">{message}</p>
        </div>
        <StatusPill status={status} />
      </div>
      {details}
    </div>
  );
}

function renderDetails(data: MetaDiagnosticsResult) {
  return (
    <div className="space-y-2">
      {data.statuses.lead_access.details?.slice(0, 5).map((page) => (
        <div key={page.page_id} className="text-xs rounded-md bg-muted/40 border px-2.5 py-2">
          <p className="font-medium text-foreground">{page.page_name} ({page.page_id})</p>
          <p className="text-muted-foreground">
            lead task: <strong>{page.has_lead_task ? "sim" : "não"}</strong> •
            retrieval: <strong>{page.retrieval_ok ? "ok" : "falhou"}</strong>
          </p>
          {page.error_message && <p className="text-destructive mt-1">{page.error_message}</p>}
        </div>
      ))}
    </div>
  );
}

export function MetaLeadAdsDiagnosticsCard() {
  const queryClient = useQueryClient();

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: ["meta-facebook-diagnostics"],
    queryFn: fetchMetaDiagnostics,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["meta-facebook-diagnostics"] });
    toast.success("Diagnóstico Meta atualizado");
  };

  return (
    <Card className="rounded-xl">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">Diagnóstico de Integração (Meta Lead Ads)</CardTitle>
            <CardDescription>
              Auditoria real de token, acesso a leads e assinatura de webhook (sem adivinhação).
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} />
            Verificar agora
          </Button>
        </div>

        <Alert>
          <KeyRound className="h-4 w-4" />
          <AlertTitle>Troubleshooting guiado</AlertTitle>
          <AlertDescription className="text-xs space-y-1 mt-1">
            <p>1) Remover apps antigos (Manychat/Kommo):</p>
            <p>• Página do Facebook → Configurações → Acesso a Leads → Remover CRM antigo.</p>
            <p>• Meta Business Suite → Integrações comerciais:</p>
            <a className="inline-flex items-center gap-1 text-primary underline" href="https://www.facebook.com/settings/?tab=business_tools" target="_blank" rel="noreferrer noopener">
              Abrir integrações comerciais <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <p className="pt-1">2) Adicionar este app no Lead Access Manager da Página e conceder acesso de lead.</p>
            <p>3) No Lead Ads Testing Tool, selecione Página + Formulário corretos e envie novo lead.</p>
            <a className="inline-flex items-center gap-1 text-primary underline" href="https://developers.facebook.com/tools/lead-ads-testing" target="_blank" rel="noreferrer noopener">
              Abrir Lead Ads Testing Tool <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </AlertDescription>
        </Alert>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="rounded-lg border p-6 flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Carregando diagnóstico...
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertTitle>Falha no diagnóstico</AlertTitle>
            <AlertDescription>{(error as Error).message}</AlertDescription>
          </Alert>
        ) : data ? (
          <>
            <DiagnosticRow
              title="1) Validade do Token (debug_token)"
              status={data.statuses.token.status}
              message={data.statuses.token.message}
            />

            <DiagnosticRow
              title="2) Permissão de Lead Access na Página"
              status={data.statuses.lead_access.status}
              message={data.statuses.lead_access.message}
              details={renderDetails(data)}
            />

            <DiagnosticRow
              title="3) Assinatura de Webhook (leadgen + callback)"
              status={data.statuses.webhook.status}
              message={data.statuses.webhook.message}
              details={
                <div className="text-xs space-y-1 text-muted-foreground">
                  <p>
                    Callback esperado: <code className="bg-muted px-1.5 py-0.5 rounded">{data.statuses.webhook.callback_url_expected}</code>
                  </p>
                  {data.statuses.webhook.callback_url_meta && (
                    <p>
                      Callback no Meta: <code className="bg-muted px-1.5 py-0.5 rounded">{data.statuses.webhook.callback_url_meta}</code>
                    </p>
                  )}
                  {data.statuses.webhook.reasons?.length ? (
                    <ul className="list-disc list-inside text-destructive">
                      {data.statuses.webhook.reasons.map((reason, idx) => (
                        <li key={`${reason}-${idx}`}>{reason}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              }
            />

            <p className="text-xs text-muted-foreground">
              App ID: {data.context.app_id || "não configurado"} • páginas verificadas: {data.context.pages_checked}
            </p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
