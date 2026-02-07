import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { parseISO } from "date-fns";
import {
  Plus,
  Loader2,
  RefreshCw,
  Wrench,
  Table2,
  CalendarDays,
} from "lucide-react";
import { ServicoDetailDialog } from "./ServicoDetailDialog";
import { ServicoValidacaoDialog } from "./ServicoValidacaoDialog";
import { SolarLayoutEditor } from "@/components/solar-editor";
import {
  Servico,
  Cliente,
  Instalador,
  ServicoFilters as FiltersType,
  tipoOptions,
  defaultFilters,
} from "./servicos/types";
import {
  ServicoStatsCards,
  ServicoFilters,
  ServicosTable,
  ServicosCalendar,
  ReagendarDialog,
  ExportActions,
  ServicoAlerts,
} from "./servicos";

type ViewMode = "table" | "calendar";

export function ServicosManager() {
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [instaladores, setInstaladores] = useState<Instalador[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedServicoId, setSelectedServicoId] = useState<string | null>(null);
  const [validacaoServico, setValidacaoServico] = useState<Servico | null>(null);
  const [layoutEditorOpen, setLayoutEditorOpen] = useState(false);
  const [selectedServiceForLayout, setSelectedServiceForLayout] = useState<Servico | null>(null);
  const [reagendarServico, setReagendarServico] = useState<Servico | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [filters, setFilters] = useState<FiltersType>(defaultFilters);
  const [activeTab, setActiveTab] = useState("todos");

  const [formData, setFormData] = useState({
    cliente_id: "",
    instalador_id: "",
    tipo: "instalacao",
    data_agendada: "",
    hora_inicio: "",
    endereco: "",
    bairro: "",
    cidade: "",
    descricao: "",
    observacoes: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [servicosRes, clientesRes, instaladoresRes] = await Promise.all([
        supabase
          .from("servicos_agendados")
          .select(`
            id,
            tipo,
            status,
            data_agendada,
            hora_inicio,
            endereco,
            bairro,
            cidade,
            descricao,
            instalador_id,
            cliente:clientes(id, nome, telefone),
            fotos_urls,
            audio_url,
            video_url,
            layout_modulos,
            validado
          `)
          .order("data_agendada", { ascending: false }),
        supabase
          .from("clientes")
          .select("id, nome, telefone, bairro, cidade")
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("profiles")
          .select("user_id, nome")
          .eq("ativo", true),
      ]);

      if (servicosRes.error) throw servicosRes.error;
      if (clientesRes.error) throw clientesRes.error;
      if (instaladoresRes.error) throw instaladoresRes.error;

      // Filter instaladores - only those with instalador role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "instalador");

      const instaladorIds = roleData?.map(r => r.user_id) || [];
      const filteredInstaladores = instaladoresRes.data
        ?.filter(p => instaladorIds.includes(p.user_id))
        .map(p => ({ id: p.user_id, nome: p.nome })) || [];

      setServicos(servicosRes.data || []);
      setClientes(clientesRes.data || []);
      setInstaladores(filteredInstaladores);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast({
        title: "Erro ao carregar dados",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleClienteChange = (clienteId: string) => {
    const cliente = clientes.find(c => c.id === clienteId);
    setFormData(prev => ({
      ...prev,
      cliente_id: clienteId,
      endereco: cliente?.endereco || prev.endereco,
      bairro: cliente?.bairro || prev.bairro,
      cidade: cliente?.cidade || prev.cidade,
    }));
  };

  const handleSubmit = async () => {
    if (!formData.instalador_id || !formData.data_agendada) {
      toast({
        title: "Campos obrigatórios",
        description: "Selecione instalador e data",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("servicos_agendados").insert([{
        instalador_id: formData.instalador_id,
        tipo: formData.tipo as "instalacao" | "manutencao" | "visita_tecnica" | "suporte",
        data_agendada: formData.data_agendada,
        cliente_id: formData.cliente_id || null,
        hora_inicio: formData.hora_inicio || null,
        endereco: formData.endereco || null,
        bairro: formData.bairro || null,
        cidade: formData.cidade || null,
        descricao: formData.descricao || null,
        observacoes: formData.observacoes || null,
      }]);

      if (error) throw error;

      toast({ title: "Serviço agendado com sucesso!" });
      setDialogOpen(false);
      setFormData({
        cliente_id: "",
        instalador_id: "",
        tipo: "instalacao",
        data_agendada: "",
        hora_inicio: "",
        endereco: "",
        bairro: "",
        cidade: "",
        descricao: "",
        observacoes: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error saving:", error);
      toast({
        title: "Erro ao agendar serviço",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const getInstaladorNome = (id: string) => {
    return instaladores.find(i => i.id === id)?.nome || "—";
  };

  // Filtering logic
  const filteredServicos = useMemo(() => {
    let result = servicos;

    // Filter by tab
    if (activeTab !== "todos") {
      result = result.filter(s => s.status === activeTab);
    }

    // Filter by status dropdown
    if (filters.status !== "todos") {
      result = result.filter(s => s.status === filters.status);
    }

    // Filter by tipo
    if (filters.tipo !== "todos") {
      result = result.filter(s => s.tipo === filters.tipo);
    }

    // Filter by instalador
    if (filters.instaladorId !== "todos") {
      result = result.filter(s => s.instalador_id === filters.instaladorId);
    }

    // Filter by date range
    if (filters.dataInicio) {
      result = result.filter(s => parseISO(s.data_agendada) >= filters.dataInicio!);
    }
    if (filters.dataFim) {
      result = result.filter(s => parseISO(s.data_agendada) <= filters.dataFim!);
    }

    // Filter by search text
    if (filters.busca) {
      const searchLower = filters.busca.toLowerCase();
      result = result.filter(s =>
        s.cliente?.nome?.toLowerCase().includes(searchLower) ||
        s.bairro?.toLowerCase().includes(searchLower) ||
        s.cidade?.toLowerCase().includes(searchLower) ||
        s.endereco?.toLowerCase().includes(searchLower)
      );
    }

    return result;
  }, [servicos, filters, activeTab]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            Serviços Agendados
          </h2>
          <p className="text-sm text-muted-foreground">
            Gerencie instalações, manutenções e visitas técnicas
          </p>
        </div>

        <div className="flex gap-2">
          <ExportActions servicos={filteredServicos} instaladores={instaladores} />
          
          <Button variant="outline" size="icon" onClick={fetchData}>
            <RefreshCw className="h-4 w-4" />
          </Button>

          <div className="flex border rounded-md">
            <Button
              variant={viewMode === "table" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("table")}
            >
              <Table2 className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("calendar")}
            >
              <CalendarDays className="h-4 w-4" />
            </Button>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Agendar Serviço
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Agendar Novo Serviço</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Tipo de Serviço *</Label>
                    <Select
                      value={formData.tipo}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, tipo: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tipoOptions.map(opt => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <Input
                      type="date"
                      value={formData.data_agendada}
                      onChange={(e) => setFormData(prev => ({ ...prev, data_agendada: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Instalador *</Label>
                    <Select
                      value={formData.instalador_id}
                      onValueChange={(v) => setFormData(prev => ({ ...prev, instalador_id: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {instaladores.map(inst => (
                          <SelectItem key={inst.id} value={inst.id}>
                            {inst.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Horário</Label>
                    <Input
                      type="time"
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData(prev => ({ ...prev, hora_inicio: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Cliente</Label>
                  <Select
                    value={formData.cliente_id}
                    onValueChange={handleClienteChange}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Vincular a cliente (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map(cliente => (
                        <SelectItem key={cliente.id} value={cliente.id}>
                          {cliente.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Endereço</Label>
                  <Input
                    value={formData.endereco}
                    onChange={(e) => setFormData(prev => ({ ...prev, endereco: e.target.value }))}
                    placeholder="Rua, número..."
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Bairro</Label>
                    <Input
                      value={formData.bairro}
                      onChange={(e) => setFormData(prev => ({ ...prev, bairro: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input
                      value={formData.cidade}
                      onChange={(e) => setFormData(prev => ({ ...prev, cidade: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Descrição do Serviço</Label>
                  <Textarea
                    value={formData.descricao}
                    onChange={(e) => setFormData(prev => ({ ...prev, descricao: e.target.value }))}
                    placeholder="Detalhes do serviço a ser executado..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Observações Internas</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    placeholder="Notas para o instalador..."
                    rows={2}
                  />
                </div>

                <Button onClick={handleSubmit} disabled={saving} className="w-full">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Agendar Serviço
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Alerts */}
      <ServicoAlerts servicos={servicos} />

      {/* Stats Cards */}
      <ServicoStatsCards servicos={servicos} />

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <ServicoFilters
            filters={filters}
            onFiltersChange={setFilters}
            instaladores={instaladores}
          />
        </CardContent>
      </Card>

      {/* Content */}
      {viewMode === "calendar" ? (
        <ServicosCalendar
          servicos={filteredServicos}
          instaladores={instaladores}
          onSelectServico={(s) => setSelectedServicoId(s.id)}
        />
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="todos">
                  Todos ({servicos.length})
                </TabsTrigger>
                <TabsTrigger value="agendado">
                  Agendados ({servicos.filter(s => s.status === "agendado").length})
                </TabsTrigger>
                <TabsTrigger value="em_andamento">
                  Em Andamento ({servicos.filter(s => s.status === "em_andamento").length})
                </TabsTrigger>
                <TabsTrigger value="concluido">
                  Concluídos ({servicos.filter(s => s.status === "concluido").length})
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </CardHeader>
          <CardContent className="p-0">
            <ServicosTable
              servicos={filteredServicos}
              instaladores={instaladores}
              onViewDetails={setSelectedServicoId}
              onOpenLayoutEditor={(s) => {
                setSelectedServiceForLayout(s);
                setLayoutEditorOpen(true);
              }}
              onValidar={setValidacaoServico}
              onReagendar={setReagendarServico}
            />
          </CardContent>
        </Card>
      )}

      {/* Dialogs */}
      <ServicoDetailDialog
        servicoId={selectedServicoId}
        isOpen={!!selectedServicoId}
        onClose={() => setSelectedServicoId(null)}
      />

      {selectedServiceForLayout && (
        <SolarLayoutEditor
          isOpen={layoutEditorOpen}
          onClose={() => {
            setLayoutEditorOpen(false);
            setSelectedServiceForLayout(null);
          }}
          servicoId={selectedServiceForLayout.id}
          clienteId={selectedServiceForLayout.cliente?.id}
          layoutName={`Layout - ${selectedServiceForLayout.cliente?.nome || 'Serviço'}`}
          onSave={() => fetchData()}
        />
      )}

      <ServicoValidacaoDialog
        servico={validacaoServico ? {
          id: validacaoServico.id,
          tipo: validacaoServico.tipo,
          status: validacaoServico.status,
          data_agendada: validacaoServico.data_agendada,
          endereco: validacaoServico.endereco,
          bairro: validacaoServico.bairro,
          cidade: validacaoServico.cidade,
          cliente: validacaoServico.cliente,
          fotos_urls: validacaoServico.fotos_urls || [],
          audio_url: validacaoServico.audio_url,
          video_url: validacaoServico.video_url,
          layout_modulos: validacaoServico.layout_modulos as { totalModules: number; backgroundImage?: string } | null,
          observacoes_conclusao: null,
          validado: validacaoServico.validado || false,
          validado_em: null,
          observacoes_validacao: null,
          instalador_nome: getInstaladorNome(validacaoServico.instalador_id),
        } : null}
        isOpen={!!validacaoServico}
        onClose={() => setValidacaoServico(null)}
        onValidated={() => fetchData()}
      />

      <ReagendarDialog
        servico={reagendarServico}
        isOpen={!!reagendarServico}
        onClose={() => setReagendarServico(null)}
        onSuccess={() => fetchData()}
      />
    </div>
  );
}
