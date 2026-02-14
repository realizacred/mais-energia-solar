import { useState, useEffect, useMemo } from "react";
import { Eye, Clock, Smartphone, Monitor, Send, CheckCircle2, XCircle, UserCheck, Globe, MessageCircle, Link2, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ProposalTrackingPanelProps {
  propostaId: string;
  versaoId?: string;
}

type TokenData = {
  id: string;
  token: string;
  decisao: string | null;
  aceite_nome: string | null;
  aceite_documento: string | null;
  aceite_observacoes: string | null;
  assinatura_url: string | null;
  recusa_motivo: string | null;
  recusa_at: string | null;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  used_at: string | null;
  created_at: string;
  expires_at: string;
  cenario_aceito_id: string | null;
};

type ViewData = {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  referrer: string | null;
  created_at: string;
};

type EnvioData = {
  id: string;
  canal: string;
  status: string;
  enviado_em: string;
  destinatario: string | null;
};

function isMobile(ua: string | null) {
  if (!ua) return false;
  return /mobile|android|iphone|ipad/i.test(ua);
}

const CANAL_ICON: Record<string, any> = {
  whatsapp: MessageCircle,
  link: Link2,
  email: Mail,
};

export function ProposalViewsCard({ propostaId, versaoId }: ProposalTrackingPanelProps) {
  const [loading, setLoading] = useState(true);
  const [views, setViews] = useState<ViewData[]>([]);
  const [totalViews, setTotalViews] = useState(0);
  const [tokens, setTokens] = useState<TokenData[]>([]);
  const [envios, setEnvios] = useState<EnvioData[]>([]);

  useEffect(() => {
    loadAll();
  }, [propostaId, versaoId]);

  const loadAll = async () => {
    setLoading(true);
    const queries = [
      (supabase as any)
        .from("proposta_views")
        .select("id, ip_address, user_agent, referrer, created_at", { count: "exact" })
        .eq("proposta_id", propostaId)
        .order("created_at", { ascending: false })
        .limit(20),
      (supabase as any)
        .from("proposta_aceite_tokens")
        .select("id, token, decisao, aceite_nome, aceite_documento, aceite_observacoes, assinatura_url, recusa_motivo, recusa_at, view_count, first_viewed_at, last_viewed_at, used_at, created_at, expires_at, cenario_aceito_id")
        .eq("proposta_id", propostaId)
        .order("created_at", { ascending: false }),
    ];

    if (versaoId) {
      queries.push(
        (supabase as any)
          .from("proposta_envios")
          .select("id, canal, status, enviado_em, destinatario")
          .eq("versao_id", versaoId)
          .order("enviado_em", { ascending: false })
      );
    }

    const results = await Promise.all(queries);

    setViews(results[0].data || []);
    setTotalViews(results[0].count || 0);
    setTokens(results[1].data || []);
    if (results[2]) setEnvios(results[2].data || []);
    setLoading(false);
  };

  const deviceBreakdown = useMemo(() => {
    let mobile = 0, desktop = 0;
    views.forEach(v => {
      if (isMobile(v.user_agent)) mobile++;
      else desktop++;
    });
    return { mobile, desktop };
  }, [views]);

  const activeToken = tokens.find(t => t.decisao) || tokens[0] || null;

  if (loading) return <Skeleton className="h-40 rounded-xl" />;

  return (
    <div className="space-y-4">
      {/* ── Decision Status ──────────────────────────────── */}
      {activeToken?.decisao && (
        <Card className={`border-l-[3px] ${activeToken.decisao === "aceita" ? "border-l-success" : "border-l-destructive"} border-border/60`}>
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              {activeToken.decisao === "aceita" ? (
                <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">
                  Proposta {activeToken.decisao === "aceita" ? "Aceita" : "Recusada"}
                </p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-muted-foreground">
                  {activeToken.aceite_nome && (
                    <span className="flex items-center gap-1">
                      <UserCheck className="h-3 w-3" />
                      {activeToken.aceite_nome}
                    </span>
                  )}
                  {activeToken.aceite_documento && (
                    <span>Doc: {activeToken.aceite_documento}</span>
                  )}
                  {activeToken.used_at && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(new Date(activeToken.used_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </span>
                  )}
                </div>
                {activeToken.aceite_observacoes && (
                  <p className="text-xs text-muted-foreground mt-2 bg-muted/50 rounded-lg p-2">
                    💬 {activeToken.aceite_observacoes}
                  </p>
                )}
                {activeToken.recusa_motivo && (
                  <p className="text-xs text-muted-foreground mt-2 bg-destructive/5 rounded-lg p-2">
                    ❌ Motivo: {activeToken.recusa_motivo}
                  </p>
                )}
                {activeToken.assinatura_url && (
                  <div className="mt-2">
                    <p className="text-[10px] text-muted-foreground mb-1">Assinatura digital:</p>
                    <img
                      src={activeToken.assinatura_url}
                      alt="Assinatura"
                      className="h-12 rounded border border-border/60 bg-white p-1"
                    />
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Engagement Metrics ────────────────────────────── */}
      <Card className="border-border/60">
        <CardContent className="py-4">
          <div className="flex items-center gap-2 mb-3">
            <Eye className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">Engajamento</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Views</p>
              <p className="text-lg font-bold">{totalViews}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Mobile</p>
              <div className="flex items-center justify-center gap-1">
                <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-lg font-bold">{deviceBreakdown.mobile}</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Desktop</p>
              <div className="flex items-center justify-center gap-1">
                <Monitor className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-lg font-bold">{deviceBreakdown.desktop}</p>
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 text-center">
              <p className="text-[10px] text-muted-foreground uppercase">Envios</p>
              <div className="flex items-center justify-center gap-1">
                <Send className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-lg font-bold">{envios.length}</p>
              </div>
            </div>
          </div>

          {activeToken?.first_viewed_at && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mb-3">
              <span>
                Primeira view: {format(new Date(activeToken.first_viewed_at), "dd/MM HH:mm", { locale: ptBR })}
              </span>
              {activeToken.last_viewed_at && (
                <span>
                  Última view: {formatDistanceToNow(new Date(activeToken.last_viewed_at), { locale: ptBR, addSuffix: true })}
                </span>
              )}
            </div>
          )}

          {/* Envios timeline */}
          {envios.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2">Histórico de Envios</p>
              <div className="space-y-1.5">
                {envios.map(e => {
                  const CanalIcon = CANAL_ICON[e.canal] || Send;
                  return (
                    <div key={e.id} className="flex items-center gap-2 text-xs">
                      <CanalIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <Badge variant="outline" className="text-[10px]">{e.canal}</Badge>
                      {e.destinatario && <span className="text-muted-foreground truncate">{e.destinatario}</span>}
                      <span className="ml-auto text-muted-foreground whitespace-nowrap">
                        {format(new Date(e.enviado_em), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}

          {/* Views timeline */}
          {views.length > 0 && (
            <>
              <Separator className="my-3" />
              <p className="text-xs font-medium text-muted-foreground mb-2">Últimas Visualizações</p>
              <div className="space-y-1.5">
                {views.slice(0, 8).map(v => (
                  <div key={v.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                    {isMobile(v.user_agent) ? (
                      <Smartphone className="h-3 w-3 shrink-0" />
                    ) : (
                      <Monitor className="h-3 w-3 shrink-0" />
                    )}
                    <span>{format(new Date(v.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                    {v.referrer && (
                      <span className="text-[10px] truncate max-w-[120px]">
                        <Globe className="h-2.5 w-2.5 inline mr-0.5" />
                        {new URL(v.referrer).hostname}
                      </span>
                    )}
                  </div>
                ))}
                {totalViews > 8 && (
                  <p className="text-[10px] text-muted-foreground">+{totalViews - 8} visualizações anteriores</p>
                )}
              </div>
            </>
          )}

          {views.length === 0 && envios.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Nenhuma atividade registrada ainda.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
