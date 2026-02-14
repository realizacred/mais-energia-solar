import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, Save } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

const DIAS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

type DiaHorario = { ativo: boolean; inicio: string; fim: string };
type HorariosConsultor = Record<number, DiaHorario>;

const DEFAULT_HORARIOS: HorariosConsultor = Object.fromEntries(
  DIAS.map(d => [d.value, { ativo: d.value >= 1 && d.value <= 5, inicio: "08:00", fim: "18:00" }])
);

export function ConsultorHorariosEdit({ consultorId }: { consultorId: string }) {
  const [usaHorarioProprio, setUsaHorarioProprio] = useState(false);
  const [horarios, setHorarios] = useState<HorariosConsultor>(DEFAULT_HORARIOS);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    loadSettings();
  }, [consultorId]);

  const loadSettings = async () => {
    const { data } = await supabase
      .from("consultores")
      .select("settings")
      .eq("id", consultorId)
      .single();

    if (data?.settings) {
      const s = data.settings as any;
      if (s.horario_proprio) {
        setUsaHorarioProprio(true);
        setHorarios(s.horarios || DEFAULT_HORARIOS);
      }
    }
    setLoaded(true);
  };

  const updateDia = (dia: number, field: keyof DiaHorario, value: any) => {
    setHorarios(prev => ({
      ...prev,
      [dia]: { ...prev[dia], [field]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    // Read current settings first to avoid overwriting other fields
    const { data: current } = await supabase
      .from("consultores")
      .select("settings")
      .eq("id", consultorId)
      .single();

    const currentSettings = (current?.settings as any) || {};
    const newSettings = {
      ...currentSettings,
      horario_proprio: usaHorarioProprio,
      horarios: usaHorarioProprio ? horarios : undefined,
    };

    const { error } = await supabase
      .from("consultores")
      .update({ settings: newSettings as any })
      .eq("id", consultorId);

    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Horários salvos!" });
    }
    setSaving(false);
  };

  if (!loaded) return null;

  return (
    <div className="space-y-3 rounded-lg border p-3 bg-muted/30">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Horário Individual
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Usa horário próprio</span>
          <Switch checked={usaHorarioProprio} onCheckedChange={setUsaHorarioProprio} />
        </div>
      </div>

      {!usaHorarioProprio && (
        <p className="text-xs text-muted-foreground">
          Usando horário da empresa. Ative para definir horário individual.
        </p>
      )}

      {usaHorarioProprio && (
        <div className="space-y-1.5">
          {DIAS.map(d => {
            const h = horarios[d.value] || DEFAULT_HORARIOS[d.value];
            return (
              <div key={d.value} className={`flex items-center gap-2 p-1.5 rounded-md text-xs ${h.ativo ? "bg-primary/5" : "bg-background"}`}>
                <Switch checked={h.ativo} onCheckedChange={v => updateDia(d.value, "ativo", v)} />
                <span className={`w-8 font-medium ${!h.ativo ? "text-muted-foreground" : ""}`}>{d.label}</span>
                {h.ativo ? (
                  <div className="flex items-center gap-1">
                    <Input type="time" value={h.inicio} onChange={e => updateDia(d.value, "inicio", e.target.value)} className="w-24 h-6 text-xs px-1.5" />
                    <span className="text-muted-foreground">-</span>
                    <Input type="time" value={h.fim} onChange={e => updateDia(d.value, "fim", e.target.value)} className="w-24 h-6 text-xs px-1.5" />
                  </div>
                ) : (
                  <span className="text-muted-foreground italic">Folga</span>
                )}
              </div>
            );
          })}
          <Button size="sm" variant="outline" onClick={handleSave} disabled={saving} className="w-full mt-2 gap-1 h-7 text-xs">
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Salvar Horários
          </Button>
        </div>
      )}
    </div>
  );
}
