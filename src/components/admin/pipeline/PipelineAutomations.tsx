 import { useState, useEffect } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { useToast } from "@/hooks/use-toast";
 import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Switch } from "@/components/ui/switch";
 import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { Badge } from "@/components/ui/badge";
 import {
   Dialog,
   DialogContent,
   DialogDescription,
   DialogFooter,
   DialogHeader,
   DialogTitle,
   DialogTrigger,
 } from "@/components/ui/dialog";
 import {
   Zap,
   Plus,
   Clock,
   ArrowRight,
   Bell,
   Mail,
   AlertTriangle,
   Settings2,
   Trash2,
 } from "lucide-react";
 
 interface LeadStatus {
   id: string;
   nome: string;
   cor: string;
 }
 
 interface AutomationRule {
   id: string;
   name: string;
   enabled: boolean;
   trigger: "days_inactive" | "status_change" | "high_consumption";
   triggerValue: number | string;
   action: "move_status" | "send_notification" | "assign_vendedor";
   actionValue: string;
 }
 
 interface PipelineAutomationsProps {
   statuses: LeadStatus[];
   onApplyAutomation: (rule: AutomationRule) => void;
 }
 
 // Local storage key for automation rules
 const AUTOMATION_RULES_KEY = "pipeline_automation_rules";
 
 export function PipelineAutomations({ statuses, onApplyAutomation }: PipelineAutomationsProps) {
   const { toast } = useToast();
   const [rules, setRules] = useState<AutomationRule[]>([]);
   const [isDialogOpen, setIsDialogOpen] = useState(false);
   const [editingRule, setEditingRule] = useState<AutomationRule | null>(null);
 
   // Form state
   const [formName, setFormName] = useState("");
   const [formTrigger, setFormTrigger] = useState<AutomationRule["trigger"]>("days_inactive");
   const [formTriggerValue, setFormTriggerValue] = useState<string>("3");
   const [formAction, setFormAction] = useState<AutomationRule["action"]>("send_notification");
   const [formActionValue, setFormActionValue] = useState("");
 
   // Load rules from localStorage
   useEffect(() => {
     const saved = localStorage.getItem(AUTOMATION_RULES_KEY);
     if (saved) {
       try {
         setRules(JSON.parse(saved));
       } catch {
         setRules(getDefaultRules());
       }
     } else {
       setRules(getDefaultRules());
     }
   }, []);
 
   // Save rules to localStorage
   useEffect(() => {
     if (rules.length > 0) {
       localStorage.setItem(AUTOMATION_RULES_KEY, JSON.stringify(rules));
     }
   }, [rules]);
 
   const getDefaultRules = (): AutomationRule[] => [
     {
       id: "1",
       name: "Alerta de inatividade (3 dias)",
       enabled: true,
       trigger: "days_inactive",
       triggerValue: 3,
       action: "send_notification",
       actionValue: "Lead sem contato há 3 dias",
     },
     {
       id: "2",
       name: "Alto consumo prioritário",
       enabled: true,
       trigger: "high_consumption",
       triggerValue: 800,
       action: "send_notification",
       actionValue: "Lead com alto potencial identificado",
     },
   ];
 
   const handleToggleRule = (ruleId: string) => {
     setRules((prev) =>
       prev.map((r) => (r.id === ruleId ? { ...r, enabled: !r.enabled } : r))
     );
     toast({
       title: "Automação atualizada",
       description: "A regra foi atualizada com sucesso.",
     });
   };
 
   const handleDeleteRule = (ruleId: string) => {
     setRules((prev) => prev.filter((r) => r.id !== ruleId));
     toast({
       title: "Automação removida",
       description: "A regra foi removida com sucesso.",
     });
   };
 
   const handleSaveRule = () => {
     const newRule: AutomationRule = {
       id: editingRule?.id || Date.now().toString(),
       name: formName,
       enabled: true,
       trigger: formTrigger,
       triggerValue: formTrigger === "high_consumption" ? parseInt(formTriggerValue) : parseInt(formTriggerValue),
       action: formAction,
       actionValue: formActionValue,
     };
 
     if (editingRule) {
       setRules((prev) => prev.map((r) => (r.id === editingRule.id ? newRule : r)));
     } else {
       setRules((prev) => [...prev, newRule]);
     }
 
     resetForm();
     setIsDialogOpen(false);
     toast({
       title: editingRule ? "Automação atualizada" : "Automação criada",
       description: "A regra foi salva com sucesso.",
     });
   };
 
   const resetForm = () => {
     setFormName("");
     setFormTrigger("days_inactive");
     setFormTriggerValue("3");
     setFormAction("send_notification");
     setFormActionValue("");
     setEditingRule(null);
   };
 
   const getTriggerLabel = (trigger: AutomationRule["trigger"]) => {
     switch (trigger) {
       case "days_inactive":
         return "Dias sem contato";
       case "status_change":
         return "Mudança de status";
       case "high_consumption":
         return "Alto consumo (kWh)";
     }
   };
 
   const getActionLabel = (action: AutomationRule["action"]) => {
     switch (action) {
       case "move_status":
         return "Mover para status";
       case "send_notification":
         return "Enviar notificação";
       case "assign_vendedor":
         return "Atribuir vendedor";
     }
   };
 
   const getActionIcon = (action: AutomationRule["action"]) => {
     switch (action) {
       case "move_status":
         return <ArrowRight className="h-4 w-4" />;
       case "send_notification":
         return <Bell className="h-4 w-4" />;
       case "assign_vendedor":
         return <Mail className="h-4 w-4" />;
     }
   };
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center justify-between">
           <div className="flex items-center gap-2">
             <Zap className="h-5 w-5 text-primary" />
             <CardTitle className="text-base">Automações do Pipeline</CardTitle>
           </div>
           <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
             <DialogTrigger asChild>
               <Button size="sm" className="gap-1" onClick={resetForm}>
                 <Plus className="h-4 w-4" />
                 Nova Regra
               </Button>
             </DialogTrigger>
             <DialogContent>
               <DialogHeader>
                 <DialogTitle>
                   {editingRule ? "Editar Automação" : "Nova Automação"}
                 </DialogTitle>
                 <DialogDescription>
                   Configure uma regra automática para o pipeline de vendas.
                 </DialogDescription>
               </DialogHeader>
 
               <div className="space-y-4 py-4">
                 <div className="space-y-2">
                   <Label>Nome da regra</Label>
                   <Input
                     value={formName}
                     onChange={(e) => setFormName(e.target.value)}
                     placeholder="Ex: Alerta de inatividade"
                   />
                 </div>
 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Gatilho</Label>
                     <Select value={formTrigger} onValueChange={(v) => setFormTrigger(v as AutomationRule["trigger"])}>
                       <SelectTrigger>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="days_inactive">Dias sem contato</SelectItem>
                         <SelectItem value="high_consumption">Alto consumo</SelectItem>
                         <SelectItem value="status_change">Mudança de status</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>
                       {formTrigger === "days_inactive" && "Dias"}
                       {formTrigger === "high_consumption" && "kWh mínimo"}
                       {formTrigger === "status_change" && "Status"}
                     </Label>
                     {formTrigger === "status_change" ? (
                       <Select value={formTriggerValue} onValueChange={setFormTriggerValue}>
                         <SelectTrigger>
                           <SelectValue placeholder="Selecione" />
                         </SelectTrigger>
                         <SelectContent>
                           {statuses.map((s) => (
                             <SelectItem key={s.id} value={s.id}>
                               {s.nome}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     ) : (
                       <Input
                         type="number"
                         value={formTriggerValue}
                         onChange={(e) => setFormTriggerValue(e.target.value)}
                       />
                     )}
                   </div>
                 </div>
 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <Label>Ação</Label>
                     <Select value={formAction} onValueChange={(v) => setFormAction(v as AutomationRule["action"])}>
                       <SelectTrigger>
                         <SelectValue />
                       </SelectTrigger>
                       <SelectContent>
                         <SelectItem value="send_notification">Enviar notificação</SelectItem>
                         <SelectItem value="move_status">Mover para status</SelectItem>
                       </SelectContent>
                     </Select>
                   </div>
 
                   <div className="space-y-2">
                     <Label>
                       {formAction === "send_notification" && "Mensagem"}
                       {formAction === "move_status" && "Status destino"}
                     </Label>
                     {formAction === "move_status" ? (
                       <Select value={formActionValue} onValueChange={setFormActionValue}>
                         <SelectTrigger>
                           <SelectValue placeholder="Selecione" />
                         </SelectTrigger>
                         <SelectContent>
                           {statuses.map((s) => (
                             <SelectItem key={s.id} value={s.id}>
                               {s.nome}
                             </SelectItem>
                           ))}
                         </SelectContent>
                       </Select>
                     ) : (
                       <Input
                         value={formActionValue}
                         onChange={(e) => setFormActionValue(e.target.value)}
                         placeholder="Mensagem da notificação"
                       />
                     )}
                   </div>
                 </div>
               </div>
 
               <DialogFooter>
                 <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                   Cancelar
                 </Button>
                 <Button onClick={handleSaveRule} disabled={!formName || !formActionValue}>
                   Salvar
                 </Button>
               </DialogFooter>
             </DialogContent>
           </Dialog>
         </div>
         <CardDescription>
           Regras automáticas para gerenciar leads no pipeline
         </CardDescription>
       </CardHeader>
       <CardContent className="space-y-3">
         {rules.length === 0 ? (
           <div className="text-center py-6 text-muted-foreground">
             <Settings2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
             <p className="text-sm">Nenhuma automação configurada</p>
           </div>
         ) : (
           rules.map((rule) => (
             <div
               key={rule.id}
               className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
             >
               <div className="flex items-center gap-3">
                 <Switch
                   checked={rule.enabled}
                   onCheckedChange={() => handleToggleRule(rule.id)}
                 />
                 <div>
                   <p className="font-medium text-sm">{rule.name}</p>
                   <div className="flex items-center gap-2 mt-1">
                     <Badge variant="outline" className="text-[10px] gap-1">
                       <Clock className="h-3 w-3" />
                       {getTriggerLabel(rule.trigger)}: {rule.triggerValue}
                     </Badge>
                     <ArrowRight className="h-3 w-3 text-muted-foreground" />
                     <Badge variant="secondary" className="text-[10px] gap-1">
                       {getActionIcon(rule.action)}
                       {getActionLabel(rule.action)}
                     </Badge>
                   </div>
                 </div>
               </div>
               <Button
                 variant="ghost"
                 size="icon"
                 className="h-8 w-8 text-muted-foreground hover:text-destructive"
                 onClick={() => handleDeleteRule(rule.id)}
               >
                 <Trash2 className="h-4 w-4" />
               </Button>
             </div>
           ))
         )}
       </CardContent>
     </Card>
   );
 }