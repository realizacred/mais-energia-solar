import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, Phone, CheckCircle, Bell, MessageCircle, Users, FileText, Timer, Award, Send } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { LoadingState } from "@/components/ui-kit";
import { differenceInDays, parseISO } from "date-fns";

interface FollowUpItem {
  id: string;
  code: string | null;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  consultor: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_at: string;
  type: 'lead' | 'orcamento';
}

interface VendorStats {
  nome: string;
  telefone: string | null;
  total: number;
  urgentes: number;
  pendentes: number;
  emDia: number;
  tempoMedioResposta: number;
}

interface FollowUpManagerProps {
  diasAlerta?: number;
}

export default function FollowUpManager({ diasAlerta = 3 }: FollowUpManagerProps) {
  const [leads, setLeads] = useState<FollowUpItem[]>([]);
  const [orcamentos, setOrcamentos] = useState<FollowUpItem[]>([]);
  const [vendedores, setVendedores] = useState<{ nome: string; telefone: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FollowUpItem | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({ proxima_acao: "", data_proxima_acao: "" });
  const [activeTab, setActiveTab] = useState("orcamentos");
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [leadsRes, orcamentosRes, vendedoresRes] = await Promise.all([
        supabase.from("leads").select("id, lead_code, nome, telefone, cidade, estado, consultor, ultimo_contato, proxima_acao, data_proxima_acao, created_at"),
        supabase.from("orcamentos").select("id, orc_code, cidade, estado, consultor, ultimo_contato, proxima_acao, data_proxima_acao, created_at, lead:leads!inner(nome, telefone)"),
        supabase.from("consultores").select("nome, telefone").eq("ativo", true)
      ]);

      setLeads((leadsRes.data || []).map(l => ({ ...l, code: l.lead_code, type: 'lead' as const })));
      setOrcamentos((orcamentosRes.data || []).map(o => ({
        id: o.id,
        code: o.orc_code,
        nome: (o.lead as any)?.nome || "Sem nome",
        telefone: (o.lead as any)?.telefone || "",
        cidade: o.cidade,
        estado: o.estado,
        consultor: o.consultor,
        ultimo_contato: o.ultimo_contato,
        proxima_acao: o.proxima_acao,
        data_proxima_acao: o.data_proxima_acao,
        created_at: o.created_at,
        type: 'orcamento' as const
      })));
      setVendedores(vendedoresRes.data || []);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  const categorizeItems = useCallback((items: FollowUpItem[]) => {
    const now = new Date();
    const urgent: FollowUpItem[] = [];
    const pending: FollowUpItem[] = [];
    const upToDate: FollowUpItem[] = [];

    items.forEach((item) => {
      const lastContact = item.ultimo_contato ? parseISO(item.ultimo_contato) : parseISO(item.created_at);
      const daysSinceContact = differenceInDays(now, lastContact);
      if (daysSinceContact >= diasAlerta * 2) urgent.push(item);
      else if (daysSinceContact >= diasAlerta) pending.push(item);
      else upToDate.push(item);
    });

    return { urgentLeads: urgent, pendingLeads: pending, upToDateLeads: upToDate };
  }, [diasAlerta]);

  const leadsCategories = useMemo(() => categorizeItems(leads), [leads, categorizeItems]);
  const orcamentosCategories = useMemo(() => categorizeItems(orcamentos), [orcamentos, categorizeItems]);

  const vendorStats = useMemo((): VendorStats[] => {
    const allItems = [...leads, ...orcamentos];
    const now = new Date();
    const statsMap = new Map<string, VendorStats>();
    const temposByVendedor = new Map<string, number[]>();

    vendedores.forEach(v => {
      statsMap.set(v.nome, { nome: v.nome, telefone: v.telefone, total: 0, urgentes: 0, pendentes: 0, emDia: 0, tempoMedioResposta: 0 });
    });

    allItems.forEach(item => {
      const vendedor = item.consultor || "Sem consultor";
      if (!statsMap.has(vendedor)) {
        statsMap.set(vendedor, { nome: vendedor, telefone: null, total: 0, urgentes: 0, pendentes: 0, emDia: 0, tempoMedioResposta: 0 });
      }
      const stats = statsMap.get(vendedor)!;
      stats.total++;

      const lastContact = item.ultimo_contato ? parseISO(item.ultimo_contato) : parseISO(item.created_at);
      const daysSinceContact = differenceInDays(now, lastContact);
      if (daysSinceContact >= diasAlerta * 2) stats.urgentes++;
      else if (daysSinceContact >= diasAlerta) stats.pendentes++;
      else stats.emDia++;

      if (item.ultimo_contato) {
        const responseTime = differenceInDays(parseISO(item.ultimo_contato), parseISO(item.created_at));
        if (!temposByVendedor.has(vendedor)) temposByVendedor.set(vendedor, []);
        temposByVendedor.get(vendedor)!.push(responseTime);
      }
    });

    temposByVendedor.forEach((tempos, vendedor) => {
      const stats = statsMap.get(vendedor);
      if (stats && tempos.length > 0) {
        stats.tempoMedioResposta = Math.round(tempos.reduce((a, b) => a + b, 0) / tempos.length);
      }
    });

    return Array.from(statsMap.values()).filter(v => v.total > 0).sort((a, b) => b.urgentes - a.urgentes || b.pendentes - a.pendentes);
  }, [leads, orcamentos, vendedores, diasAlerta]);

  const handleOpenDialog = (item: FollowUpItem) => {
    setSelectedItem(item);
    setFormData({ proxima_acao: item.proxima_acao || "", data_proxima_acao: item.data_proxima_acao || "" });
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    if (!selectedItem) return;
    setSaving(true);
    try {
      const table = selectedItem.type === 'lead' ? 'leads' : 'orcamentos';
      const { error } = await supabase.from(table).update({
        ultimo_contato: new Date().toISOString(),
        proxima_acao: formData.proxima_acao || null,
        data_proxima_acao: formData.data_proxima_acao || null,
      }).eq("id", selectedItem.id);
      if (error) throw error;
      toast({ title: "Contato registrado!", description: "Registro atualizado." });
      setIsDialogOpen(false);
      fetchData();
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const openWhatsApp = (telefone: string, nome: string) => {
    const message = encodeURIComponent(`Olá ${nome}! Sou da equipe de energia solar e gostaria de dar continuidade ao seu interesse. Podemos conversar?`);
    const phone = telefone.replace(/\D/g, "");
    const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
  };

  const cobrarVendedor = (vendedor: VendorStats) => {
    if (!vendedor.telefone) {
      toast({ title: "Telefone não cadastrado", variant: "destructive" });
      return;
    }
    const message = encodeURIComponent(`Olá ${vendedor.nome}! Você tem ${vendedor.urgentes} leads/orçamentos urgentes aguardando contato. Por favor, priorize o atendimento. 📞`);
    const phone = vendedor.telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${phone}?text=${message}`, "_blank");
  };

  const getStatusBadge = (item: FollowUpItem) => {
    const lastContact = item.ultimo_contato ? parseISO(item.ultimo_contato) : parseISO(item.created_at);
    const days = differenceInDays(new Date(), lastContact);
    if (days >= diasAlerta * 2) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="w-3 h-3" />{days}d</Badge>;
    if (days >= diasAlerta) return <Badge variant="outline" className="gap-1 border-warning/50 text-warning bg-warning/10"><Clock className="w-3 h-3" />{days}d</Badge>;
    return <Badge variant="outline" className="gap-1 border-success/50 text-success bg-success/10"><CheckCircle className="w-3 h-3" />Em dia</Badge>;
  };

  const renderItemsTable = (items: FollowUpItem[], variant: 'urgent' | 'pending') => {
    if (items.length === 0) return null;
    const isUrgent = variant === 'urgent';
    const bgClass = isUrgent ? "bg-destructive/5" : "bg-warning/5";
    const borderClass = isUrgent ? "border-destructive/50" : "border-warning/50";
    const Icon = isUrgent ? Bell : Clock;
    const iconClass = isUrgent ? "text-destructive" : "text-warning";
    const titleClass = isUrgent ? "text-destructive" : "text-warning";
    const title = isUrgent ? "Urgentes" : "Pendentes";
    const description = isUrgent ? `Há mais de ${diasAlerta * 2} dias sem contato.` : `Entre ${diasAlerta} e ${diasAlerta * 2} dias sem contato.`;

    return (
      <Card className={borderClass}>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${iconClass}`} />
            <CardTitle className={titleClass}>{title}</CardTitle>
            <Badge variant="secondary" className="ml-auto">{items.length}</Badge>
          </div>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Código</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className={bgClass}>
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{item.code || "-"}</Badge></TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">{item.cidade}, {item.estado}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a href={`tel:${item.telefone}`} className="flex items-center gap-1 text-primary hover:underline">
                        <Phone className="w-3 h-3" />{item.telefone}
                      </a>
                    </TableCell>
                    <TableCell>{item.consultor || "-"}</TableCell>
                    <TableCell>{getStatusBadge(item)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => openWhatsApp(item.telefone, item.nome)} className="gap-1">
                          <MessageCircle className="w-3 h-3" />WhatsApp
                        </Button>
                        <Button size="sm" onClick={() => handleOpenDialog(item)}>Registrar</Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderStats = (categories: ReturnType<typeof categorizeItems>) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="rounded-xl border-2 border-destructive/40 bg-destructive/5">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold">{categories.urgentLeads.length}</p>
            <p className="text-xs text-muted-foreground">Urgentes ({diasAlerta * 2}+ dias)</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl border-2 border-warning/40 bg-warning/5">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold">{categories.pendingLeads.length}</p>
            <p className="text-xs text-muted-foreground">Pendentes ({diasAlerta}+ dias)</p>
          </div>
        </CardContent>
      </Card>
      <Card className="rounded-xl border border-border bg-card">
        <CardContent className="flex items-center gap-4 p-4">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold">{categories.upToDateLeads.length}</p>
            <p className="text-xs text-muted-foreground">Em dia</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <Card>
        <CardContent>
          <LoadingState className="py-8" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ranking de Vendedores */}
      <Card className="rounded-xl border-2 border-border/60">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-warning" />
            <CardTitle>Ranking de Atendimento por Vendedor</CardTitle>
          </div>
          <CardDescription>Performance de atendimento e KPIs</CardDescription>
        </CardHeader>
        <CardContent>
          {vendorStats.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Nenhum consultor com leads/orçamentos.</p>
          ) : (
            <div className="space-y-4">
              {vendorStats.map((vendedor, index) => {
                const total = vendedor.total || 1;
                const urgentPercent = (vendedor.urgentes / total) * 100;
                const pendingPercent = (vendedor.pendentes / total) * 100;
                const okPercent = (vendedor.emDia / total) * 100;

                return (
                  <div key={vendedor.nome} className="p-4 rounded-xl border border-border/60 bg-card" style={{ boxShadow: "var(--shadow-xs)" }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground">#{index + 1}</span>
                        <div>
                          <p className="font-semibold">{vendedor.nome}</p>
                          <p className="text-xs text-muted-foreground">{vendedor.total} atribuídos</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <div className="flex items-center gap-1">
                          <Timer className="w-4 h-4 text-muted-foreground" />
                          <span>{vendedor.tempoMedioResposta}d média</span>
                        </div>
                        {vendedor.urgentes > 0 && vendedor.telefone && (
                          <Button size="sm" variant="destructive" onClick={() => cobrarVendedor(vendedor)} className="gap-1">
                            <Send className="w-3 h-3" />Cobrar
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-muted flex overflow-hidden">
                      <div className="bg-destructive h-full" style={{ width: `${urgentPercent}%` }} />
                      <div className="bg-warning h-full" style={{ width: `${pendingPercent}%` }} />
                      <div className="bg-success h-full" style={{ width: `${okPercent}%` }} />
                    </div>
                    <div className="flex justify-between mt-2 text-xs">
                      <span className="text-destructive">{vendedor.urgentes} urgentes</span>
                      <span className="text-warning">{vendedor.pendentes} pendentes</span>
                      <span className="text-success">{vendedor.emDia} em dia</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs: Orçamentos / Leads */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="orcamentos" className="gap-2">
            <FileText className="w-4 h-4 text-primary" />Orçamentos
            {(orcamentosCategories.urgentLeads.length + orcamentosCategories.pendingLeads.length) > 0 && (
              <Badge variant="destructive" className="ml-1">{orcamentosCategories.urgentLeads.length + orcamentosCategories.pendingLeads.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="w-4 h-4 text-secondary" />Leads
            {(leadsCategories.urgentLeads.length + leadsCategories.pendingLeads.length) > 0 && (
              <Badge variant="secondary" className="ml-1">{leadsCategories.urgentLeads.length + leadsCategories.pendingLeads.length}</Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orcamentos" className="space-y-6 mt-6">
          {renderStats(orcamentosCategories)}
          {renderItemsTable(orcamentosCategories.urgentLeads, 'urgent')}
          {renderItemsTable(orcamentosCategories.pendingLeads, 'pending')}
          {orcamentosCategories.urgentLeads.length === 0 && orcamentosCategories.pendingLeads.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="w-12 h-12 text-success mb-3" />
                <p className="text-lg font-medium">Todos os orçamentos estão em dia!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="leads" className="space-y-6 mt-6">
          {renderStats(leadsCategories)}
          {renderItemsTable(leadsCategories.urgentLeads, 'urgent')}
          {renderItemsTable(leadsCategories.pendingLeads, 'pending')}
          {leadsCategories.urgentLeads.length === 0 && leadsCategories.pendingLeads.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 text-center">
                <CheckCircle className="w-12 h-12 text-success mb-3" />
                <p className="text-lg font-medium">Todos os leads estão em dia!</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Contato - {selectedItem?.nome}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="proxima_acao">Próxima Ação</Label>
              <Textarea id="proxima_acao" value={formData.proxima_acao} onChange={(e) => setFormData(p => ({ ...p, proxima_acao: e.target.value }))} placeholder="Ex: Ligar novamente, enviar proposta..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_proxima_acao">Data da Próxima Ação</Label>
              <Input id="data_proxima_acao" type="date" value={formData.data_proxima_acao} onChange={(e) => setFormData(p => ({ ...p, data_proxima_acao: e.target.value }))} />
            </div>
            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving && <Spinner size="sm" className="mr-2" />}Confirmar Contato
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}