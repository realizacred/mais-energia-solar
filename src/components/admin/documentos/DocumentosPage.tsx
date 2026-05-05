import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileText, Receipt, ArrowRight, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import { TemplatesTab } from "./TemplatesTab";
import { RecibosTab } from "./RecibosTab";

const TABS = [
  { value: "documentos", label: "Documentos", icon: FileText },
  { value: "recibos", label: "Recibos", icon: Receipt },
] as const;

export function DocumentosPage() {
  const [tab, setTab] = useState<string>("documentos");
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={FileText}
        title="Documentos & Assinaturas"
        description="Templates de contratos, procurações, termos e recibos. Propostas comerciais ficam centralizadas em /propostas."
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 p-1 rounded-xl">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <TabsTrigger
                key={t.value}
                value={t.value}
                className="gap-1.5 text-xs data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg px-3 py-2"
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="documentos" className="mt-4 space-y-3">
          <TemplatesTab />
        </TabsContent>

        <TabsContent value="recibos" className="mt-4">
          <RecibosTab />
        </TabsContent>
      </Tabs>

      {/* Atalho para Propostas (anti-duplicação de domínio) */}
      <Card className="border-border/60 bg-muted/30">
        <CardContent className="p-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <ScrollText className="h-5 w-5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground flex-1">
            Templates e variáveis de <strong>propostas comerciais</strong> agora vivem no Editor de Proposta —
            evitando duplicação de domínio.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-xs shrink-0"
            onClick={() => navigate("/admin/proposta-comercial")}
          >
            Abrir Propostas <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
