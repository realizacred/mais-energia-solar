/**
 * UCServicePlanCard — Service plan config section for UC billing tab.
 * Shows in UCBillingSettingsTab.
 */
import { useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePlanosServicoAtivos } from "@/hooks/usePlanosServico";
import { useDirtyForm } from "@/hooks/useDirtyForm";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreditCard, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/formatters/index";

interface Props {
  unitId: string;
  planoServicoId: string | null;
  valorMensalidade: number | null;
  diaVencimento: number | null;
  servicoCobrancaAtivo: boolean;
}

function buildFormValues(planoServicoId: string | null, valorMensalidade: number | null, diaVencimento: number | null, servicoCobrancaAtivo: boolean) {
  return {
    plano_servico_id: planoServicoId || "",
    valor_mensalidade: valorMensalidade != null ? String(valorMensalidade) : "",
    dia_vencimento: diaVencimento != null ? String(diaVencimento) : "10",
    servico_cobranca_ativo: servicoCobrancaAtivo,
  };
}

export function UCServicePlanCard({ unitId, planoServicoId, valorMensalidade, diaVencimento, servicoCobrancaAtivo }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: planos = [] } = usePlanosServicoAtivos();

  const initial = buildFormValues(planoServicoId, valorMensalidade, diaVencimento, servicoCobrancaAtivo);
  const { form, setForm, isDirty, commitBaseline, resetTo } = useDirtyForm(initial);

  // Sync baseline when persisted props change (e.g. after query refetch)
  useEffect(() => {
    resetTo(buildFormValues(planoServicoId, valorMensalidade, diaVencimento, servicoCobrancaAtivo));
  }, [planoServicoId, valorMensalidade, diaVencimento, servicoCobrancaAtivo, resetTo]);

  // Auto-fill valor when plano changes
  function handlePlanoChange(planoId: string) {
    const plano = planos.find(p => p.id === planoId);
    setForm(f => ({
      ...f,
      plano_servico_id: planoId,
      valor_mensalidade: plano ? String(plano.valor) : f.valor_mensalidade,
    }));
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("units_consumidoras")
        .update({
          plano_servico_id: form.plano_servico_id || null,
          valor_mensalidade: form.valor_mensalidade ? parseFloat(form.valor_mensalidade) : null,
          dia_vencimento: form.dia_vencimento ? parseInt(form.dia_vencimento, 10) : 10,
          servico_cobranca_ativo: form.servico_cobranca_ativo,
        } as any)
        .eq("id", unitId);
      if (error) throw error;
    },
    onSuccess: () => {
      commitBaseline();
      qc.invalidateQueries({ queryKey: ["uc_billing_list"] });
      qc.invalidateQueries({ queryKey: ["uc_billing_kpis"] });
      toast({ title: "Configurações de cobrança salvas" });
    },
    onError: (err: any) => toast({ title: "Erro", description: err?.message, variant: "destructive" }),
  });

  return (
    <Card className="border-l-[3px] border-l-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Plano de Serviço
          </CardTitle>
          <Switch
            checked={form.servico_cobranca_ativo as boolean}
            onCheckedChange={(v) => setForm({ servico_cobranca_ativo: v })}
          />
        </div>
        <CardDescription>Configure o plano e valor da mensalidade para cobrança automática</CardDescription>
      </CardHeader>

      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Plano</Label>
            <Select value={form.plano_servico_id as string} onValueChange={handlePlanoChange}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {planos.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nome} — {formatBRL(p.valor)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor mensal (R$)</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.valor_mensalidade as string}
              onChange={(e) => setForm({ valor_mensalidade: e.target.value })}
              placeholder="49.90"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Dia de vencimento</Label>
            <Input
              type="number"
              min={1}
              max={28}
              value={form.dia_vencimento as string}
              onChange={(e) => setForm({ dia_vencimento: e.target.value })}
              placeholder="10"
            />
          </div>
        </div>

        <Button onClick={() => saveMut.mutate()} disabled={!isDirty || saveMut.isPending} size="sm">
          {saveMut.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          {saveMut.isPending ? "Salvando..." : "Salvar cobrança"}
        </Button>
      </CardContent>
    </Card>
  );
}
