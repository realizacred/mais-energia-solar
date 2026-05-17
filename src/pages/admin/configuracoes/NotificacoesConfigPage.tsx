import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Mail, MessageSquare, Bell, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { PageHeader } from "@/components/ui-kit";

const EVENTOS = [
  { id: 'projeto_status_mudou', label: 'Projeto avançou de etapa' },
  { id: 'credito_aprovado', label: 'Crédito aprovado' },
  { id: 'credito_reprovado', label: 'Crédito reprovado' },
  { id: 'credito_aguardando_documentos', label: 'Crédito aguardando documentos' },
  { id: 'proposta_enviada', label: 'Proposta enviada' },
  { id: 'proposta_aceita', label: 'Proposta aceita' },
  { id: 'documento_solicitado', label: 'Documento solicitado' },
  { id: 'recibo_emitido', label: 'Recibo emitido' },
  { id: 'comissao_aprovada', label: 'Comissão aprovada' },
  { id: 'comissao_paga', label: 'Comissão paga' },
];

const CANAIS = [
  { id: 'email', label: 'Email', icon: Mail },
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare },
  { id: 'inapp', label: 'Interno (InApp)', icon: Bell },
  { id: 'push', label: 'Push (App)', icon: Smartphone },
];

const DESTINATARIOS = ['cliente', 'consultor', 'gerente', 'admin'];

export default function NotificacoesConfigPage() {
  const [loading, setLoading] = useState(true);
  const [rules, setRules] = useState<any[]>([]);
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .single();
        if (profile?.tenant_id) {
          setTenantId(profile.tenant_id);
          fetchRules(profile.tenant_id);
        }
      }
    }
    init();
  }, []);

  async function fetchRules(tid: string) {
    const { data, error } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("tenant_id", tid);
    if (!error) setRules(data || []);
    setLoading(false);
  }

  async function toggleRule(evento: string, canal: string, destinatario: string, currentAtivo: boolean) {
    if (!tenantId) return;

    const existing = rules.find(r => r.evento === evento && r.canal === canal && r.destinatario === destinatario);
    
    try {
      if (existing) {
        const { error } = await supabase
          .from("notification_rules")
          .update({ ativo: !currentAtivo })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_rules")
          .insert({
            tenant_id: tenantId,
            evento,
            canal,
            destinatario,
            ativo: true
          });
        if (error) throw error;
      }
      
      toast.success("Configuração atualizada");
      fetchRules(tenantId);
    } catch (err: any) {
      toast.error("Erro ao atualizar: " + err.message);
    }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <PageHeader 
        title="Configurações de Notificações" 
        description="Gerencie quais eventos disparam notificações para clientes e equipe."
        icon={Bell}
      />

      <SectionCard title="Regras por Evento">
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[300px]">Evento</TableHead>
                {CANAIS.map(canal => (
                  <TableHead key={canal.id} className="text-center">
                    <div className="flex flex-col items-center gap-1">
                      <canal.icon className="h-4 w-4" />
                      <span>{canal.label}</span>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {EVENTOS.map(evento => (
                <TableRow key={evento.id}>
                  <TableCell className="font-medium">
                    {evento.label}
                    <div className="text-[10px] text-muted-foreground uppercase mt-1">
                      {evento.id}
                    </div>
                  </TableCell>
                  {CANAIS.map(canal => {
                    // Simplificação: por enquanto mostramos o toggle para o destinatário mais comum do evento
                    let destinatario = 'cliente';
                    if (evento.id.includes('comissao') || evento.id.includes('credito')) destinatario = 'consultor';
                    
                    const rule = rules.find(r => r.evento === evento.id && r.canal === canal.id && r.destinatario === destinatario);
                    const ativo = rule ? rule.ativo : false;

                    return (
                      <TableCell key={canal.id} className="text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Switch 
                            checked={ativo} 
                            onCheckedChange={() => toggleRule(evento.id, canal.id, destinatario, ativo)} 
                          />
                          <span className="text-[10px] text-muted-foreground capitalize">{destinatario}</span>
                        </div>
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
      
      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800 text-sm flex gap-3">
        <Bell className="h-5 w-5 shrink-0" />
        <p>
          As notificações de WhatsApp dependem de uma instância conectada em <strong>Configurações &gt; WhatsApp</strong>. 
          As de E-mail utilizam o servidor SMTP configurado em cada módulo.
        </p>
      </div>
    </div>
  );
}
