import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Lead } from "@/types/lead";

// ── Types ─────────────────────────────────────────────────────
export interface ScoringConfig {
  id: string;
  peso_consumo: number;
  peso_recencia: number;
  peso_engajamento: number;
  peso_perfil_tecnico: number;
  peso_localizacao: number;
  peso_tempo_resposta: number;
  consumo_alto_min: number;
  consumo_medio_min: number;
  recencia_quente_max: number;
  recencia_morna_max: number;
  threshold_hot: number;
  threshold_warm: number;
  probabilidade_hot: number;
  probabilidade_warm: number;
  probabilidade_cold: number;
  ticket_medio: number;
}

export interface LeadScore {
  id: string;
  lead_id: string;
  score: number;
  nivel: "hot" | "warm" | "cold";
  probabilidade_fechamento: number;
  fatores: string[];
  recomendacao: string | null;
  score_consumo: number;
  score_recencia: number;
  score_engajamento: number;
  score_perfil_tecnico: number;
  score_localizacao: number;
  score_tempo_resposta: number;
  valor_estimado: number | null;
  calculado_em: string;
}

export interface ScoredLead extends Lead {
  score?: LeadScore;
}

export interface RevenueForecast {
  total_estimado: number;
  por_nivel: {
    hot: { count: number; valor: number; probabilidade: number };
    warm: { count: number; valor: number; probabilidade: number };
    cold: { count: number; valor: number; probabilidade: number };
  };
  ponderado: number;
}

// ── Scoring Engine (pure function) ────────────────────────────
function calcularScore(lead: Lead, config: ScoringConfig, statusNome?: string): Omit<LeadScore, "id" | "calculado_em"> {
  const fatores: string[] = [];
  const agora = Date.now();
  const criadoEm = new Date(lead.created_at).getTime();
  const diasCriacao = Math.floor((agora - criadoEm) / (1000 * 60 * 60 * 24));
  
  const ultimoContato = lead.ultimo_contato ? new Date(lead.ultimo_contato).getTime() : null;
  const diasSemContato = ultimoContato 
    ? Math.floor((agora - ultimoContato) / (1000 * 60 * 60 * 24))
    : diasCriacao;

  // 1) CONSUMO (0-100 normalizado)
  let scoreConsumo = 0;
  if (lead.media_consumo >= config.consumo_alto_min) {
    scoreConsumo = 100;
    fatores.push(`Consumo alto: ${lead.media_consumo}kWh`);
  } else if (lead.media_consumo >= config.consumo_medio_min) {
    scoreConsumo = 60;
    fatores.push(`Consumo médio: ${lead.media_consumo}kWh`);
  } else if (lead.media_consumo > 0) {
    scoreConsumo = 30;
    fatores.push(`Consumo baixo: ${lead.media_consumo}kWh`);
  }

  // 2) RECÊNCIA (0-100)
  let scoreRecencia = 0;
  if (diasCriacao <= config.recencia_quente_max) {
    scoreRecencia = 100;
    fatores.push(`Lead recente (${diasCriacao}d)`);
  } else if (diasCriacao <= config.recencia_morna_max) {
    scoreRecencia = 60;
    fatores.push(`Lead de ${diasCriacao} dias`);
  } else if (diasCriacao <= 14) {
    scoreRecencia = 30;
  } else {
    scoreRecencia = Math.max(0, 20 - diasCriacao);
    if (diasCriacao > 14) fatores.push(`Lead antigo (${diasCriacao}d)`);
  }

  // 3) ENGAJAMENTO (0-100)
  let scoreEngajamento = 50; // base
  if (lead.visto_admin && !lead.ultimo_contato) {
    scoreEngajamento -= 20;
    fatores.push("Visualizado sem contato");
  }
  if (diasSemContato > 5) {
    scoreEngajamento -= 30;
    fatores.push(`${diasSemContato}d sem contato`);
  } else if (lead.ultimo_contato) {
    scoreEngajamento += 30;
    fatores.push("Contato recente");
  }
  if (statusNome && ["Proposta Enviada", "Negociação", "Visita Agendada"].some(s => statusNome.includes(s))) {
    scoreEngajamento += 20;
    fatores.push(`Status: ${statusNome}`);
  }
  scoreEngajamento = Math.max(0, Math.min(100, scoreEngajamento));

  // 4) PERFIL TÉCNICO (0-100)
  let scorePerfilTecnico = 50;
  const telhadosFavoraveis = ["Cerâmico", "Fibrocimento", "Laje"];
  if (telhadosFavoraveis.some(t => lead.tipo_telhado?.includes(t))) {
    scorePerfilTecnico += 25;
    fatores.push(`Telhado favorável: ${lead.tipo_telhado}`);
  } else if (lead.tipo_telhado?.includes("Metálico")) {
    scorePerfilTecnico += 15;
  }
  if (lead.rede_atendimento?.includes("Trifásic")) {
    scorePerfilTecnico += 25;
    fatores.push("Rede trifásica");
  } else if (lead.rede_atendimento?.includes("Bifásic")) {
    scorePerfilTecnico += 15;
  }
  scorePerfilTecnico = Math.min(100, scorePerfilTecnico);

  // 5) LOCALIZAÇÃO (0-100)
  let scoreLocalizacao = 50;
  if (lead.area?.includes("Urbana")) {
    scoreLocalizacao = 80;
    fatores.push("Área urbana");
  } else if (lead.area?.includes("Rural")) {
    scoreLocalizacao = 40;
  }

  // 6) TEMPO DE RESPOSTA (0-100) - quanto mais rápido o consultor respondeu
  let scoreTempoResposta = 50;
  if (lead.visto && diasCriacao <= 1) {
    scoreTempoResposta = 100;
    fatores.push("Resposta rápida do consultor");
  } else if (!lead.visto && diasCriacao > 2) {
    scoreTempoResposta = 10;
    fatores.push("⚠ Ainda não visualizado");
  }

  // ── Score final ponderado ──
  const somaTotal = config.peso_consumo + config.peso_recencia + config.peso_engajamento
    + config.peso_perfil_tecnico + config.peso_localizacao + config.peso_tempo_resposta;
  
  const scoreFinal = Math.round(
    (scoreConsumo * config.peso_consumo +
     scoreRecencia * config.peso_recencia +
     scoreEngajamento * config.peso_engajamento +
     scorePerfilTecnico * config.peso_perfil_tecnico +
     scoreLocalizacao * config.peso_localizacao +
     scoreTempoResposta * config.peso_tempo_resposta) / somaTotal
  );

  // ── Nível e probabilidade ──
  let nivel: "hot" | "warm" | "cold";
  let probabilidade: number;
  if (scoreFinal >= config.threshold_hot) {
    nivel = "hot";
    probabilidade = config.probabilidade_hot;
  } else if (scoreFinal >= config.threshold_warm) {
    nivel = "warm";
    probabilidade = config.probabilidade_warm;
  } else {
    nivel = "cold";
    probabilidade = config.probabilidade_cold;
  }

  // Ajuste fino da probabilidade baseado no score dentro da faixa
  if (nivel === "hot") {
    probabilidade += (scoreFinal - config.threshold_hot) * 0.005;
  } else if (nivel === "warm") {
    const range = config.threshold_hot - config.threshold_warm;
    const position = (scoreFinal - config.threshold_warm) / range;
    probabilidade += position * 0.1;
  }
  probabilidade = Math.min(0.95, Math.max(0.05, probabilidade));

  // Valor estimado
  const valorEstimado = config.ticket_medio * probabilidade;

  // Recomendação
  let recomendacao: string;
  if (nivel === "hot") {
    recomendacao = "🔥 Prioridade máxima! Entrar em contato imediatamente.";
  } else if (nivel === "warm") {
    if (diasSemContato > 3) {
      recomendacao = "📞 Retomar contato — lead esfriando.";
    } else {
      recomendacao = "📋 Enviar proposta personalizada e agendar visita.";
    }
  } else {
    if (lead.media_consumo < config.consumo_medio_min) {
      recomendacao = "📧 Nutrir com conteúdo educativo sobre economia solar.";
    } else {
      recomendacao = "⏰ Agendar follow-up para próxima semana.";
    }
  }

  return {
    lead_id: lead.id,
    score: scoreFinal,
    nivel,
    probabilidade_fechamento: Math.round(probabilidade * 100) / 100,
    fatores,
    recomendacao,
    score_consumo: scoreConsumo,
    score_recencia: scoreRecencia,
    score_engajamento: scoreEngajamento,
    score_perfil_tecnico: scorePerfilTecnico,
    score_localizacao: scoreLocalizacao,
    score_tempo_resposta: scoreTempoResposta,
    valor_estimado: Math.round(valorEstimado),
  };
}

// ── Hook ──────────────────────────────────────────────────────
export function useLeadScoring() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isScoring, setIsScoring] = useState(false);

  // Fetch config
  const configQuery = useQuery({
    queryKey: ["lead-scoring-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_scoring_config")
        .select("id, peso_consumo, peso_recencia, peso_engajamento, peso_perfil_tecnico, peso_localizacao, peso_tempo_resposta, consumo_alto_min, consumo_medio_min, recencia_quente_max, recencia_morna_max, threshold_hot, threshold_warm, probabilidade_hot, probabilidade_warm, probabilidade_cold, ticket_medio")
        .limit(1)
        .single();
      if (error) throw error;
      return data as ScoringConfig;
    },
    staleTime: 10 * 60 * 1000,
  });

  // Fetch existing scores
  const scoresQuery = useQuery({
    queryKey: ["lead-scores"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_scores")
        .select("id, lead_id, score, nivel, probabilidade_fechamento, fatores, recomendacao, score_consumo, score_recencia, score_engajamento, score_perfil_tecnico, score_localizacao, score_tempo_resposta, valor_estimado, calculado_em")
        .order("score", { ascending: false });
      if (error) throw error;
      return (data || []) as LeadScore[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Score all leads
  const scoreLeads = useCallback(async (leads: Lead[], statuses?: { id: string; nome: string }[]) => {
    const config = configQuery.data;
    if (!config) {
      toast({ title: "Erro", description: "Configuração de scoring não carregada", variant: "destructive" });
      return;
    }

    setIsScoring(true);
    try {
      const statusMap = new Map(statuses?.map(s => [s.id, s.nome]) || []);
      
      const scores = leads.map(lead => {
        const statusNome = lead.status_id ? statusMap.get(lead.status_id) : undefined;
        return calcularScore(lead, config, statusNome);
      });

      // Upsert scores in batch
      const upsertData = scores.map(s => ({
        lead_id: s.lead_id,
        score: s.score,
        nivel: s.nivel,
        probabilidade_fechamento: s.probabilidade_fechamento,
        fatores: JSON.stringify(s.fatores),
        recomendacao: s.recomendacao,
        score_consumo: s.score_consumo,
        score_recencia: s.score_recencia,
        score_engajamento: s.score_engajamento,
        score_perfil_tecnico: s.score_perfil_tecnico,
        score_localizacao: s.score_localizacao,
        score_tempo_resposta: s.score_tempo_resposta,
        valor_estimado: s.valor_estimado,
        calculado_em: new Date().toISOString(),
      }));

      // Batch in chunks of 50
      const CHUNK = 50;
      for (let i = 0; i < upsertData.length; i += CHUNK) {
        const chunk = upsertData.slice(i, i + CHUNK);
        const { error } = await supabase
          .from("lead_scores")
          .upsert(chunk, { onConflict: "lead_id" });
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["lead-scores"] });
      
      toast({
        title: "Scoring concluído",
        description: `${scores.length} leads analisados com sucesso.`,
      });
    } catch (error) {
      console.error("Scoring error:", error);
      toast({ title: "Erro no scoring", description: "Falha ao calcular scores dos leads.", variant: "destructive" });
    } finally {
      setIsScoring(false);
    }
  }, [configQuery.data, queryClient, toast]);

  // Update config
  const updateConfig = useMutation({
    mutationFn: async (updates: Partial<ScoringConfig>) => {
      const config = configQuery.data;
      if (!config) throw new Error("Config not loaded");
      const { error } = await supabase
        .from("lead_scoring_config")
        .update(updates)
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lead-scoring-config"] });
      toast({ title: "Configuração salva" });
    },
    onError: () => {
      toast({ title: "Erro", description: "Falha ao salvar configuração", variant: "destructive" });
    },
  });

  // Calculate revenue forecast
  const calcularPrevisao = useCallback((scores: LeadScore[], config: ScoringConfig): RevenueForecast => {
    const porNivel = {
      hot: { count: 0, valor: 0, probabilidade: config.probabilidade_hot },
      warm: { count: 0, valor: 0, probabilidade: config.probabilidade_warm },
      cold: { count: 0, valor: 0, probabilidade: config.probabilidade_cold },
    };

    scores.forEach(s => {
      const nivel = s.nivel as keyof typeof porNivel;
      porNivel[nivel].count++;
      porNivel[nivel].valor += s.valor_estimado || 0;
    });

    const totalEstimado = scores.reduce((acc, s) => acc + (s.valor_estimado || 0), 0);
    const ponderado = Object.values(porNivel).reduce(
      (acc, n) => acc + n.valor * n.probabilidade, 0
    );

    return { total_estimado: totalEstimado, por_nivel: porNivel, ponderado };
  }, []);

  return {
    config: configQuery.data,
    configLoading: configQuery.isLoading,
    scores: scoresQuery.data || [],
    scoresLoading: scoresQuery.isLoading,
    isScoring,
    scoreLeads,
    updateConfig: updateConfig.mutate,
    calcularPrevisao,
  };
}
