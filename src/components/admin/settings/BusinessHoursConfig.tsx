import { useState, useEffect } from "react";
import { Clock, Plus, Trash2, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DIAS_SEMANA = [
  { value: 0, label: "Domingo", short: "Dom" },
  { value: 1, label: "Segunda-feira", short: "Seg" },
  { value: 2, label: "Terça-feira", short: "Ter" },
  { value: 3, label: "Quarta-feira", short: "Qua" },
  { value: 4, label: "Quinta-feira", short: "Qui" },
  { value: 5, label: "Sexta-feira", short: "Sex" },
  { value: 6, label: "Sábado", short: "Sáb" },
];

type HorarioRow = {
  id?: string;
  dia_semana: number;
  ativo: boolean;
  hora_inicio: string;
  hora_fim: string;
};

export function BusinessHoursConfig({ tenantId }: { tenantId: string }) {
  const [horarios, setHorarios] = useState<HorarioRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadHorarios();
  }, [tenantId]);

  const loadHorarios = async () => {
    const { data, error } = await supabase
      .from("tenant_horarios_atendimento")
      .select("id, dia_semana, ativo, hora_inicio, hora_fim")
      .eq("tenant_id", tenantId)
      .order("dia_semana");

    if (error) {
      console.error("Error loading hours:", error);
      // Seed default if empty
      setHorarios(DIAS_SEMANA.map(d => ({
        dia_semana: d.value,
        ativo: d.value >= 1 && d.value <= 5, // Mon-Fri
        hora_inicio: "08:00:00",
        hora_fim: "18:00:00",
      })));
    } else if (data && data.length > 0) {
      setHorarios(data.map(d => ({
        ...d,
        hora_inicio: d.hora_inicio || "08:00:00",
        hora_fim: d.hora_fim || "18:00:00",
      })));
    } else {
      // No data yet, seed defaults
      setHorarios(DIAS_SEMANA.map(d => ({
        dia_semana: d.value,
        ativo: d.value >= 1 && d.value <= 5,
        hora_inicio: "08:00:00",
        hora_fim: "18:00:00",
      })));
    }
    setLoading(false);
  };

  const updateHorario = (index: number, field: keyof HorarioRow, value: any) => {
    const updated = [...horarios];
    (updated[index] as any)[field] = value;
    setHorarios(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Upsert all 7 days
      const rows = horarios.map(h => ({
        tenant_id: tenantId,
        dia_semana: h.dia_semana,
        ativo: h.ativo,
        hora_inicio: h.hora_inicio,
        hora_fim: h.hora_fim,
      }));

      const { error } = await supabase
        .from("tenant_horarios_atendimento")
        .upsert(rows, { onConflict: "tenant_id,dia_semana" });

      if (error) throw error;
      toast({ title: "Horários salvos!" });
      loadHorarios();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const formatTime = (time: string) => time?.substring(0, 5) || "08:00";

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Horário de Atendimento</CardTitle>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
        <CardDescription>
          Define quando a empresa está disponível para atendimento
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {horarios.map((h, i) => {
            const dia = DIAS_SEMANA.find(d => d.value === h.dia_semana);
            return (
              <div
                key={h.dia_semana}
                className={`flex items-center gap-3 p-2.5 rounded-lg border transition-colors ${
                  h.ativo
                    ? "border-primary/20 bg-primary/5"
                    : "border-border/60 bg-muted/30"
                }`}
              >
                <Switch
                  checked={h.ativo}
                  onCheckedChange={(v) => updateHorario(i, "ativo", v)}
                />
                <span className={`text-sm font-medium w-24 ${!h.ativo ? "text-muted-foreground" : ""}`}>
                  {dia?.label}
                </span>
                {h.ativo ? (
                  <div className="flex items-center gap-2">
                    <Input
                      type="time"
                      value={formatTime(h.hora_inicio)}
                      onChange={(e) => updateHorario(i, "hora_inicio", e.target.value + ":00")}
                      className="w-28 h-8 text-sm"
                    />
                    <span className="text-xs text-muted-foreground">até</span>
                    <Input
                      type="time"
                      value={formatTime(h.hora_fim)}
                      onChange={(e) => updateHorario(i, "hora_fim", e.target.value + ":00")}
                      className="w-28 h-8 text-sm"
                    />
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground italic">Fechado</span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
