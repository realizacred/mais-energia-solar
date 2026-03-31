import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, CalendarCheck, Calendar } from "lucide-react";
import { VendorTaskAgenda } from "@/components/vendor/VendorTaskAgenda";
import { VendorAppointments } from "@/components/vendor/VendorAppointments";

export default function VendorAgendaView() {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Calendar className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Agenda</h1>
            <p className="text-sm text-muted-foreground">Compromissos e tarefas do dia</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="compromissos" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-xs">
          <TabsTrigger value="compromissos" className="gap-1.5 text-xs">
            <CalendarCheck className="h-3.5 w-3.5" />
            Compromissos
          </TabsTrigger>
          <TabsTrigger value="tarefas" className="gap-1.5 text-xs">
            <ClipboardCheck className="h-3.5 w-3.5" />
            Tarefas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="compromissos" className="mt-4">
          <VendorAppointments />
        </TabsContent>

        <TabsContent value="tarefas" className="mt-4">
          <VendorTaskAgenda />
        </TabsContent>
      </Tabs>
    </div>
  );
}
