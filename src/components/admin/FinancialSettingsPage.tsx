import React from "react";
import { useFinancialSettings, FinancialSettings } from "@/hooks/useFinancialSettings";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const FinancialSettingsPage = () => {
  const { data: settings, isLoading, refetch } = useFinancialSettings();
  const { data: tenantId } = useTenantId();
  const { toast } = useToast();

  const handleUpdate = async (updates: Partial<FinancialSettings>) => {
    if (!tenantId) return;

    const { error } = await supabase
      .from('financial_settings')
      .update(updates)
      .eq('tenant_id', tenantId);

    if (error) {
      toast({
        variant: "destructive",
        title: "Erro ao atualizar configurações",
        description: error.message
      });
    } else {
      toast({
        title: "Configurações atualizadas",
        description: "As regras financeiras foram salvas com sucesso."
      });
      refetch();
    }
  };

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Configurações Financeiras</h1>
        <p className="text-muted-foreground">Gerencie as regras operacionais do seu domínio financeiro SaaS.</p>
      </div>

      <Tabs defaultValue="receipts" className="space-y-4">
        <TabsList>
          <TabsTrigger value="receipts">Recibos</TabsTrigger>
          <TabsTrigger value="cash">Caixa</TabsTrigger>
          <TabsTrigger value="commissions">Comissões</TabsTrigger>
          <TabsTrigger value="audit">Auditoria</TabsTrigger>
        </TabsList>

        <TabsContent value="receipts">
          <Card>
            <CardHeader>
              <CardTitle>Configurações de Recibos</CardTitle>
              <CardDescription>Defina como os recibos são gerados e numerados.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="receipt_auto_emit">Emissão Automática</Label>
                <Switch 
                  id="receipt_auto_emit" 
                  checked={settings?.receipt_auto_emit} 
                  onCheckedChange={(v) => handleUpdate({ receipt_auto_emit: v })}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="receipt_auto_numbering">Numeração Sequencial</Label>
                <Switch 
                  id="receipt_auto_numbering" 
                  checked={settings?.receipt_auto_numbering} 
                  onCheckedChange={(v) => handleUpdate({ receipt_auto_numbering: v })}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="receipt_show_qrcode">Exibir QRCode de Validação</Label>
                <Switch 
                  id="receipt_show_qrcode" 
                  checked={settings?.receipt_show_qrcode} 
                  onCheckedChange={(v) => handleUpdate({ receipt_show_qrcode: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cash">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Caixa</CardTitle>
              <CardDescription>Regras para abertura e fechamento de caixa operacional.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="cash_strict_opening">Exigir Abertura de Caixa</Label>
                <Switch 
                  id="cash_strict_opening" 
                  checked={settings?.cash_strict_opening} 
                  onCheckedChange={(v) => handleUpdate({ cash_strict_opening: v })}
                />
              </div>
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="cash_daily_closing">Fechamento Diário Obrigatório</Label>
                <Switch 
                  id="cash_daily_closing" 
                  checked={settings?.cash_daily_closing} 
                  onCheckedChange={(v) => handleUpdate({ cash_daily_closing: v })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions">
          <Card>
            <CardHeader>
              <CardTitle>Regras de Comissionamento</CardTitle>
              <CardDescription>Defina os gatilhos para liberação de comissões.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="commission_trigger">Gatilho de Comissão</Label>
                <Select 
                  value={settings?.commission_trigger} 
                  onValueChange={(v: any) => handleUpdate({ commission_trigger: v })}
                >
                  <SelectTrigger id="commission_trigger">
                    <SelectValue placeholder="Selecione o gatilho" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="proposal_accepted">Aceite da Proposta</SelectItem>
                    <SelectItem value="payment_cleared">Quitação do Pagamento</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <Card>
            <CardHeader>
              <CardTitle>Segurança e Auditoria</CardTitle>
              <CardDescription>Controle de travas e rastreabilidade.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between space-x-2">
                <Label htmlFor="audit_require_justification">Exigir Justificativa para Edição</Label>
                <Switch 
                  id="audit_require_justification" 
                  checked={settings?.audit_require_justification} 
                  onCheckedChange={(v) => handleUpdate({ audit_require_justification: v })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="audit_lock_days">Lock Financeiro (Dias após pagamento)</Label>
                <Input 
                  id="audit_lock_days" 
                  type="number"
                  value={settings?.audit_lock_days || 0}
                  onChange={(e) => handleUpdate({ audit_lock_days: parseInt(e.target.value) })}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialSettingsPage;
