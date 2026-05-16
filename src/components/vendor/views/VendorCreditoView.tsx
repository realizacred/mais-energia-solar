import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  Search, 
  Filter, 
  Plus, 
  ArrowRight,
  Clock,
  CheckCircle2,
  XCircle,
  FileText
} from "lucide-react";
import { useAnaliseCredito } from "@/hooks/useAnaliseCredito";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/formatters";
import { formatDateTime } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

import { STATUS_CONFIG } from "@/components/admin/projetos/ProjetoCreditoTab";
import { CreditAnalysisWizard } from "@/components/admin/projetos/CreditAnalysisWizard";

export default function VendorCreditoView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isWizardOpen, setIsWizardOpen] = useState(false);

  const { data: analises, isLoading } = useQuery({
    queryKey: ["vendor-credito-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analise_credito")
        .select(`
          *,
          deal:deals(id, title),
          lead:leads(id, nome)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    }
  });

  const filteredAnalises = analises?.filter(a => 
    a.banco?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.cpf_cnpj?.includes(searchTerm) ||
    a.deal?.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.lead?.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const stats = useMemo(() => {
    if (!analises) return { total: 0, pending: 0, approved: 0 };
    return {
      total: analises.length,
      pending: analises.filter(a => ['pendente_documentos', 'em_analise', 'enviada_ao_banco'].includes(a.status)).length,
      approved: analises.filter(a => ['aprovado', 'aprovado_com_condicoes'].includes(a.status)).length
    };
  }, [analises]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-20 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 md:pb-6 animate-in fade-in duration-500">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CreditCard className="h-6 w-6 text-primary" />
            Análise de Crédito
          </h2>
          <p className="text-muted-foreground">
            Acompanhe o status das solicitações de crédito dos seus clientes.
          </p>
        </div>
        <Button onClick={() => setIsWizardOpen(true)} className="gap-2 shadow-lg shadow-primary/20">
          <Plus className="h-4 w-4" /> Solicitar Crédito
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="bg-primary/5 border-primary/10 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Total</p>
            <p className="text-2xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/10 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Em Processo</p>
            <p className="text-2xl font-bold">{stats.pending}</p>
          </CardContent>
        </Card>
        <Card className="bg-success/5 border-success/10 shadow-sm">
          <CardContent className="pt-4">
            <p className="text-xs font-medium text-muted-foreground uppercase">Aprovados</p>
            <p className="text-2xl font-bold text-success">{stats.approved}</p>
          </CardContent>
        </Card>
      </div>

      <div className="relative group">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
        <Input 
          placeholder="Buscar por cliente, banco ou CPF/CNPJ..." 
          className="pl-10 bg-background/50 border-border/50 focus:bg-background"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      {filteredAnalises && filteredAnalises.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {filteredAnalises.map((analise) => {
            const config = STATUS_CONFIG[analise.status] || STATUS_CONFIG.rascunho;
            const Icon = config.icon;
            const clientName = analise.deal?.title || analise.lead?.nome || "Cliente não identificado";

            return (
              <Card key={analise.id} className="group hover:border-primary/40 transition-all shadow-sm active:scale-[0.98]">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base truncate">{clientName}</span>
                        <Badge variant="outline" className={cn("text-[10px] uppercase font-bold", config.color)}>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="font-medium">{analise.banco || "Banco não definido"}</span>
                        <span>•</span>
                        <span>{formatDateTime(analise.created_at)}</span>
                      </div>
                    </div>
                    <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-inner", config.color)}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between pt-4 border-t border-border/40">
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase font-medium text-muted-foreground">Valor Solicitado</p>
                      <p className="text-sm font-bold text-primary">{formatBRL(analise.valor_solicitado || 0)}</p>
                    </div>
                    <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs text-muted-foreground">
                      Ver detalhes <ArrowRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-muted/20 rounded-xl border-2 border-dashed">
          <CreditCard className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-lg font-semibold">Nenhuma análise encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">Refine sua busca ou inicie uma nova solicitação.</p>
        </div>
      )}

      {isWizardOpen && (
        <CreditAnalysisWizard
          isOpen={isWizardOpen}
          onClose={() => setIsWizardOpen(false)}
        />
      )}
    </div>
  );
}


