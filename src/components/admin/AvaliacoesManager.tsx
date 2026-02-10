import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  BarChart3,
  ThumbsUp,
  Meh,
  Sparkles,
  MessageCircle,
  Wrench,
  User,
} from "lucide-react";
import { StarRatingDisplay } from "@/components/ui/star-rating";

interface Avaliacao {
  id: string;
  nome_cliente: string;
  endereco: string;
  avaliacao_atendimento: string;
  data_instalacao: string;
  created_at: string;
}

interface WaSatisfactionRating {
  id: string;
  rating: number;
  feedback: string | null;
  attendant_user_id: string | null;
  answered_at: string | null;
  created_at: string;
  attendant_name?: string;
  cliente_nome?: string;
  cliente_telefone?: string;
}

const avaliacaoConfig: Record<string, { 
  label: string; 
  color: string; 
  score: number;
  bgClass: string;
}> = {
  otimo: { label: "Excelente", color: "text-success", score: 5, bgClass: "bg-success" },
  bom: { label: "Bom", color: "text-secondary", score: 4, bgClass: "bg-secondary" },
  razoavel: { label: "Regular", color: "text-warning", score: 3, bgClass: "bg-warning" },
  ruim: { label: "Ruim", color: "text-primary", score: 2, bgClass: "bg-primary" },
  muito_ruim: { label: "Muito Ruim", color: "text-destructive", score: 1, bgClass: "bg-destructive" },
};

// ── Sub-components ─────────────────────────────────

function KpiCards({ stats, media, percentualPositivo, nps }: {
  stats: { total: number; otimo: number; bom: number; razoavel: number; ruim: number; muito_ruim: number };
  media: number;
  percentualPositivo: string;
  nps: number;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card className="border-l-4 border-l-warning">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Média Geral</p>
              <div className="flex items-center gap-2 mt-1">
                <p className="text-3xl font-bold">{media.toFixed(1)}</p>
                <span className="text-muted-foreground">/5</span>
              </div>
            </div>
            <div className="p-3 bg-warning/10 rounded-full">
              <Sparkles className="h-6 w-6 text-warning" />
            </div>
          </div>
          <div className="mt-3">
            <StarRatingDisplay value={media} size="sm" />
          </div>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-success">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Satisfação Positiva</p>
              <p className="text-3xl font-bold text-success">{percentualPositivo}%</p>
            </div>
            <div className="p-3 bg-success/10 rounded-full">
              <ThumbsUp className="h-6 w-6 text-success" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {stats.otimo + stats.bom} de {stats.total} avaliações
          </p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-info">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">NPS Score</p>
              <p className={`text-3xl font-bold ${nps >= 0 ? 'text-success' : 'text-destructive'}`}>
                {nps > 0 && '+'}{nps}
              </p>
            </div>
            <div className={`p-3 rounded-full ${nps >= 50 ? 'bg-success/10' : nps >= 0 ? 'bg-warning/10' : 'bg-destructive/10'}`}>
              {nps >= 50 ? (
                <TrendingUp className="h-6 w-6 text-success" />
              ) : nps >= 0 ? (
                <Meh className="h-6 w-6 text-warning" />
              ) : (
                <TrendingDown className="h-6 w-6 text-destructive" />
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            {nps >= 50 ? 'Excelente' : nps >= 0 ? 'Bom' : 'Precisa melhorar'}
          </p>
        </CardContent>
      </Card>

      <Card className="border-l-4 border-l-secondary">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total de Avaliações</p>
              <p className="text-3xl font-bold">{stats.total}</p>
            </div>
            <div className="p-3 bg-secondary/10 rounded-full">
              <BarChart3 className="h-6 w-6 text-secondary" />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Instalações avaliadas
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function DistribuicaoChart({ stats, total }: { stats: Record<string, number>; total: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5" />
          Distribuição das Avaliações
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Object.entries(avaliacaoConfig).map(([key, config]) => {
            const count = stats[key] || 0;
            const percent = total > 0 ? (count / total) * 100 : 0;
            return (
              <div key={key} className="flex items-center gap-4">
                <div className="w-28 flex items-center gap-2">
                  <StarRatingDisplay value={config.score} size="sm" />
                  <span className={`text-sm font-medium ${config.color}`} />
                </div>
                <span className="w-20 text-sm font-medium">{config.label}</span>
                <div className="flex-1">
                  <div className="h-6 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full ${config.bgClass} transition-all duration-500`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
                <div className="w-20 text-right">
                  <span className="font-semibold">{count}</span>
                  <span className="text-muted-foreground text-sm ml-1">
                    ({percent.toFixed(0)}%)
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function InstalacaoTable({ avaliacoes }: { avaliacoes: Avaliacao[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-warning" />
          Avaliações de Instalação Recentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {avaliacoes.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Nenhuma avaliação registrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Endereço</TableHead>
                <TableHead>Avaliação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {avaliacoes.slice(0, 20).map((avaliacao) => {
                const config = avaliacaoConfig[avaliacao.avaliacao_atendimento];
                return (
                  <TableRow key={avaliacao.id}>
                    <TableCell className="whitespace-nowrap">
                      {format(new Date(avaliacao.data_instalacao), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {avaliacao.nome_cliente}
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {avaliacao.endereco}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StarRatingDisplay value={config?.score || 0} size="sm" />
                        <Badge className={`${config?.bgClass} text-white`}>
                          {config?.label}
                        </Badge>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ── WhatsApp Ratings Section ──────────────────────

function WhatsAppRatingsSection({ ratings }: { ratings: WaSatisfactionRating[] }) {
  // Group by attendant
  const byAttendant = ratings.reduce<Record<string, WaSatisfactionRating[]>>((acc, r) => {
    const key = r.attendant_name || "Não atribuído";
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const attendantStats = Object.entries(byAttendant).map(([name, items]) => {
    const avg = items.reduce((s, i) => s + i.rating, 0) / items.length;
    const positive = items.filter(i => i.rating >= 4).length;
    return { name, count: items.length, avg, positivePercent: (positive / items.length) * 100, items };
  }).sort((a, b) => b.avg - a.avg);

  const totalRatings = ratings.length;
  const overallAvg = totalRatings > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / totalRatings : 0;

  return (
    <div className="space-y-4">
      {/* KPIs WhatsApp */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-success">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média WhatsApp</p>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-3xl font-bold">{overallAvg.toFixed(1)}</p>
                  <span className="text-muted-foreground">/5</span>
                </div>
              </div>
              <div className="p-3 bg-success/10 rounded-full">
                <MessageCircle className="h-6 w-6 text-success" />
              </div>
            </div>
            <div className="mt-3">
              <StarRatingDisplay value={overallAvg} size="sm" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-info">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Total Respostas</p>
            <p className="text-3xl font-bold">{totalRatings}</p>
            <p className="text-xs text-muted-foreground mt-2">Pesquisas respondidas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-warning">
          <CardContent className="pt-6">
            <p className="text-sm text-muted-foreground">Atendentes Avaliados</p>
            <p className="text-3xl font-bold">{attendantStats.length}</p>
            <p className="text-xs text-muted-foreground mt-2">Com avaliações recebidas</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-attendant breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            Avaliações por Atendente
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendantStats.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhuma avaliação WhatsApp registrada</p>
              <p className="text-xs mt-1">As avaliações aparecerão aqui quando clientes responderem à pesquisa de satisfação</p>
            </div>
          ) : (
            <div className="space-y-4">
              {attendantStats.map(({ name, count, avg, positivePercent }) => (
                <div key={name} className="flex items-center gap-4 p-3 bg-muted/30 rounded-lg">
                  <div className="w-40 font-medium truncate">{name}</div>
                  <StarRatingDisplay value={avg} size="sm" />
                  <span className="text-sm font-semibold">{avg.toFixed(1)}</span>
                  <div className="flex-1">
                    <div className="h-4 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success transition-all duration-500"
                        style={{ width: `${positivePercent}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground w-24 text-right">
                    {count} avaliação{count !== 1 ? "ões" : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent WhatsApp ratings table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <MessageCircle className="h-5 w-5 text-success" />
            Avaliações WhatsApp Recentes
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ratings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhuma avaliação registrada</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Atendente</TableHead>
                  <TableHead>Nota</TableHead>
                  <TableHead>Feedback</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratings.slice(0, 30).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="whitespace-nowrap">
                      {r.answered_at
                        ? format(new Date(r.answered_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                        : format(new Date(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {r.cliente_nome || r.cliente_telefone || "—"}
                    </TableCell>
                    <TableCell>{r.attendant_name || "Não atribuído"}</TableCell>
                    <TableCell>
                      <StarRatingDisplay value={r.rating} size="sm" />
                    </TableCell>
                    <TableCell className="max-w-[250px] truncate">
                      {r.feedback || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main Component ─────────────────────────────────

export function AvaliacoesManager() {
  const [avaliacoes, setAvaliacoes] = useState<Avaliacao[]>([]);
  const [waRatings, setWaRatings] = useState<WaSatisfactionRating[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [instRes, waRes] = await Promise.all([
        supabase
          .from("checklists_instalacao")
          .select("id, nome_cliente, endereco, avaliacao_atendimento, data_instalacao, created_at")
          .not("avaliacao_atendimento", "is", null)
          .order("created_at", { ascending: false }),
        supabase
          .from("wa_satisfaction_ratings")
          .select("id, rating, feedback, attendant_user_id, answered_at, created_at, conversation_id")
          .not("answered_at", "is", null)
          .order("answered_at", { ascending: false }),
      ]);

      if (instRes.error) throw instRes.error;
      setAvaliacoes(instRes.data || []);

      if (waRes.error) {
        console.error("Error fetching WA ratings:", waRes.error);
        setWaRatings([]);
      } else {
        // Enrich with attendant names and conversation info
        const ratings = waRes.data || [];
        const attendantIds = [...new Set(ratings.map(r => r.attendant_user_id).filter(Boolean))] as string[];
        const conversationIds = [...new Set(ratings.map(r => r.conversation_id).filter(Boolean))] as string[];

        let profilesMap: Record<string, string> = {};
        let convsMap: Record<string, { nome: string | null; telefone: string }> = {};

        if (attendantIds.length > 0) {
          const { data: profiles } = await supabase
            .from("profiles")
            .select("user_id, nome")
            .in("user_id", attendantIds);
          if (profiles) {
            for (const p of profiles) {
              profilesMap[p.user_id] = p.nome || "Sem nome";
            }
          }
        }

        if (conversationIds.length > 0) {
          const { data: convs } = await supabase
            .from("wa_conversations")
            .select("id, cliente_nome, cliente_telefone")
            .in("id", conversationIds);
          if (convs) {
            for (const c of convs) {
              convsMap[c.id] = { nome: c.cliente_nome, telefone: c.cliente_telefone };
            }
          }
        }

        setWaRatings(ratings.map(r => ({
          ...r,
          attendant_name: r.attendant_user_id ? profilesMap[r.attendant_user_id] || "Desconhecido" : undefined,
          cliente_nome: r.conversation_id ? convsMap[r.conversation_id]?.nome || undefined : undefined,
          cliente_telefone: r.conversation_id ? convsMap[r.conversation_id]?.telefone : undefined,
        })));
      }
    } catch (error) {
      console.error("Error fetching avaliacoes:", error);
      toast({ title: "Erro ao carregar avaliações", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // Calcular estatísticas de instalação
  const stats = {
    total: avaliacoes.length,
    otimo: avaliacoes.filter((a) => a.avaliacao_atendimento === "otimo").length,
    bom: avaliacoes.filter((a) => a.avaliacao_atendimento === "bom").length,
    razoavel: avaliacoes.filter((a) => a.avaliacao_atendimento === "razoavel").length,
    ruim: avaliacoes.filter((a) => a.avaliacao_atendimento === "ruim").length,
    muito_ruim: avaliacoes.filter((a) => a.avaliacao_atendimento === "muito_ruim").length,
  };

  const calcularMedia = () => {
    if (avaliacoes.length === 0) return 0;
    const soma = avaliacoes.reduce((acc, a) => {
      return acc + (avaliacaoConfig[a.avaliacao_atendimento]?.score || 0);
    }, 0);
    return soma / avaliacoes.length;
  };

  const media = calcularMedia();
  const percentualPositivo = stats.total > 0 
    ? ((stats.otimo + stats.bom) / stats.total * 100).toFixed(1)
    : "0";

  const nps = stats.total > 0
    ? Math.round(((stats.otimo - (stats.ruim + stats.muito_ruim)) / stats.total) * 100)
    : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="instalacao" className="w-full">
        <TabsList>
          <TabsTrigger value="instalacao" className="gap-2">
            <Wrench className="h-4 w-4" />
            Instalação ({avaliacoes.length})
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-2">
            <MessageCircle className="h-4 w-4" />
            WhatsApp ({waRatings.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="instalacao" className="space-y-6 mt-4">
          <KpiCards stats={stats} media={media} percentualPositivo={percentualPositivo} nps={nps} />
          <DistribuicaoChart stats={stats} total={stats.total} />
          <InstalacaoTable avaliacoes={avaliacoes} />
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-6 mt-4">
          <WhatsAppRatingsSection ratings={waRatings} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
