import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Variable, FileText, Mail, Settings } from "lucide-react";
import { VariaveisDisponiveisPage } from "./VariaveisDisponiveisPage";
import { TemplatesManager } from "@/components/admin/propostas-nativas/TemplatesManager";
import { EmailTemplatesPage } from "./EmailTemplatesPage";
import { PropostaConfigPage } from "./PropostaConfigPage";

export function PropostaComercialPage() {
  return (
    <div className="space-y-4">
      <Tabs defaultValue="variaveis">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="variaveis" className="gap-1.5 text-xs sm:text-sm">
            <Variable className="h-4 w-4" />
            <span className="hidden sm:inline">Variáveis Disponíveis</span>
            <span className="sm:hidden">Variáveis</span>
          </TabsTrigger>
          <TabsTrigger value="modelos-proposta" className="gap-1.5 text-xs sm:text-sm">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Modelos de Proposta</span>
            <span className="sm:hidden">Propostas</span>
          </TabsTrigger>
          <TabsTrigger value="modelos-email" className="gap-1.5 text-xs sm:text-sm">
            <Mail className="h-4 w-4" />
            <span className="hidden sm:inline">Modelos de E-mail</span>
            <span className="sm:hidden">E-mails</span>
          </TabsTrigger>
          <TabsTrigger value="configuracoes" className="gap-1.5 text-xs sm:text-sm">
            <Settings className="h-4 w-4" />
            <span className="hidden sm:inline">Configurações</span>
            <span className="sm:hidden">Config</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="variaveis">
          <VariaveisDisponiveisPage />
        </TabsContent>
        <TabsContent value="modelos-proposta">
          <TemplatesManager />
        </TabsContent>
        <TabsContent value="modelos-email">
          <EmailTemplatesPage />
        </TabsContent>
        <TabsContent value="configuracoes">
          <PropostaConfigPage />
        </TabsContent>
      </Tabs>
    </div>
  );
}
