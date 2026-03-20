/**
 * FaturasEnergiaPage — Automatic energy billing via Gmail integration.
 */
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Mail, CheckCircle, XCircle, Copy, Loader2, Unplug, FileText, Building2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STALE_NORMAL = 1000 * 60 * 5;

export default function FaturasEnergiaPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);

  // Show toast on redirect from OAuth callback
  useEffect(() => {
    const gmailParam = searchParams.get("gmail");
    if (gmailParam === "conectado") {
      toast({ title: "Gmail conectado com sucesso!" });
      qc.invalidateQueries({ queryKey: ["gmail_config"] });
    } else if (gmailParam === "erro") {
      toast({
        title: "Erro ao conectar Gmail",
        description: searchParams.get("reason") || "Tente novamente",
        variant: "destructive",
      });
    }
  }, [searchParams]);

  // Fetch Gmail integration config
  const { data: gmailConfig, isLoading: loadingConfig } = useQuery({
    queryKey: ["gmail_config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations_api_configs")
        .select("id, is_active, settings, status")
        .eq("provider", "gmail")
        .eq("is_active", true)
        .maybeSingle();
      return data;
    },
    staleTime: STALE_NORMAL,
  });

  // Fetch UCs
  const { data: ucs = [], isLoading: loadingUCs } = useQuery({
    queryKey: ["ucs_for_faturas"],
    queryFn: async () => {
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc, concessionaria_id")
        .eq("is_archived", false)
        .order("nome");
      return data || [];
    },
    staleTime: STALE_NORMAL,
  });

  // Fetch unit_invoices if table exists
  const { data: invoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["unit_invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("unit_invoices" as any)
        .select("*")
        .order("reference_month", { ascending: false })
        .limit(50);
      if (error) return [];
      return data || [];
    },
    staleTime: STALE_NORMAL,
  });

  const isConnected = !!gmailConfig?.is_active;
  const connectedEmail = (gmailConfig?.settings as any)?.email;

  async function handleConnect() {
    try {
      const { data, error } = await supabase.functions.invoke("gmail-oauth", {
        body: {},
        method: "GET",
      });

      // supabase.functions.invoke doesn't support query params easily,
      // so we construct the URL manually
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;

      if (!token) {
        toast({ title: "Erro", description: "Você precisa estar logado", variant: "destructive" });
        return;
      }

      const resp = await fetch(`${supabaseUrl}/functions/v1/gmail-oauth?action=auth_url`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      const result = await resp.json();

      if (result.auth_url) {
        window.location.href = result.auth_url;
      } else {
        toast({ title: "Erro", description: result.error || "Falha ao gerar URL", variant: "destructive" });
      }
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

      await fetch(`${supabaseUrl}/functions/v1/gmail-oauth?action=disconnect`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      toast({ title: "Gmail desconectado" });
      qc.invalidateQueries({ queryKey: ["gmail_config"] });
    } catch (err: any) {
      toast({ title: "Erro", description: err?.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiado!", description: text });
  }

  function generateEmail(codigoUC: string | null): string {
    const code = (codigoUC || "sem-codigo").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    return `${code}@faturas.maisenergiasolar.com.br`;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Mail}
        title="Faturas de Energia"
        subtitle="Recebimento automático de faturas por e-mail"
      />

      {/* Section 1 — Gmail Connection */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="w-4 h-4" /> Conexão Gmail
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingConfig ? (
            <div className="flex items-center gap-3">
              <Skeleton className="h-10 w-40" />
              <Skeleton className="h-6 w-32" />
            </div>
          ) : isConnected ? (
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <Badge className="bg-success/10 text-success border-success/20">
                  <CheckCircle className="w-3 h-3 mr-1" /> Gmail conectado
                </Badge>
                <span className="text-sm text-muted-foreground">{connectedEmail}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="border-destructive text-destructive hover:bg-destructive/10"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Unplug className="w-4 h-4 mr-1" />}
                Desconectar
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">
                  Conecte sua conta Gmail para receber faturas de energia automaticamente.
                </p>
              </div>
              <Button size="sm" onClick={handleConnect}>
                <Mail className="w-4 h-4 mr-1" /> Conectar Gmail
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2 — UC Emails */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Building2 className="w-4 h-4" /> E-mails das UCs
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Cadastre o e-mail abaixo no site da concessionária para cada UC do cliente.
            As faturas enviadas para estes endereços serão processadas automaticamente.
          </p>

          {loadingUCs ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : ucs.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-4 text-center">
              Nenhuma UC cadastrada. Cadastre unidades consumidoras primeiro.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold text-foreground">UC</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">Código</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">E-mail para cadastro</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">Status</TableHead>
                    <TableHead className="w-[60px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ucs.map((uc: any) => {
                    const email = generateEmail(uc.codigo_uc);
                    return (
                      <TableRow key={uc.id} className="hover:bg-muted/30">
                        <TableCell className="text-sm font-medium text-foreground">{uc.nome}</TableCell>
                        <TableCell className="text-sm font-mono text-muted-foreground">{uc.codigo_uc || "—"}</TableCell>
                        <TableCell>
                          <span className="text-sm font-mono text-primary">{email}</span>
                        </TableCell>
                        <TableCell>
                          {isConnected ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-xs">
                              Integração ativa
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() => copyToClipboard(email)}
                            title="Copiar e-mail"
                          >
                            <Copy className="w-4 h-4 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3 — Received Invoices */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> Faturas Recebidas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingInvoices ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground italic py-6 text-center">
              Nenhuma fatura recebida ainda. Conecte o Gmail e cadastre os e-mails nas concessionárias.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="text-xs font-semibold text-foreground">UC</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">Concessionária</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">Mês Ref.</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground text-right">Valor</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">Vencimento</TableHead>
                    <TableHead className="text-xs font-semibold text-foreground">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoices.map((inv: any) => (
                    <TableRow key={inv.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm">{inv.unit_name || inv.unit_id}</TableCell>
                      <TableCell className="text-sm">{inv.concessionaria || "—"}</TableCell>
                      <TableCell className="text-sm">{inv.reference_month || "—"}</TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {inv.total_amount != null
                          ? `R$ ${Number(inv.total_amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {inv.due_date
                          ? new Date(inv.due_date).toLocaleDateString("pt-BR")
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {inv.status || "pendente"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
