import { useState, useEffect, useMemo, useCallback } from "react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertTriangle, Clock, Phone, CheckCircle, Bell, MessageCircle, Users, FileText, Timer, Award, Send } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui-kit/Spinner";
import { PageHeader } from "@/components/ui-kit";
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
        supabase.from("leads").select("id, lead_code, nome, telefone, cidade, estado, consultor, ultimo_contato, proxima_acao, data_proxima_acao, created_at").is("deleted_at", null),
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
    if (days >= diasAlerta * 2) return <Badge variant="outline" className="gap-1 border-destructive/50 text-destructive bg-destructive/10"><AlertTriangle className="w-3 h-3" />{days}d</Badge>;
    if (days >= diasAlerta) return <Badge variant="outline" className="gap-1 border-warning/50 text-warning bg-warning/10"><Clock className="w-3 h-3" />{days}d</Badge>;
    return <Badge variant="outline" className="gap-1 border-success/50 text-success bg-success/10"><CheckCircle className="w-3 h-3" />Em dia</Badge>;
  };

  const renderItemsTable = (items: FollowUpItem[], variant: 'urgent' | 'pending') => {
    if (items.length === 0) return null;
    const isUrgent = variant === 'urgent';
    const Icon = isUrgent ? Bell : Clock;
    const iconClass = isUrgent ? "text-destructive" : "text-warning";
    const title = isUrgent ? "Urgentes" : "Pendentes";
    const description = isUrgent ? `Há mais de ${diasAlerta * 2} dias sem contato.` : `Entre ${diasAlerta} e ${diasAlerta * 2} dias sem contato.`;

    return (
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
              <Icon className={cn("w-4 h-4", iconClass)} />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-foreground">{title}</CardTitle>
              <CardDescription className="text-xs">{description}</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">{items.length}</Badge>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Código</TableHead>
                  <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                  <TableHead className="font-semibold text-foreground">Telefone</TableHead>
                  <TableHead className="font-semibold text-foreground">Vendedor</TableHead>
                  <TableHead className="font-semibold text-foreground">Status</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell><Badge variant="outline" className="font-mono text-xs">{item.code || "-"}</Badge></TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium text-foreground">{item.nome}</p>
                        <p className="text-xs text-muted-foreground">{item.cidade}, {item.estado}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <a href={`tel:${item.telefone}`} className="flex items-center gap-1 text-primary hover:underline text-sm">
                        <Phone className="w-3 h-3" />{item.telefone}
                      </a>
                    </TableCell>
                    <TableCell className="text-sm text-foreground">{item.consultor || "-"}</TableCell>
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
    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
      <Card className="border-l-[3px] border-l-destructive bg-card shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{categories.urgentLeads.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Urgentes ({diasAlerta * 2}+ dias)</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-[3px] border-l-warning bg-card shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="w-10 h-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-warning" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{categories.pendingLeads.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Pendentes ({diasAlerta}+ dias)</p>
          </div>
        </CardContent>
      </Card>
      <Card className="border-l-[3px] border-l-success bg-card shadow-sm hover:shadow-md transition-shadow">
        <CardContent className="flex items-center gap-4 p-5">
          <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
            <CheckCircle className="w-5 h-5 text-success" />
          </div>
          <div>
            <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{categories.upToDateLeads.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Em dia</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Header — seção 26 */}
      <PageHeader icon={Bell} title="Acompanhamentos" description="Acompanhe leads e orçamentos que precisam de atenção" />

      {/* 2. Tabs — seção 29: Header → Tabs → Conteúdo */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="orcamentos" className="gap-2">
            <FileText className="w-4 h-4" />Orçamentos
            {(orcamentosCategories.urgentLeads.length + orcamentosCategories.pendingLeads.length) > 0 && (
              <Badge variant="destructive" className="ml-1">{orcamentosCategories.urgentLeads.length + orcamentosCategories.pendingLeads.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="leads" className="gap-2">
            <Users className="w-4 h-4" />Leads
            {(leadsCategories.urgentLeads.length + leadsCategories.pendingLeads.length) > 0 && (
              <Badge variant="secondary" className="ml-1">{leadsCategories.urgentLeads.length + leadsCategories.pendingLeads.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="ranking" className="gap-2">
            <Award className="w-4 h-4" />Ranking
          </TabsTrigger>
        </TabsList>

        {/* 3. Conteúdo */}
        <TabsContent value="orcamentos" className="space-y-6 mt-4">
          {renderStats(orcamentosCategories)}
          {renderItemsTable(orcamentosCategories.urgentLeads, 'urgent')}
          {renderItemsTable(orcamentosCategories.pendingLeads, 'pending')}
          {orcamentosCategories.urgentLeads.length === 0 && orcamentosCategories.pendingLeads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Todos os orçamentos estão em dia!</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="leads" className="space-y-6 mt-4">
          {renderStats(leadsCategories)}
          {renderItemsTable(leadsCategories.urgentLeads, 'urgent')}
          {renderItemsTable(leadsCategories.pendingLeads, 'pending')}
          {leadsCategories.urgentLeads.length === 0 && leadsCategories.pendingLeads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <CheckCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Todos os leads estão em dia!</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="ranking" className="mt-4">
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                  <Award className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-base font-semibold text-foreground">Ranking de Atendimento</CardTitle>
                  <CardDescription className="text-xs">Performance de atendimento e KPIs por vendedor</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {vendorStats.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Nenhum consultor com leads/orçamentos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {vendorStats.map((vendedor, index) => {
                    const total = vendedor.total || 1;
                    const urgentPercent = (vendedor.urgentes / total) * 100;
                    const pendingPercent = (vendedor.pendentes / total) * 100;
                    const okPercent = (vendedor.emDia / total) * 100;

                    return (
                      <div key={vendedor.nome} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary">#{index + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-foreground truncate">{vendedor.nome}</p>
                            <p className="text-xs text-muted-foreground">{vendedor.total} atribuídos · {vendedor.tempoMedioResposta}d média</p>
                            <div className="h-1.5 rounded-full bg-muted flex overflow-hidden mt-1.5">
                              <div className="bg-destructive h-full" style={{ width: `${urgentPercent}%` }} />
                              <div className="bg-warning h-full" style={{ width: `${pendingPercent}%` }} />
                              <div className="bg-success h-full" style={{ width: `${okPercent}%` }} />
                            </div>
                            <div className="flex gap-3 mt-1 text-[10px]">
                              <span className="text-destructive font-medium">{vendedor.urgentes} urgentes</span>
                              <span className="text-warning font-medium">{vendedor.pendentes} pendentes</span>
                              <span className="text-success font-medium">{vendedor.emDia} em dia</span>
                            </div>
                          </div>
                        </div>
                        {vendedor.urgentes > 0 && vendedor.telefone && (
                          <Button size="sm" variant="outline" onClick={() => cobrarVendedor(vendedor)} className="gap-1 shrink-0 ml-3">
                            <Send className="w-3 h-3" />Cobrar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Phone className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Registrar Contato</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Cliente: <span className="font-medium text-foreground">{selectedItem?.nome}</span>
              </p>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="space-y-2">
              <Label htmlFor="proxima_acao">Próxima Ação</Label>
              <Textarea id="proxima_acao" value={formData.proxima_acao} onChange={(e) => setFormData(p => ({ ...p, proxima_acao: e.target.value }))} placeholder="Ex: Ligar novamente, enviar proposta..." rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="data_proxima_acao">Data da Próxima Ação</Label>
              <DateInput id="data_proxima_acao" value={formData.data_proxima_acao} onChange={(v) => setFormData(p => ({ ...p, data_proxima_acao: v }))} />
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Spinner size="sm" className="mr-2" />}Confirmar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
