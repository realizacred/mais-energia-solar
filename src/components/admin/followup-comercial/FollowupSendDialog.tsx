/**
 * Dialog de envio manual de follow-up de proposta (Phase 2).
 *
 * Reutiliza shadcn Dialog. Mensagem editável com sugestão padrão.
 * Mostra guardrails (cliente, canal, tentativa nº) antes do envio.
 * Não duplica lógica: validação pesada é no edge function proposal-followup-send.
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Send, Loader2, Phone, Sparkles, Flame, ThermometerSun, Snowflake, History, ChevronDown, ChevronRight, Target } from "lucide-react";
import { useSendProposalFollowup, useFollowupAiSuggestion } from "@/hooks/useFollowupComercial";
import type { FollowupInboxRow, FollowupAiSuggestion } from "@/hooks/useFollowupComercial";
import { FollowupHistoryTimeline } from "./FollowupHistoryTimeline";
import { formatDiasParado } from "@/lib/formatters/diasParado";

interface Props {
  row: FollowupInboxRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "mensagem" | "historico";
}

function defaultMessage(row: FollowupInboxRow): string {
  const nome = (row.cliente_nome ?? "").split(" ")[0] || "tudo bem";
  const titulo = row.titulo ? ` sobre a proposta "${row.titulo}"` : "";
  return (
    `Olá, ${nome}! Tudo bem?\n\n` +
    `Passando para retomar nosso contato${titulo}. ` +
    `Posso esclarecer alguma dúvida ou ajustar algum ponto para seguirmos?\n\n` +
    `Aguardo seu retorno. Obrigado!`
  );
}

function formatPhone(p: string | null) {
  if (!p) return "—";
  const d = p.replace(/\D/g, "");
  if (d.length === 13) return `+${d.slice(0, 2)} (${d.slice(2, 4)}) ${d.slice(4, 9)}-${d.slice(9)}`;
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  return p;
}

export function FollowupSendDialog({ row, open, onOpenChange }: Props) {
  const [message, setMessage] = useState("");
  const [force, setForce] = useState(false);
  const [forceReason, setForceReason] = useState("");
  const [aiSuggestion, setAiSuggestion] = useState<FollowupAiSuggestion | null>(null);
  const [aiCooldown, setAiCooldown] = useState(0);
  const [breakdownOpen, setBreakdownOpen] = useState(false);
  const send = useSendProposalFollowup();
  const aiSuggest = useFollowupAiSuggestion();

  useEffect(() => {
    if (row && open) {
      setMessage(defaultMessage(row));
      setForce(false);
      setForceReason("");
      setAiSuggestion(null);
      setAiCooldown(0);
      setBreakdownOpen(false);
    }
  }, [row, open]);

  useEffect(() => {
    if (aiCooldown <= 0) return;
    const t = setTimeout(() => setAiCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(t);
  }, [aiCooldown]);

  const charCount = message.length;
  const tooShort = charCount < 5;
  const tooLong = charCount > 2000;
  const attemptNumber = useMemo(() => (row?.qtd_followups ?? 0) + 1, [row]);

  if (!row) return null;

  const handleSend = async () => {
    try {
      await send.mutateAsync({
        proposta_id: row.proposta_id,
        versao_id: row.versao_id,
        message: message.trim(),
        force,
        force_reason: force ? forceReason.trim() : undefined,
      });
      onOpenChange(false);
    } catch {
      // toast já tratado no hook; permite override quando aplicável
    }
  };

  const handleAiSuggest = async () => {
    try {
      const result = await aiSuggest.mutateAsync(row);
      setAiSuggestion(result);
      if (result.mensagem_sugerida) setMessage(result.mensagem_sugerida);
      setAiCooldown(3);
    } catch { /* toast já tratado */ }
  };

  const aiBusy = aiSuggest.isPending || aiCooldown > 0;

  const tempIcon = (lvl: string) =>
    lvl === "alto" ? <Flame className="h-3 w-3" />
    : lvl === "medio" ? <ThermometerSun className="h-3 w-3" />
    : <Snowflake className="h-3 w-3" />;
  const tempColor = (lvl: string) =>
    lvl === "alto" ? "border-destructive/40 bg-destructive/5 text-destructive"
    : lvl === "medio" ? "border-warning/40 bg-warning/5 text-warning-foreground"
    : "border-info/40 bg-info/5 text-info-foreground";

  const lastError = send.error;
  const isOverridable =
    lastError &&
    ["cooldown_active", "daily_cap_reached", "max_attempts_reached"].includes(lastError.code);
  const forceReasonInvalid = force && forceReason.trim().length < 5;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Follow-up via WhatsApp</DialogTitle>
          <DialogDescription>
            Mensagem manual com guardrails de cooldown, opt-out e limite diário.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md border border-border p-3 bg-muted/30 text-sm space-y-1">
            <div className="font-medium text-foreground truncate">
              {row.cliente_nome ?? "Cliente sem nome"}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Phone className="h-3.5 w-3.5" />
              {formatPhone(row.telefone_normalized)}
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge variant="outline" className="text-[10px]">
                Tentativa #{attemptNumber}
              </Badge>
              {row.dias_parado != null && (
                <Badge variant="outline" className="text-[10px]">
                  {formatDiasParado(row.dias_parado)}
                </Badge>
              )}
              {row.titulo && (
                <Badge variant="outline" className="text-[10px] truncate max-w-[180px]">
                  {row.codigo ? `${row.codigo} · ` : ""}{row.titulo}
                </Badge>
              )}
            </div>
          </div>

          <Tabs defaultValue="mensagem" className="w-full">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="mensagem" className="gap-1.5 text-xs">
                <Send className="h-3.5 w-3.5" /> Mensagem
              </TabsTrigger>
              <TabsTrigger value="historico" className="gap-1.5 text-xs">
                <History className="h-3.5 w-3.5" /> Histórico
              </TabsTrigger>
            </TabsList>

            <TabsContent value="mensagem" className="space-y-4 mt-3">
              {aiSuggestion && (
                <div className={`rounded-md border p-3 text-xs space-y-2 ${tempColor(aiSuggestion.nivel_urgencia)}`}>
                  <div className="flex items-center gap-2 font-medium">
                    {tempIcon(aiSuggestion.nivel_urgencia)}
                    Prioridade: {aiSuggestion.nivel_urgencia.toUpperCase()}
                    {typeof aiSuggestion.score_total === "number" && (
                      <Badge variant="outline" className="text-[10px] ml-1 font-mono">
                        Score {aiSuggestion.score_total}/100
                      </Badge>
                    )}
                    <span className="ml-auto text-[10px] opacity-70">Risco: {aiSuggestion.risco}</span>
                  </div>

                  {aiSuggestion.motivo && <p className="opacity-80">{aiSuggestion.motivo}</p>}

                  {aiSuggestion.acao_recomendada && (
                    <div className="flex items-start gap-1.5 text-[11px] font-medium pt-1 border-t border-current/10">
                      <Target className="h-3 w-3 mt-0.5 shrink-0" />
                      <span>Ação: {aiSuggestion.acao_recomendada}</span>
                    </div>
                  )}

                  {aiSuggestion.score_breakdown && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => setBreakdownOpen((v) => !v)}
                        className="flex items-center gap-1 text-[10px] uppercase tracking-wide opacity-70 hover:opacity-100"
                      >
                        {breakdownOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        Detalhamento do score
                      </button>
                      {breakdownOpen && (
                        <div className="mt-1.5 grid grid-cols-2 gap-1.5 text-[11px]">
                          {[
                            { k: "engajamento", label: "Engajamento" },
                            { k: "urgencia_temporal", label: "Urgência" },
                            { k: "valor", label: "Valor" },
                            { k: "risco", label: "Risco" },
                          ].map((item) => {
                            const v = (aiSuggestion.score_breakdown as any)?.[item.k] ?? 0;
                            return (
                              <div key={item.k} className="flex items-center gap-1.5">
                                <span className="opacity-70 w-20 shrink-0">{item.label}</span>
                                <div className="flex-1 h-1.5 rounded-full bg-current/10 overflow-hidden">
                                  <div className="h-full bg-current/60" style={{ width: `${v}%` }} />
                                </div>
                                <span className="font-mono text-[10px] w-7 text-right">{v}</span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {aiSuggestion.razoes && aiSuggestion.razoes.length > 0 && (
                    <ul className="text-[11px] space-y-0.5 pt-1 border-t border-current/10 list-disc list-inside opacity-80">
                      {aiSuggestion.razoes.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  )}

                  {aiSuggestion.precisa_revisao_humana && (
                    <div className="flex items-center gap-1 text-[11px] pt-1 border-t border-current/10">
                      <AlertTriangle className="h-3 w-3" /> Revisão humana recomendada antes de enviar.
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-foreground">Mensagem</label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px]"
                    onClick={handleAiSuggest}
                    disabled={aiBusy}
                    title={aiCooldown > 0 ? `Aguarde ${aiCooldown}s antes de gerar novamente` : "Sugerir mensagem com IA"}
                  >
                    {aiSuggest.isPending ? (
                      <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3 mr-1" />
                    )}
                    {aiCooldown > 0 ? `Aguarde ${aiCooldown}s` : "Sugerir com IA"}
                  </Button>
                </div>
                <Textarea
                  rows={8}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Digite a mensagem…"
                  className="text-sm"
                />
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>Tom claro, curto, com call-to-action.</span>
                  <span className={tooLong ? "text-destructive" : ""}>{charCount}/2000</span>
                </div>
              </div>

              {lastError && (
                <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="space-y-1 min-w-0">
                    <div className="font-medium">{lastError.message}</div>
                    {isOverridable && (
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 text-[11px] text-foreground/80">
                          <input
                            type="checkbox"
                            checked={force}
                            onChange={(e) => setForce(e.target.checked)}
                            className="h-3.5 w-3.5"
                          />
                          Forçar envio mesmo assim (registrado em auditoria)
                        </label>
                        {force && (
                          <Textarea
                            rows={2}
                            value={forceReason}
                            onChange={(e) => setForceReason(e.target.value)}
                            placeholder="Justificativa (mín. 5 caracteres) — obrigatória para auditoria."
                            className="text-xs text-foreground"
                          />
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="historico" className="mt-3">
              <FollowupHistoryTimeline propostaId={row.proposta_id} enabled={open} />
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={send.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSend}
            disabled={send.isPending || tooShort || tooLong || forceReasonInvalid}
          >
            {send.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Enviar follow-up
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
