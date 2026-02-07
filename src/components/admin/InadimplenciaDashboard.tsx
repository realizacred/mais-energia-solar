import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  TrendingDown,
  Phone,
  MessageCircle,
  Search,
  RefreshCw,
  Loader2,
  Calendar,
  Users,
  FileText
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface Parcela {
  id: string;
  recebimento_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  created_at: string;
}

interface ParcelaComCliente extends Parcela {
  cliente_nome: string;
  cliente_telefone: string;
  cliente_id: string;
  dias_atraso: number;
  valor_total_recebimento: number;
}

interface InadimplenciaStats {
  totalAtrasadas: number;
  valorTotalAtrasado: number;
  clientesInadimplentes: number;
  mediaAtraso: number;
}

export function InadimplenciaDashboard() {
  const [parcelas, setParcelas] = useState<ParcelaComCliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchParcelasAtrasadas();
  }, []);

  const fetchParcelasAtrasadas = async () => {
    setLoading(true);
    try {
      // Atualizar status de parcelas atrasadas
      await supabase.rpc("update_parcelas_atrasadas");

      // Buscar parcelas atrasadas com informações do cliente
      const { data: parcelasData, error } = await supabase
        .from("parcelas")
        .select(`
          *,
          recebimentos!inner (
            id,
            valor_total,
            clientes!inner (
              id,
              nome,
              telefone
            )
          )
        `)
        .eq("status", "atrasada")
        .order("data_vencimento", { ascending: true });

      if (error) throw error;

      const parcelasFormatadas: ParcelaComCliente[] = (parcelasData || []).map((p: any) => ({
        ...p,
        cliente_nome: p.recebimentos?.clientes?.nome || "N/A",
        cliente_telefone: p.recebimentos?.clientes?.telefone || "",
        cliente_id: p.recebimentos?.clientes?.id || "",
        valor_total_recebimento: p.recebimentos?.valor_total || 0,
        dias_atraso: differenceInDays(new Date(), new Date(p.data_vencimento)),
      }));

      setParcelas(parcelasFormatadas);
    } catch (error) {
      console.error("Error fetching parcelas:", error);
      toast({
        title: "Erro ao carregar",
        description: "Não foi possível carregar as parcelas atrasadas.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchParcelasAtrasadas();
    setRefreshing(false);
    toast({ title: "Dados atualizados!" });
  };

  const handleWhatsApp = (telefone: string, nome: string, valor: number) => {
    const phone = telefone.replace(/\D/g, "");
    const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const message = encodeURIComponent(
      `Olá ${nome.split(" ")[0]}! Identificamos uma pendência de ${formatCurrency(valor)} em seu cadastro. Entre em contato conosco para regularizar.`
    );
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
  };

  const handleCall = (telefone: string) => {
    window.location.href = `tel:+55${telefone.replace(/\D/g, "")}`;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  // Filter parcelas
  const parcelasFiltradas = useMemo(() => {
    if (!searchTerm) return parcelas;
    const term = searchTerm.toLowerCase();
    return parcelas.filter(
      (p) =>
        p.cliente_nome.toLowerCase().includes(term) ||
        p.cliente_telefone.includes(term)
    );
  }, [parcelas, searchTerm]);

  // Calculate stats
  const stats: InadimplenciaStats = useMemo(() => {
    const clientesUnicos = new Set(parcelas.map((p) => p.cliente_id));
    const totalAtraso = parcelas.reduce((acc, p) => acc + p.dias_atraso, 0);

    return {
      totalAtrasadas: parcelas.length,
      valorTotalAtrasado: parcelas.reduce((acc, p) => acc + p.valor, 0),
      clientesInadimplentes: clientesUnicos.size,
      mediaAtraso: parcelas.length > 0 ? Math.round(totalAtraso / parcelas.length) : 0,
    };
  }, [parcelas]);

  // Group by urgency
  const parcelasPorUrgencia = useMemo(() => {
    return {
      criticas: parcelasFiltradas.filter((p) => p.dias_atraso > 30),
      urgentes: parcelasFiltradas.filter((p) => p.dias_atraso > 15 && p.dias_atraso <= 30),
      recentes: parcelasFiltradas.filter((p) => p.dias_atraso <= 15),
    };
  }, [parcelasFiltradas]);

  const getUrgencyBadge = (diasAtraso: number) => {
    if (diasAtraso > 30) {
      return <Badge variant="destructive">Crítico ({diasAtraso}d)</Badge>;
    }
    if (diasAtraso > 15) {
      return <Badge className="bg-secondary text-secondary-foreground">Urgente ({diasAtraso}d)</Badge>;
    }
    return <Badge variant="outline">{diasAtraso} dias</Badge>;
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestão de Inadimplência</h2>
          <p className="text-muted-foreground">
            Acompanhe e gerencie parcelas em atraso
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
          {refreshing ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-2" />
          )}
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Parcelas Atrasadas</p>
                <p className="text-3xl font-bold">{stats.totalAtrasadas}</p>
              </div>
              <AlertTriangle className="h-8 w-8 text-destructive opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Valor em Atraso</p>
                <p className="text-3xl font-bold">{formatCurrency(stats.valorTotalAtrasado)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-destructive opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Clientes Inadimplentes</p>
                <p className="text-3xl font-bold">{stats.clientesInadimplentes}</p>
              </div>
              <Users className="h-8 w-8 text-secondary opacity-80" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Média de Atraso</p>
                <p className="text-3xl font-bold">{stats.mediaAtraso} dias</p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground opacity-80" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Urgency Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5" />
            Distribuição por Urgência
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-destructive font-medium">Crítico (+30 dias)</span>
                <span>{parcelasPorUrgencia.criticas.length} parcelas</span>
              </div>
              <Progress 
                value={(parcelasPorUrgencia.criticas.length / Math.max(parcelas.length, 1)) * 100} 
                className="h-2 bg-destructive/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-secondary font-medium">Urgente (15-30 dias)</span>
                <span>{parcelasPorUrgencia.urgentes.length} parcelas</span>
              </div>
              <Progress 
                value={(parcelasPorUrgencia.urgentes.length / Math.max(parcelas.length, 1)) * 100} 
                className="h-2 bg-secondary/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground font-medium">Recente (até 15 dias)</span>
                <span>{parcelasPorUrgencia.recentes.length} parcelas</span>
              </div>
              <Progress 
                value={(parcelasPorUrgencia.recentes.length / Math.max(parcelas.length, 1)) * 100} 
                className="h-2"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Parcelas Table */}
      <Card>
        <CardHeader>
          <CardTitle>Parcelas em Atraso</CardTitle>
          <CardDescription>
            Lista completa de parcelas pendentes ordenada por urgência
          </CardDescription>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {parcelasFiltradas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <FileText className="h-12 w-12 opacity-20 mb-2" />
              <p className="text-sm font-medium">
                {parcelas.length === 0 ? "Nenhuma parcela em atraso!" : "Nenhum resultado encontrado"}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Atraso</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelasFiltradas.map((parcela) => (
                    <TableRow key={parcela.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{parcela.cliente_nome}</p>
                          <p className="text-sm text-muted-foreground">{parcela.cliente_telefone}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">#{parcela.numero_parcela}</Badge>
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(parcela.valor)}
                      </TableCell>
                      <TableCell>
                        {format(new Date(parcela.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{getUrgencyBadge(parcela.dias_atraso)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCall(parcela.cliente_telefone)}
                          >
                            <Phone className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => handleWhatsApp(
                              parcela.cliente_telefone,
                              parcela.cliente_nome,
                              parcela.valor
                            )}
                          >
                            <MessageCircle className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
