/**
 * VisitasCalendario — Calendário mensal de visitas técnicas.
 * §26: Header padrão — §12: Skeleton — §27: KPI — §1: Cores semânticas.
 */
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar, ChevronLeft, ChevronRight, Plus, MapPin, Clock, User, ExternalLink } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useVisitasTecnicas, useCriarVisita } from "@/hooks/useVisitasTecnicas";
import { useConsultoresList } from "@/hooks/useConsultoresList";

const STATUS_COLORS: Record<string, string> = {
  agendada: "bg-info/10 text-info border-info/20",
  confirmada: "bg-primary/10 text-primary border-primary/20",
  realizada: "bg-success/10 text-success border-success/20",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** Open Google Calendar with pre-filled event data */
function openGoogleCalendar(visita: { data_hora: string; duracao_minutos?: number | null; endereco?: string | null; observacoes?: string | null }) {
  const start = new Date(visita.data_hora);
  const end = new Date(start.getTime() + (visita.duracao_minutos || 60) * 60000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: `Visita Técnica${visita.endereco ? " — " + visita.endereco : ""}`,
    dates: `${fmt(start)}/${fmt(end)}`,
    details: visita.observacoes || "Visita técnica agendada pelo sistema",
    location: visita.endereco || "",
  });
  window.open(`https://calendar.google.com/calendar/render?${params.toString()}`, "_blank");
}

export function VisitasCalendario() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const mes = currentDate.getMonth();
  const ano = currentDate.getFullYear();

  const { data: visitas = [], isLoading } = useVisitasTecnicas(mes, ano);
  const criarVisita = useCriarVisita();

  // Fetch consultores for select
  const { data: consultores = [] } = useConsultoresList();

  // Form state
  const [form, setForm] = useState({
    consultor_id: "",
    endereco: "",
    observacoes: "",
    hora: "09:00",
    duracao_minutos: 60,
  });

  const days = useMemo(() => {
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    return eachDayOfInterval({ start, end });
  }, [currentDate]);

  const startPadding = getDay(days[0]);

  const visitasByDay = useMemo(() => {
    const map = new Map<string, typeof visitas>();
    visitas.forEach((v) => {
      const key = format(new Date(v.data_hora), "yyyy-MM-dd");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(v);
    });
    return map;
  }, [visitas]);

  const handleDayClick = (day: Date) => {
    setSelectedDate(day);
    setDialogOpen(true);
  };

  const [lastCreated, setLastCreated] = useState<{ data_hora: string; duracao_minutos: number; endereco: string; observacoes: string } | null>(null);

  const handleSave = () => {
    if (!selectedDate) return;
    const [h, m] = form.hora.split(":").map(Number);
    const dataHora = new Date(selectedDate);
    dataHora.setHours(h, m, 0, 0);

    const visitaData = {
      data_hora: dataHora.toISOString(),
      duracao_minutos: form.duracao_minutos,
      endereco: form.endereco,
      observacoes: form.observacoes,
    };

    criarVisita.mutate({
      lead_id: null,
      cliente_id: null,
      consultor_id: form.consultor_id || null,
      data_hora: dataHora.toISOString(),
      duracao_minutos: form.duracao_minutos,
      endereco: form.endereco || null,
      status: "agendada",
      observacoes: form.observacoes || null,
      created_by: null,
    });
    setLastCreated(visitaData);
    setDialogOpen(false);
    setForm({ consultor_id: "", endereco: "", observacoes: "", hora: "09:00", duracao_minutos: 60 });
  };

  const today = new Date();

  // Upcoming visitas (next 7)
  const upcoming = useMemo(() => {
    return visitas
      .filter((v) => new Date(v.data_hora) >= today && v.status !== "cancelada")
      .slice(0, 7);
  }, [visitas, today]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Calendar className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Visitas Técnicas</h1>
            <p className="text-sm text-muted-foreground">Agendamento e acompanhamento de visitas</p>
          </div>
        </div>
        <Button size="sm" onClick={() => { setSelectedDate(new Date()); setDialogOpen(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova Visita
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Calendar */}
        <div className="lg:col-span-3">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="text-base capitalize">
                  {format(currentDate, "MMMM yyyy", { locale: ptBR })}
                </CardTitle>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-2">
              {/* Weekday headers */}
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">
                    {d}
                  </div>
                ))}
              </div>
              {/* Days */}
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: startPadding }).map((_, i) => (
                  <div key={`pad-${i}`} className="h-20" />
                ))}
                {days.map((day) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayVisitas = visitasByDay.get(key) || [];
                  const isToday = isSameDay(day, today);
                  return (
                    <div
                      key={key}
                      className={`h-20 rounded-lg border p-1 cursor-pointer transition-colors hover:bg-muted/50 ${
                        isToday ? "border-primary bg-primary/5" : "border-border"
                      }`}
                      onClick={() => handleDayClick(day)}
                    >
                      <p className={`text-xs font-medium ${isToday ? "text-primary" : "text-foreground"}`}>
                        {format(day, "d")}
                      </p>
                      <div className="space-y-0.5 mt-0.5">
                        {dayVisitas.slice(0, 2).map((v) => (
                          <div
                            key={v.id}
                            className="text-[10px] leading-tight truncate px-1 py-0.5 rounded bg-primary/10 text-primary"
                          >
                            {format(new Date(v.data_hora), "HH:mm")}
                          </div>
                        ))}
                        {dayVisitas.length > 2 && (
                          <p className="text-[10px] text-muted-foreground">+{dayVisitas.length - 2}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar: upcoming */}
        <div className="lg:col-span-1">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-foreground">Próximas Visitas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="max-h-[500px]">
                {upcoming.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground text-center">Nenhuma visita agendada</p>
                ) : (
                  <div className="divide-y divide-border">
                    {upcoming.map((v) => (
                      <div key={v.id} className="p-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium text-foreground">
                            {format(new Date(v.data_hora), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                          <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[v.status] || ""}`}>
                            {v.status}
                          </Badge>
                        </div>
                        {v.endereco && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="w-3 h-3" />
                            <span className="truncate">{v.endereco}</span>
                          </div>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] text-muted-foreground hover:text-primary mt-1"
                          onClick={(e) => { e.stopPropagation(); openGoogleCalendar(v); }}
                        >
                          <ExternalLink className="w-3 h-3 mr-1" />
                          Google Calendar
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* New visit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Agendar Visita</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {selectedDate ? format(selectedDate, "dd/MM/yyyy", { locale: ptBR }) : ""}
              </p>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4 flex-1 min-h-0 overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Horário</Label>
                <Input type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} />
              </div>
              <div>
                <Label className="text-xs">Duração (min)</Label>
                <Input type="number" value={form.duracao_minutos} onChange={(e) => setForm({ ...form, duracao_minutos: Number(e.target.value) })} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Consultor</Label>
              <Select value={form.consultor_id} onValueChange={(v) => setForm({ ...form, consultor_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {consultores.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Endereço</Label>
              <Input value={form.endereco} onChange={(e) => setForm({ ...form, endereco: e.target.value })} placeholder="Endereço da visita" />
            </div>
            <div>
              <Label className="text-xs">Observações</Label>
              <Textarea value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} rows={3} placeholder="Notas sobre a visita..." />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={criarVisita.isPending}>
              {criarVisita.isPending ? "Salvando..." : "Agendar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
