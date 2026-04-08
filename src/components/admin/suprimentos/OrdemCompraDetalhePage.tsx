import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Package, Truck, ClipboardList, History, ExternalLink, ChevronRight, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters";
import { toast } from "@/hooks/use-toast";
import { useEstoqueItens } from "@/hooks/useEstoque";
import {
  useOrdemCompraDetalhe,
  useOrdemCompraItens,
  useOrdemCompraTransporte,
  useOrdemCompraEventos,
  useAvancarStatusOrdem,
  useAdicionarItemOrdem,
  useRemoverItemOrdem,
  useReceberItensOrdem,
  useSalvarTransporte,
  OrdemCompraStatus,
  OrdemCompraItem,
} from "@/hooks/useOrdensCompra";

const STATUS_LABELS: Record<OrdemCompraStatus, string> = {
  rascunho: "Rascunho",
  enviada: "Enviada",
  confirmada: "Confirmada",
  em_transito: "Em trânsito",
  recebida_parcial: "Recebida parcial",
  recebida: "Recebida",
  cancelada: "Cancelada",
};

const STATUS_COLORS: Record<OrdemCompraStatus, string> = {
  rascunho: "bg-muted text-muted-foreground border-border",
  enviada: "bg-info/10 text-info border-info/20",
  confirmada: "bg-secondary/10 text-secondary border-secondary/20",
  em_transito: "bg-warning/10 text-warning border-warning/20",
  recebida_parcial: "bg-warning/10 text-warning border-warning/20",
  recebida: "bg-success/10 text-success border-success/20",
  cancelada: "bg-destructive/10 text-destructive border-destructive/20",
};

const NEXT_STATUS: Partial<Record<OrdemCompraStatus, { status: OrdemCompraStatus; label: string }>> = {
  rascunho: { status: "enviada", label: "Marcar como enviada" },
  enviada: { status: "confirmada", label: "Confirmar pedido" },
  confirmada: { status: "em_transito", label: "Marcar em trânsito" },
  recebida_parcial: { status: "recebida", label: "Marcar como recebida" },
};

type TabId = "geral" | "itens" | "transporte";

const TABS: { id: TabId; label: string; icon: typeof Package }[] = [
  { id: "geral", label: "Geral", icon: Package },
  { id: "itens", label: "Itens", icon: ClipboardList },
  { id: "transporte", label: "Transporte", icon: Truck },
];

export function OrdemCompraDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabId>("geral");

  const { data: ordem, isLoading } = useOrdemCompraDetalhe(id);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!ordem) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Ordem de compra não encontrada.</p>
        <Button variant="ghost" onClick={() => navigate("/admin/suprimentos")} className="mt-4">Voltar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Button variant="link" onClick={() => navigate("/admin/suprimentos")} className="hover:text-foreground h-auto p-0 text-xs text-muted-foreground">
          Suprimentos
        </Button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{ordem.numero_pedido || "Sem número"}</span>
      </div>

      {/* Header */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                <Package className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">
                  Ordem {ordem.numero_pedido || "#"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {ordem.fornecedor_nome || "Sem fornecedor"} • {ordem.projeto_codigo || ordem.projeto_nome || "Sem projeto"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={`text-xs ${STATUS_COLORS[ordem.status]}`}>
                {STATUS_LABELS[ordem.status]}
              </Badge>
              <span className="text-lg font-bold font-mono text-foreground">{formatBRL(ordem.valor_total || 0)}</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex items-center border-b border-border/60 -mx-4 px-4 mt-4 overflow-x-auto scrollbar-hide">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-[1px]",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Tab Content */}
      {activeTab === "geral" && <TabGeral ordem={ordem} />}
      {activeTab === "itens" && <TabItens ordemId={ordem.id} status={ordem.status} />}
      {activeTab === "transporte" && <TabTransporte ordemId={ordem.id} />}
    </div>
  );
}

// ─── Tab Geral ──────────────────────────────────────

function TabGeral({ ordem }: { ordem: any }) {
  const avancar = useAvancarStatusOrdem();
  const { data: eventos = [], isLoading: loadingEventos } = useOrdemCompraEventos(ordem.id);

  const nextAction = NEXT_STATUS[ordem.status as OrdemCompraStatus];

  const handleAvancar = async () => {
    if (!nextAction) return;
    try {
      await avancar.mutateAsync({ id: ordem.id, novoStatus: nextAction.status });
      toast({ title: `Status atualizado para ${STATUS_LABELS[nextAction.status]}` });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const fmtDate = (d: string | null) =>
    d ? new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—";

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div><span className="text-xs text-muted-foreground">Fornecedor</span><p className="text-sm font-medium text-foreground">{ordem.fornecedor_nome || "—"}</p></div>
            <div><span className="text-xs text-muted-foreground">Projeto</span><p className="text-sm font-medium text-foreground">{ordem.projeto_codigo || ordem.projeto_nome || "—"}</p></div>
            <div><span className="text-xs text-muted-foreground">Nº Pedido</span><p className="text-sm font-medium text-foreground">{ordem.numero_pedido || "—"}</p></div>
            <div><span className="text-xs text-muted-foreground">Data do pedido</span><p className="text-sm font-medium text-foreground">{fmtDate(ordem.data_pedido)}</p></div>
            <div><span className="text-xs text-muted-foreground">Previsão de entrega</span><p className="text-sm font-medium text-foreground">{fmtDate(ordem.data_previsao_entrega)}</p></div>
            <div><span className="text-xs text-muted-foreground">Entrega real</span><p className="text-sm font-medium text-foreground">{fmtDate(ordem.data_entrega_real)}</p></div>
            {ordem.observacoes && (
              <div className="sm:col-span-2"><span className="text-xs text-muted-foreground">Observações</span><p className="text-sm text-foreground">{ordem.observacoes}</p></div>
            )}
          </div>

          {nextAction && (
            <div className="mt-4 pt-4 border-t border-border">
              <Button onClick={handleAvancar} disabled={avancar.isPending} className="gap-1.5">
                {avancar.isPending ? "Processando..." : nextAction.label}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardContent className="p-5">
          <h3 className="text-base font-semibold text-foreground mb-4 flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" /> Histórico
          </h3>
          {loadingEventos ? (
            <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-6 w-full" />)}</div>
          ) : eventos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum evento registrado.</p>
          ) : (
            <div className="space-y-3">
              {eventos.map(ev => (
                <div key={ev.id} className="flex items-start gap-3 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-foreground">{ev.descricao}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(ev.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Tab Itens ──────────────────────────────────────

function TabItens({ ordemId, status, numeroPedido }: { ordemId: string; status: OrdemCompraStatus; numeroPedido?: string | null }) {
  const { data: itens = [], isLoading } = useOrdemCompraItens(ordemId);
  const [addOpen, setAddOpen] = useState(false);
  const [recebendo, setRecebendo] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [qtdRecebidas, setQtdRecebidas] = useState<Record<string, number>>({});
  const [obsRecebimento, setObsRecebimento] = useState<Record<string, string>>({});
  const adicionarItem = useAdicionarItemOrdem();
  const removerItem = useRemoverItemOrdem();
  const receberItens = useReceberItensOrdem();
  const { data: estoqueItens = [] } = useEstoqueItens();

  // Add item form state
  const [desc, setDesc] = useState("");
  const [qtd, setQtd] = useState(1);
  const [unidade, setUnidade] = useState("un");
  const [valor, setValor] = useState(0);
  const [estoqueId, setEstoqueId] = useState("");

  const handleAddItem = async () => {
    try {
      await adicionarItem.mutateAsync({
        ordem_compra_id: ordemId,
        estoque_item_id: estoqueId || undefined,
        descricao: desc,
        quantidade: qtd,
        unidade,
        valor_unitario: valor,
      });
      toast({ title: "Item adicionado" });
      setAddOpen(false);
      setDesc(""); setQtd(1); setUnidade("un"); setValor(0); setEstoqueId("");
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const canReceive = status === "em_transito" || status === "recebida_parcial";

  const startRecebimento = () => {
    const qtds: Record<string, number> = {};
    const obs: Record<string, string> = {};
    itens.forEach(i => {
      qtds[i.id] = i.quantidade_recebida > 0 ? i.quantidade_recebida : i.quantidade;
      obs[i.id] = "";
    });
    setQtdRecebidas(qtds);
    setObsRecebimento(obs);
    setRecebendo(true);
  };

  const hasRecebimento = Object.values(qtdRecebidas).some(v => v > 0);

  // Classification for summary modal
  const getClassificacao = () => {
    const completos: typeof itens = [];
    const parciais: typeof itens = [];
    const naoRecebidos: typeof itens = [];
    itens.forEach(item => {
      const qr = qtdRecebidas[item.id] ?? 0;
      if (qr >= item.quantidade) completos.push(item);
      else if (qr > 0) parciais.push(item);
      else naoRecebidos.push(item);
    });
    return { completos, parciais, naoRecebidos };
  };

  const handleConfirmar = async () => {
    try {
      const result = await receberItens.mutateAsync({
        ordemId,
        numeroPedido,
        itens: itens.map(i => ({
          id: i.id,
          quantidade_recebida: qtdRecebidas[i.id] ?? 0,
          estoque_item_id: i.estoque_item_id,
          quantidade: i.quantidade,
          observacao_recebimento: obsRecebimento[i.id] || undefined,
        })),
      });
      toast({
        title: "Recebimento confirmado",
        description: `${result.completos} completo(s), ${result.parciais} parcial(is), ${result.naoRecebidos} não recebido(s)`,
      });
      setRecebendo(false);
      setConfirmOpen(false);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  const getItemStatus = (item: OrdemCompraItem) => {
    if (item.quantidade_recebida >= item.quantidade) return { label: "Completo", color: "bg-success/10 text-success border-success/20" };
    if (item.quantidade_recebida > 0) return { label: "Parcial", color: "bg-warning/10 text-warning border-warning/20" };
    return { label: "Pendente", color: "bg-muted text-muted-foreground border-border" };
  };

  const total = itens.reduce((s, i) => s + (i.valor_total || 0), 0);
  const classificacao = recebendo ? getClassificacao() : null;

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold text-foreground">Itens da ordem</h3>
          <div className="flex gap-2">
            {canReceive && !recebendo && (
              <Button variant="outline" size="sm" onClick={startRecebimento} className="gap-1.5 border-success/30 text-success">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Conferir recebimento
              </Button>
            )}
            {(status === "rascunho" || status === "enviada") && (
              <Button variant="outline" size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
                <ClipboardList className="h-3.5 w-3.5" /> Adicionar item
              </Button>
            )}
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : itens.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-8">Nenhum item cadastrado</p>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Descrição</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Qtd pedida</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Qtd recebida</TableHead>
                  <TableHead className="font-semibold text-foreground text-center">Status</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Total</TableHead>
                  {recebendo && <TableHead className="font-semibold text-foreground">Observação</TableHead>}
                  {(status === "rascunho" || status === "enviada") && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {itens.map(item => {
                  const itemStatus = getItemStatus(item);
                  return (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="text-foreground">
                        <div>
                          {item.descricao || "—"}
                          {!recebendo && item.observacao_recebimento && (
                            <p className="text-xs text-muted-foreground italic mt-0.5">{item.observacao_recebimento}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{item.quantidade} {item.unidade}</TableCell>
                      <TableCell className="text-center">
                        {recebendo ? (
                          <Input
                            type="number"
                            min={0}
                            max={item.quantidade}
                            className="w-20 mx-auto text-center h-8"
                            value={qtdRecebidas[item.id] ?? 0}
                            onChange={e => setQtdRecebidas(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                          />
                        ) : (
                          <span className={cn(
                            item.quantidade_recebida >= item.quantidade ? "text-success font-medium" : "text-muted-foreground"
                          )}>
                            {item.quantidade_recebida}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className={`text-[10px] ${itemStatus.color}`}>
                          {itemStatus.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-foreground">{formatBRL(item.valor_total)}</TableCell>
                      {recebendo && (
                        <TableCell>
                          <Input
                            placeholder="Avarias, divergências..."
                            className="h-8 text-xs min-w-[140px]"
                            value={obsRecebimento[item.id] ?? ""}
                            onChange={e => setObsRecebimento(prev => ({ ...prev, [item.id]: e.target.value }))}
                          />
                        </TableCell>
                      )}
                      {(status === "rascunho" || status === "enviada") && (
                        <TableCell>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-destructive"
                            onClick={() => removerItem.mutate({ id: item.id, ordem_compra_id: ordemId })}
                          >
                            <XCircle className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableCell colSpan={recebendo ? 5 : 4} className="text-right font-semibold text-foreground">Total:</TableCell>
                  <TableCell className="text-right font-mono font-bold text-foreground">{formatBRL(total)}</TableCell>
                  {recebendo && <TableCell />}
                  {(status === "rascunho" || status === "enviada") && <TableCell />}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}

        {recebendo && (
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRecebendo(false)}>Cancelar</Button>
            <Button onClick={() => setConfirmOpen(true)} disabled={!hasRecebimento}>
              Confirmar recebimento
            </Button>
          </div>
        )}

        {/* Confirmation Modal */}
        <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
          <DialogContent className="w-[90vw] max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <CheckCircle2 className="h-5 w-5 text-success" />
                Confirmar recebimento
              </DialogTitle>
            </DialogHeader>
            {classificacao && (
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">Revise o resumo antes de confirmar:</p>

                {classificacao.completos.length > 0 && (
                  <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                    <p className="text-xs font-semibold text-success flex items-center gap-1 mb-1.5">
                      <CheckCircle2 className="h-3 w-3" />
                      Completos ({classificacao.completos.length})
                    </p>
                    {classificacao.completos.map(i => (
                      <p key={i.id} className="text-xs text-foreground">
                        {i.descricao} — {qtdRecebidas[i.id]}/{i.quantidade} {i.unidade}
                      </p>
                    ))}
                  </div>
                )}

                {classificacao.parciais.length > 0 && (
                  <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                    <p className="text-xs font-semibold text-warning flex items-center gap-1 mb-1.5">
                      <AlertTriangle className="h-3 w-3" />
                      Parciais ({classificacao.parciais.length})
                    </p>
                    {classificacao.parciais.map(i => (
                      <p key={i.id} className="text-xs text-foreground">
                        {i.descricao} — {qtdRecebidas[i.id]}/{i.quantidade} {i.unidade}
                        {obsRecebimento[i.id] && <span className="text-muted-foreground italic"> ({obsRecebimento[i.id]})</span>}
                      </p>
                    ))}
                  </div>
                )}

                {classificacao.naoRecebidos.length > 0 && (
                  <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                    <p className="text-xs font-semibold text-destructive flex items-center gap-1 mb-1.5">
                      <XCircle className="h-3 w-3" />
                      Não recebidos ({classificacao.naoRecebidos.length})
                    </p>
                    {classificacao.naoRecebidos.map(i => (
                      <p key={i.id} className="text-xs text-foreground">{i.descricao} — 0/{i.quantidade} {i.unidade}</p>
                    ))}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Voltar</Button>
                  <Button onClick={handleConfirmar} disabled={receberItens.isPending} className="gap-1.5">
                    {receberItens.isPending ? "Processando..." : "Confirmar e atualizar estoque"}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Add Item Dialog */}
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogContent className="w-[90vw] max-w-md">
            <DialogHeader>
              <DialogTitle>Adicionar item</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Buscar no catálogo</Label>
                <Select value={estoqueId} onValueChange={(v) => {
                  setEstoqueId(v);
                  const item = (estoqueItens as any[]).find((i: any) => i.id === v);
                  if (item) { setDesc((item as any).nome); setUnidade((item as any).unidade || "un"); }
                }}>
                  <SelectTrigger><SelectValue placeholder="Opcional..." /></SelectTrigger>
                  <SelectContent>
                    {(estoqueItens as any[]).map((i: any) => (
                      <SelectItem key={i.id} value={i.id}>{i.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input value={desc} onChange={e => setDesc(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input type="number" min={1} value={qtd} onChange={e => setQtd(Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label>Unidade</Label>
                  <Input value={unidade} onChange={e => setUnidade(e.target.value)} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor unitário</Label>
                <CurrencyInput value={valor} onChange={setValor} />
              </div>
              <Button onClick={handleAddItem} disabled={!desc.trim() || adicionarItem.isPending} className="w-full">
                {adicionarItem.isPending ? "Adicionando..." : "Adicionar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// ─── Tab Transporte ─────────────────────────────────

function TabTransporte({ ordemId }: { ordemId: string }) {
  const { data: transporte, isLoading } = useOrdemCompraTransporte(ordemId);
  const salvar = useSalvarTransporte();

  const [transportadora, setTransportadora] = useState("");
  const [codigoRastreio, setCodigoRastreio] = useState("");
  const [urlRastreio, setUrlRastreio] = useState("");
  const [dataDespacho, setDataDespacho] = useState("");
  const [previsaoChegada, setPrevisaoChegada] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [loaded, setLoaded] = useState(false);

  // Load existing data
  if (transporte && !loaded) {
    setTransportadora(transporte.transportadora || "");
    setCodigoRastreio(transporte.codigo_rastreio || "");
    setUrlRastreio(transporte.url_rastreio || "");
    setDataDespacho(transporte.data_despacho || "");
    setPrevisaoChegada(transporte.previsao_chegada || "");
    setObservacoes(transporte.observacoes || "");
    setLoaded(true);
  }
  if (!transporte && !isLoading && !loaded) {
    setLoaded(true);
  }

  const handleSave = async () => {
    try {
      await salvar.mutateAsync({
        ordem_compra_id: ordemId,
        transportadora: transportadora || undefined,
        codigo_rastreio: codigoRastreio || undefined,
        url_rastreio: urlRastreio || undefined,
        data_despacho: dataDespacho || undefined,
        previsao_chegada: previsaoChegada || undefined,
        observacoes: observacoes || undefined,
      });
      toast({ title: "Transporte salvo" });
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  };

  if (isLoading) return <Card><CardContent className="p-5"><Skeleton className="h-48 w-full" /></CardContent></Card>;

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
          <Truck className="h-4 w-4 text-muted-foreground" /> Dados de transporte
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Transportadora</Label>
            <Input value={transportadora} onChange={e => setTransportadora(e.target.value)} placeholder="Nome da transportadora" />
          </div>
          <div className="space-y-2">
            <Label>Código de rastreio</Label>
            <Input value={codigoRastreio} onChange={e => setCodigoRastreio(e.target.value)} placeholder="Código" />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>URL de rastreio</Label>
            <div className="flex gap-2">
              <Input value={urlRastreio} onChange={e => setUrlRastreio(e.target.value)} placeholder="https://..." className="flex-1" />
              {urlRastreio && (
                <Button variant="outline" size="icon" onClick={() => window.open(urlRastreio, "_blank")} title="Rastrear envio">
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          <div className="space-y-2">
            <Label>Data de despacho</Label>
            <DateInput value={dataDespacho} onChange={setDataDespacho} />
          </div>
          <div className="space-y-2">
            <Label>Previsão de chegada</Label>
            <DateInput value={previsaoChegada} onChange={setPrevisaoChegada} />
          </div>
          <div className="sm:col-span-2 space-y-2">
            <Label>Observações</Label>
            <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={3} />
          </div>
        </div>
        <div className="flex justify-end pt-2">
          <Button onClick={handleSave} disabled={salvar.isPending}>
            {salvar.isPending ? "Salvando..." : "Salvar transporte"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default OrdemCompraDetalhePage;
