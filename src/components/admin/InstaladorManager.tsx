import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Wrench,
  Trophy,
  Target,
  Users,
  Loader2,
  Save,
  Crown,
  Star,
  Clock,
  CheckCircle2,
  BarChart3,
  TrendingUp,
} from "lucide-react";

interface Instalador {
  id: string;
  nome: string;
  email?: string;
  ativo: boolean;
}

interface InstaladorPerformance {
  instalador_id: string;
  nome: string;
  total_servicos: number;
  servicos_concluidos: number;
  avaliacoes_positivas: number;
  avaliacoes_totais: number;
  tempo_medio_minutos: number | null;
  pontuacao_total: number;
}

interface InstaladorConfig {
  id: string;
  meta_servicos_mensal: number;
  meta_avaliacoes_positivas: number;
  meta_tempo_medio_minutos: number;
  pontos_por_servico: number;
  pontos_por_avaliacao_positiva: number;
  bonus_meta_atingida: number;
}

interface InstaladorMeta {
  id: string;
  instalador_id: string;
  meta_servicos_mensal: number;
  meta_avaliacoes_positivas: number;
  meta_tempo_medio_minutos: number;
  usar_metas_individuais: boolean;
}

export function InstaladorManager() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [performance, setPerformance] = useState<InstaladorPerformance[]>([]);
  const [config, setConfig] = useState<InstaladorConfig | null>(null);
  const [metas, setMetas] = useState<InstaladorMeta[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Buscar instaladores (profiles com role instalador)
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "instalador");

      const instaladorIds = roleData?.map(r => r.user_id) || [];

      if (instaladorIds.length > 0) {
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, nome, ativo")
          .in("user_id", instaladorIds);

        setInstaladores(
          profilesData?.map(p => ({
            id: p.user_id,
            nome: p.nome,
            ativo: p.ativo,
          })) || []
        );
      }

      // Buscar config global
      const { data: configData } = await supabase
        .from("instalador_config")
        .select("*")
        .single();

      if (configData) {
        setConfig(configData);
      }

      // Buscar metas individuais
      const { data: metasData } = await supabase
        .from("instalador_metas")
        .select("*");

      setMetas(metasData || []);

      // Calcular performance do mês atual
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const performanceList: InstaladorPerformance[] = [];

      for (const inst of instaladorIds) {
        // Buscar serviços do instalador no mês
        const { data: servicos } = await supabase
          .from("servicos_agendados")
          .select("id, status, data_hora_inicio, data_hora_fim")
          .eq("instalador_id", inst)
          .gte("data_agendada", startOfMonth.split("T")[0])
          .lte("data_agendada", endOfMonth.split("T")[0]);

        // Buscar avaliações (checklists_instalacao)
        const { data: avaliacoes } = await supabase
          .from("checklists_instalacao")
          .select("avaliacao_atendimento")
          .eq("instalador_id", inst)
          .gte("created_at", startOfMonth)
          .lte("created_at", endOfMonth);

        const total = servicos?.length || 0;
        const concluidos = servicos?.filter(s => s.status === "concluido").length || 0;
        const avalPositivas = avaliacoes?.filter(a => 
          ["otimo", "bom"].includes(a.avaliacao_atendimento)
        ).length || 0;

        // Calcular tempo médio
        let tempoTotal = 0;
        let servicosComTempo = 0;
        servicos?.forEach(s => {
          if (s.data_hora_inicio && s.data_hora_fim) {
            const inicio = new Date(s.data_hora_inicio);
            const fim = new Date(s.data_hora_fim);
            tempoTotal += (fim.getTime() - inicio.getTime()) / 60000;
            servicosComTempo++;
          }
        });

        const instalador = instaladores.find(i => i.id === inst);
        
        performanceList.push({
          instalador_id: inst,
          nome: instalador?.nome || "Desconhecido",
          total_servicos: total,
          servicos_concluidos: concluidos,
          avaliacoes_positivas: avalPositivas,
          avaliacoes_totais: avaliacoes?.length || 0,
          tempo_medio_minutos: servicosComTempo > 0 ? Math.round(tempoTotal / servicosComTempo) : null,
          pontuacao_total: concluidos * (configData?.pontos_por_servico || 10) + 
                          avalPositivas * (configData?.pontos_por_avaliacao_positiva || 5),
        });
      }

      setPerformance(performanceList.sort((a, b) => b.pontuacao_total - a.pontuacao_total));

    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!config) return;

    try {
      setSaving(true);
      const { error } = await supabase
        .from("instalador_config")
        .update({
          meta_servicos_mensal: config.meta_servicos_mensal,
          meta_avaliacoes_positivas: config.meta_avaliacoes_positivas,
          meta_tempo_medio_minutos: config.meta_tempo_medio_minutos,
          pontos_por_servico: config.pontos_por_servico,
          pontos_por_avaliacao_positiva: config.pontos_por_avaliacao_positiva,
          bonus_meta_atingida: config.bonus_meta_atingida,
        })
        .eq("id", config.id);

      if (error) throw error;

      toast({ title: "Configurações salvas!" });
    } catch (error) {
      console.error("Error saving config:", error);
      toast({
        title: "Erro ao salvar",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMeta = async (instaladorId: string, meta: Partial<InstaladorMeta>) => {
    try {
      const existingMeta = metas.find(m => m.instalador_id === instaladorId);

      if (existingMeta) {
        await supabase
          .from("instalador_metas")
          .update(meta)
          .eq("id", existingMeta.id);
      } else {
        await supabase
          .from("instalador_metas")
          .insert({
            instalador_id: instaladorId,
            ...meta,
          });
      }

      toast({ title: "Meta salva!" });
      fetchData();
    } catch (error) {
      console.error("Error saving meta:", error);
      toast({ title: "Erro ao salvar meta", variant: "destructive" });
    }
  };

  const formatMinutes = (minutes: number | null) => {
    if (minutes === null) return "—";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}min`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="ranking" className="w-full">
        <TabsList className="grid w-full max-w-xl grid-cols-3">
          <TabsTrigger value="ranking" className="gap-2">
            <Trophy className="h-4 w-4" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="metas" className="gap-2">
            <Target className="h-4 w-4" />
            Metas
          </TabsTrigger>
          <TabsTrigger value="individuais" className="gap-2">
            <Users className="h-4 w-4" />
            Por Instalador
          </TabsTrigger>
        </TabsList>

        {/* Ranking Tab */}
        <TabsContent value="ranking" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Trophy className="h-5 w-5 text-primary" />
                Ranking do Mês - {format(new Date(), "MMMM yyyy", { locale: ptBR })}
              </CardTitle>
              <CardDescription>
                Classificação dos instaladores baseada em serviços e avaliações
              </CardDescription>
            </CardHeader>
            <CardContent>
              {performance.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum instalador registrado.
                </div>
              ) : (
                <>
                  {/* Podium */}
                  <div className="flex items-end justify-center gap-4 mb-8">
                    {performance[1] && (
                      <div className="flex flex-col items-center">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gray-300 to-gray-400 flex items-center justify-center text-white font-bold text-xl shadow-lg">
                          2
                        </div>
                        <div className="mt-2 text-center">
                          <p className="font-medium text-sm">{performance[1].nome}</p>
                          <p className="text-xs text-muted-foreground">{performance[1].pontuacao_total} pts</p>
                        </div>
                        <div className="w-20 h-16 bg-gray-200 rounded-t-lg mt-2" />
                      </div>
                    )}

                    {performance[0] && (
                      <div className="flex flex-col items-center">
                        <Crown className="h-6 w-6 text-yellow-500 mb-1" />
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-amber-500 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                          1
                        </div>
                        <div className="mt-2 text-center">
                          <p className="font-semibold">{performance[0].nome}</p>
                          <p className="text-sm text-muted-foreground">{performance[0].pontuacao_total} pts</p>
                        </div>
                        <div className="w-24 h-24 bg-yellow-100 rounded-t-lg mt-2" />
                      </div>
                    )}

                    {performance[2] && (
                      <div className="flex flex-col items-center">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-amber-600 to-amber-700 flex items-center justify-center text-white font-bold text-lg shadow-lg">
                          3
                        </div>
                        <div className="mt-2 text-center">
                          <p className="font-medium text-sm">{performance[2].nome}</p>
                          <p className="text-xs text-muted-foreground">{performance[2].pontuacao_total} pts</p>
                        </div>
                        <div className="w-16 h-12 bg-amber-100 rounded-t-lg mt-2" />
                      </div>
                    )}
                  </div>

                  {/* Full Table */}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">#</TableHead>
                        <TableHead>Instalador</TableHead>
                        <TableHead className="text-center">Serviços</TableHead>
                        <TableHead className="text-center">Concluídos</TableHead>
                        <TableHead className="text-center">Avaliações +</TableHead>
                        <TableHead className="text-center">Tempo Médio</TableHead>
                        <TableHead className="text-right">Pontos</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {performance.map((entry, idx) => (
                        <TableRow key={entry.instalador_id}>
                          <TableCell>
                            <Badge variant={idx < 3 ? "default" : "outline"}>
                              {idx + 1}º
                            </Badge>
                          </TableCell>
                          <TableCell className="font-medium">{entry.nome}</TableCell>
                          <TableCell className="text-center">{entry.total_servicos}</TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <CheckCircle2 className="h-3 w-3 text-success" />
                              {entry.servicos_concluidos}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Star className="h-3 w-3 text-yellow-500" />
                              {entry.avaliacoes_positivas}/{entry.avaliacoes_totais}
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {formatMinutes(entry.tempo_medio_minutos)}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold">
                            {entry.pontuacao_total}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Metas Tab */}
        <TabsContent value="metas" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Configuração de Metas Globais
              </CardTitle>
              <CardDescription>
                Defina os valores padrão de metas para todos os instaladores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {config && (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Meta de Serviços/Mês</Label>
                      <Input
                        type="number"
                        value={config.meta_servicos_mensal}
                        onChange={(e) =>
                          setConfig({ ...config, meta_servicos_mensal: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Meta Avaliações Positivas (%)</Label>
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={config.meta_avaliacoes_positivas}
                        onChange={(e) =>
                          setConfig({ ...config, meta_avaliacoes_positivas: parseInt(e.target.value) || 0 })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Meta Tempo Médio (minutos)</Label>
                      <Input
                        type="number"
                        value={config.meta_tempo_medio_minutos}
                        onChange={(e) =>
                          setConfig({ ...config, meta_tempo_medio_minutos: parseInt(e.target.value) || 0 })
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {formatMinutes(config.meta_tempo_medio_minutos)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="font-medium mb-4">Pontuação</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>Pontos por Serviço Concluído</Label>
                        <Input
                          type="number"
                          value={config.pontos_por_servico}
                          onChange={(e) =>
                            setConfig({ ...config, pontos_por_servico: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Pontos por Avaliação Positiva</Label>
                        <Input
                          type="number"
                          value={config.pontos_por_avaliacao_positiva}
                          onChange={(e) =>
                            setConfig({ ...config, pontos_por_avaliacao_positiva: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Bônus Meta Atingida</Label>
                        <Input
                          type="number"
                          value={config.bonus_meta_atingida}
                          onChange={(e) =>
                            setConfig({ ...config, bonus_meta_atingida: parseInt(e.target.value) || 0 })
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <Button onClick={handleSaveConfig} disabled={saving} className="gap-2">
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar Configurações
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Individuais Tab */}
        <TabsContent value="individuais" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Metas Individuais
              </CardTitle>
              <CardDescription>
                Configure metas personalizadas para cada instalador
              </CardDescription>
            </CardHeader>
            <CardContent>
              {instaladores.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum instalador cadastrado.
                </div>
              ) : (
                <div className="space-y-4">
                  {instaladores.map(inst => {
                    const meta = metas.find(m => m.instalador_id === inst.id);
                    const perf = performance.find(p => p.instalador_id === inst.id);

                    return (
                      <Card key={inst.id} className="p-4">
                        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-3">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <Wrench className="h-5 w-5 text-primary" />
                              </div>
                              <div>
                                <p className="font-medium">{inst.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                  {perf?.servicos_concluidos || 0} serviços concluídos este mês
                                </p>
                              </div>
                              <Badge variant={inst.ativo ? "outline" : "secondary"}>
                                {inst.ativo ? "Ativo" : "Inativo"}
                              </Badge>
                            </div>

                            {perf && config && (
                              <div className="space-y-2">
                                <div className="flex items-center justify-between text-sm">
                                  <span>Progresso Serviços</span>
                                  <span className="text-muted-foreground">
                                    {perf.servicos_concluidos} / {meta?.usar_metas_individuais 
                                      ? meta.meta_servicos_mensal 
                                      : config.meta_servicos_mensal}
                                  </span>
                                </div>
                                <Progress 
                                  value={Math.min(100, (perf.servicos_concluidos / (meta?.usar_metas_individuais 
                                    ? meta.meta_servicos_mensal 
                                    : config.meta_servicos_mensal)) * 100)} 
                                  className="h-2"
                                />
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <Switch
                                checked={meta?.usar_metas_individuais || false}
                                onCheckedChange={(checked) => 
                                  handleSaveMeta(inst.id, { usar_metas_individuais: checked })
                                }
                              />
                              <Label className="text-sm">Metas Individuais</Label>
                            </div>
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
