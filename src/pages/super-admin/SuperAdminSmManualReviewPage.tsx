/**
 * SuperAdminSmManualReviewPage — Painel de quarentena da migração SolarMarket.
 *
 * Reaproveita: PageHeader, SectionCard, StatCard, useSmManualReview.
 * Não duplica: lógica de promoção (delegada a sm-promote via retry).
 * AGENTS.md RB-76, DA-48.
 */
import { useMemo, useState } from "react";
import { ShieldAlert, RefreshCw, Link as LinkIcon, UserPlus, EyeOff, CheckCircle2, RotateCw, Eye } from "lucide-react";
import {
  PageHeader, StatCard, SectionCard, EmptyState, LoadingState, StatusBadge,
} from "@/components/ui-kit";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  useManualReviewList, useManualReviewDetail, useManualReviewAction,
  type ManualReviewItem,
} from "@/hooks/super-admin/useSmManualReview";
import { formatDateTime } from "@/lib/dateUtils";

function similarity(meta: any): string {
  const s = meta?.similarity ?? meta?.score;
  if (typeof s === "number") return s.toFixed(2);
  return "—";
}

export default function SuperAdminSmManualReviewPage() {
  const { data = [], isLoading, error, refetch, isRefetching } = useManualReviewList();
  const action = useManualReviewAction();
  const [detailId, setDetailId] = useState<string | null>(null);
  const [linkDialog, setLinkDialog] = useState<ManualReviewItem | null>(null);
  const [linkTarget, setLinkTarget] = useState("");
  const [linkNotes, setLinkNotes] = useState("");

  const stats = useMemo(() => {
    const open = data.filter((d) => !d.resolved_at).length;
    const resolved = data.length - open;
    const propostas = new Set(
      data.flatMap((d) => (d.conflict_metadata?.related_propostas ?? []) as number[]),
    ).size;
    return { open, resolved, total: data.length, propostas };
  }, [data]);

  const detail = useManualReviewDetail(detailId);

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ShieldAlert}
        title="Manual Review — Migração SolarMarket"
        description="Resolva conflitos de promoção (homônimos, telefones colidentes) sem SQL manual"
        actions={
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isRefetching}>
            <RefreshCw className={`w-4 h-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={ShieldAlert} label="Em quarentena" value={stats.open} color="warning" />
        <StatCard icon={CheckCircle2} label="Resolvidos" value={stats.resolved} color="success" />
        <StatCard icon={ShieldAlert} label="Total" value={stats.total} color="primary" />
        <StatCard icon={ShieldAlert} label="Propostas afetadas" value={stats.propostas} color="info" />
      </div>

      <SectionCard icon={ShieldAlert} title="Conflitos">
        {isLoading ? <LoadingState message="Carregando..." />
          : error ? <EmptyState icon={ShieldAlert} title="Erro" description={String((error as any).message)} />
          : data.length === 0 ? <EmptyState icon={CheckCircle2} title="Sem conflitos" description="Nenhum item em quarentena." />
          : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>SM ID</TableHead>
                  <TableHead>Nome SM</TableHead>
                  <TableHead>Telefone canônico</TableHead>
                  <TableHead>Cliente CRM conflitante</TableHead>
                  <TableHead>Score</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Tentativas</TableHead>
                  <TableHead>Propostas</TableHead>
                  <TableHead>Última</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row) => {
                  const meta = row.conflict_metadata ?? {};
                  const resolved = !!row.resolved_at;
                  const propostas = (meta.related_propostas ?? []) as Array<number | string>;
                  return (
                    <TableRow key={row.id} className={resolved ? "opacity-60" : ""}>
                      <TableCell>
                        <StatusBadge variant={resolved ? "success" : "warning"} dot>
                          {resolved ? "Resolvido" : "Aberto"}
                        </StatusBadge>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{row.source_entity_id}</TableCell>
                      <TableCell className="text-sm">{meta.sm_name ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">{meta.sm_phone_canonical ?? "—"}</TableCell>
                      <TableCell className="text-sm">
                        {row.crm_client?.nome ?? meta.crm_existing_name ?? "—"}
                        {row.crm_client?.telefone && (
                          <div className="text-xs text-muted-foreground font-mono">
                            {row.crm_client.telefone}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{similarity(meta)}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{row.reason}</Badge></TableCell>
                      <TableCell className="text-center">{row.attempts}</TableCell>
                      <TableCell className="text-xs">
                        {propostas.length > 0 ? propostas.join(", ") : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDateTime(row.updated_at ?? row.created_at)}
                      </TableCell>
                      <TableCell className="text-right space-x-1 whitespace-nowrap">
                        <Button size="sm" variant="ghost" onClick={() => setDetailId(row.id)}>
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {!resolved && (
                          <>
                            <Button size="sm" variant="outline" disabled={action.isPending}
                              onClick={() => {
                                setLinkDialog(row);
                                setLinkTarget(row.conflict_entity_id ?? "");
                                setLinkNotes("");
                              }}
                              title="Vincular a cliente existente">
                              <LinkIcon className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" disabled={action.isPending}
                              onClick={() => action.mutate({ action: "resolve_create", id: row.id })}
                              title="Criar novo cliente">
                              <UserPlus className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" disabled={action.isPending}
                              onClick={() => action.mutate({ action: "resolve_ignore", id: row.id })}
                              title="Ignorar">
                              <EyeOff className="w-3.5 h-3.5" />
                            </Button>
                            <Button size="sm" variant="ghost" disabled={action.isPending}
                              onClick={() => action.mutate({ action: "retry", id: row.id })}
                              title="Retry promoção">
                              <RotateCw className="w-3.5 h-3.5" />
                            </Button>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
      </SectionCard>

      {/* Dialog: detalhe */}
      <Dialog open={!!detailId} onOpenChange={(o) => !o && setDetailId(null)}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalhe do conflito</DialogTitle>
            <DialogDescription>SM id: {detail.data?.row?.source_entity_id}</DialogDescription>
          </DialogHeader>
          {detail.isLoading ? <LoadingState message="Carregando..." /> : (
            <div className="space-y-4 text-sm">
              <Section title="Resolução">
                {detail.data?.row?.resolved_at ? (
                  <div className="text-xs space-y-1">
                    <div><b>Quando:</b> {formatDateTime(detail.data.row.resolved_at)}</div>
                    <div><b>Por:</b> {detail.data.row.resolved_by ?? "—"}</div>
                    <div><b>Notas:</b> {detail.data.row.resolution_notes ?? "—"}</div>
                  </div>
                ) : <div className="text-xs text-muted-foreground">Em aberto</div>}
              </Section>
              <Section title="Cliente CRM conflitante">
                <pre className="text-[11px] bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(detail.data?.crm_client ?? {}, null, 2)}
                </pre>
              </Section>
              <Section title={`Projetos do CRM (${detail.data?.projetos?.length ?? 0})`}>
                <pre className="text-[11px] bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(detail.data?.projetos ?? [], null, 2)}
                </pre>
              </Section>
              <Section title={`Deals do CRM (${detail.data?.deals?.length ?? 0})`}>
                <pre className="text-[11px] bg-muted p-2 rounded overflow-auto">
                  {JSON.stringify(detail.data?.deals ?? [], null, 2)}
                </pre>
              </Section>
              <Section title="Payload SM bruto">
                <pre className="text-[11px] bg-muted p-2 rounded overflow-auto max-h-[40vh]">
                  {JSON.stringify(detail.data?.sm_payload ?? {}, null, 2)}
                </pre>
              </Section>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog: link a cliente */}
      <Dialog open={!!linkDialog} onOpenChange={(o) => !o && setLinkDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular a cliente existente</DialogTitle>
            <DialogDescription>
              SM #{linkDialog?.source_entity_id} ({linkDialog?.conflict_metadata?.sm_name}) será vinculado ao cliente do CRM informado.
              Nenhum cliente novo será criado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">UUID do cliente CRM alvo</label>
              <Input value={linkTarget} onChange={(e) => setLinkTarget(e.target.value)} placeholder="uuid" className="font-mono text-xs" />
              {linkDialog?.conflict_entity_id === linkTarget && (
                <div className="text-[11px] text-muted-foreground mt-1">
                  Usando o cliente conflitante detectado: {linkDialog?.conflict_metadata?.crm_existing_name}
                </div>
              )}
            </div>
            <div>
              <label className="text-xs font-medium">Notas (auditoria)</label>
              <Textarea value={linkNotes} onChange={(e) => setLinkNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkDialog(null)}>Cancelar</Button>
            <Button
              disabled={action.isPending || !linkTarget}
              onClick={() => {
                if (!linkDialog) return;
                action.mutate(
                  { action: "resolve_link", id: linkDialog.id, target_cliente_id: linkTarget, notes: linkNotes || undefined },
                  { onSuccess: () => setLinkDialog(null) },
                );
              }}
            >
              Confirmar vínculo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">{title}</div>
      {children}
    </div>
  );
}
