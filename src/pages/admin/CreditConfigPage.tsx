/**
 * Reutiliza:
 * - Tabelas: credit_bank_configs, credit_workflow_configs
 * - Substitui: financiamento_bancos, FinanciamentoConfig.tsx (deprecated)
 * - Hooks: useCreditConfigs
 */
import { useState } from "react";
import { Plus, Settings2, ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCreditBankConfigs, CreditBankConfig } from "@/hooks/useCreditConfigs";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CreditStats } from "@/components/admin/credit/CreditStats";
import { CreditBankList } from "@/components/admin/credit/CreditBankList";
import { CreditBankDialog } from "@/components/admin/credit/CreditBankDialog";
import { CreditChecklistManager } from "@/components/admin/credit/CreditChecklistManager";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export default function CreditConfigPage() {
  const navigate = useNavigate();
  const { data: banks, isLoading } = useCreditBankConfigs();
  const [isBankDialogOpen, setIsBankDialogOpen] = useState(false);
  const [selectedBank, setSelectedBank] = useState<CreditBankConfig | undefined>(undefined);
  const [activeBankForChecklist, setActiveBankForChecklist] = useState<CreditBankConfig | undefined>(undefined);

  const handleEditBank = (bank: CreditBankConfig) => {
    setSelectedBank(bank);
    setIsBankDialogOpen(true);
  };

  const handleAddBank = () => {
    setSelectedBank(undefined);
    setIsBankDialogOpen(true);
  };

  const handleManageChecklist = (bank: CreditBankConfig) => {
    setActiveBankForChecklist(bank);
    // Scroll smoothly to checklist manager if on mobile
    if (window.innerWidth < 768) {
      setTimeout(() => {
        document.getElementById("checklist-section")?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 md:p-6 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Configurações de Crédito</h1>
          </div>
          <p className="text-muted-foreground">
            Defina os bancos disponíveis e o checklist documental para análise de crédito.
          </p>
        </div>
        <Button onClick={handleAddBank}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Banco
        </Button>
      </div>

      <CreditStats banks={banks || []} />

      <div className="grid gap-8 lg:grid-cols-12">
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Bancos Habilitados</h2>
          </div>
          <CreditBankList 
            banks={banks || []} 
            onEdit={handleEditBank}
            onManageChecklist={handleManageChecklist}
          />
        </div>

        <div className="lg:col-span-5 space-y-4" id="checklist-section">
          {activeBankForChecklist ? (
            <Card className="border-primary/20 shadow-md">
              <CardContent className="pt-6">
                <CreditChecklistManager bank={activeBankForChecklist} />
              </CardContent>
            </Card>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center bg-muted/30">
              <Settings2 className="h-10 w-10 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium text-muted-foreground">Gerenciador de Checklist</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-[250px]">
                Selecione "Gerenciar Checklist" em um banco ao lado para editar seus documentos.
              </p>
            </div>
          )}
        </div>
      </div>

      <CreditBankDialog 
        open={isBankDialogOpen} 
        onOpenChange={setIsBankDialogOpen} 
        bank={selectedBank}
      />
    </div>
  );
}
