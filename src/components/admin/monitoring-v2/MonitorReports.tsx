import React from "react";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function MonitorReports() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Relatórios de geração e performance das usinas"
        icon={FileText}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SectionCard title="Geração por Período" icon={FileText} variant="blue">
          <EmptyState
            icon={FileText}
            title="Em breve"
            description="Relatório de geração por usina e período personalizado com exportação CSV."
            action={{
              label: "Exportar CSV",
              onClick: () => {},
              icon: Download,
            }}
          />
        </SectionCard>

        <SectionCard title="Usinas Offline (Ranking)" icon={FileText} variant="warning">
          <EmptyState
            icon={FileText}
            title="Em breve"
            description="Ranking de usinas com maior tempo offline acumulado."
          />
        </SectionCard>
      </div>
    </div>
  );
}
