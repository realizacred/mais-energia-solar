import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, CalendarCheck } from "lucide-react";
import { VendorTaskAgenda } from "@/components/vendor/VendorTaskAgenda";
import { VendorAppointments } from "@/components/vendor/VendorAppointments";

export default function VendorAgendaView() {
  return (
    <div className="space-y-4 sm:space-y-6">
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
