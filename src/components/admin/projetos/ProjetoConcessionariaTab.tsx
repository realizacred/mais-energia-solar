import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, ClipboardList, Gauge, Zap, Lock, FileCheck2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useConcessionaria, type VistoriaData } from "@/hooks/useConcessionaria";
import { formatDate as formatDateBR } from "@/lib/dateUtils";

interface Props {
  dealId: string;
}

const STATUS_CONFIG: Record<string, { label: string; variant: string; classes: string }> = {
  nao_solicitada: { label: "Não solicitada", variant: "muted", classes: "bg-muted text-muted-foreground border-border" },
  solicitada: { label: "Solicitada", variant: "info", classes: "bg-info/10 text-info border-info/20" },
  em_analise: { label: "Em análise", variant: "info", classes: "bg-info/10 text-info border-info/20" },
  agendada: { label: "Agendada", variant: "warning", classes: "bg-warning/10 text-warning border-warning/20" },
  aprovada: { label: "Aprovada", variant: "success", classes: "bg-success/10 text-success border-success/20" },
  reprovada: { label: "Reprovada", variant: "destructive", classes: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function ProjetoConcessionariaTab({ dealId }: Props) {
  const ctx = useConcessionaria(dealId);

  if (ctx.vistoriaLoading || ctx.medidorLoading || ctx.ativacaoLoading || ctx.homologacaoLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}><CardContent className="p-5"><Skeleton className="h-32 w-full" /></CardContent></Card>
        ))}
      </div>
    );
  }

  const vistoriaAprovada = ctx.vistoria?.resultado === "aprovada";
  const medidorRegistrado = !!ctx.medidor?.id;
  const ativacaoConfirmada = !!ctx.ativacao?.id;

  const { propostaAceita, instalacaoConcluida, homologacaoAprovada } = ctx.prereqs;
  const vistoriaLiberada = propostaAceita && instalacaoConcluida && homologacaoAprovada;

  const pendencias: string[] = [];
  if (!propostaAceita) pendencias.push("Proposta aceita pelo cliente");
  if (!homologacaoAprovada) pendencias.push("Homologação aprovada pela concessionária");
  if (!instalacaoConcluida) pendencias.push("Instalação física concluída (OS)");

  return (
    <div className="space-y-4">
      {!vistoriaLiberada && (
        <Card className="shadow-sm border-l-4 border-l-warning">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" />
            <div className="space-y-1.5 text-sm">
              <p className="font-semibold text-foreground">Vistoria bloqueada — pré-requisitos pendentes</p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                {pendencias.map(p => <li key={p}>{p}</li>)}
              </ul>
            </div>
          </CardContent>
        </Card>
      )}
      <HomologacaoCard ctx={ctx} habilitado={propostaAceita} />
      <VistoriaCard ctx={ctx} habilitado={vistoriaLiberada} />
      <MedidorCard ctx={ctx} habilitado={vistoriaAprovada} />
      <AtivacaoCard ctx={ctx} habilitado={medidorRegistrado} ativacaoConfirmada={ativacaoConfirmada} />
    </div>
  );
}

// ── Homologação Card ──
function HomologacaoCard({ ctx, habilitado }: { ctx: ReturnType<typeof useConcessionaria>; habilitado: boolean }) {
  const [editMode, setEditMode] = useState(false);
  const [protocolo, setProtocolo] = useState("");
  const [dataSolicitacao, setDataSolicitacao] = useState("");
  const [dataAprovacao, setDataAprovacao] = useState("");
  const [status, setStatus] = useState<string>("solicitada");
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const homolog = ctx.homologacao;
  const currentStatus = homolog?.status || "nao_solicitada";
  const cfg = STATUS_CONFIG[currentStatus] || STATUS_CONFIG.nao_solicitada;

  const startEdit = () => {
    setProtocolo(homolog?.protocolo || "");
    setDataSolicitacao(homolog?.data_solicitacao || "");
    setDataAprovacao(homolog?.data_aprovacao || "");
    setStatus(homolog?.status || "solicitada");
    setMotivo(homolog?.motivo_reprovacao || "");
    setObservacoes(homolog?.observacoes || "");
    setEditMode(true);
  };

  const handleSave = async () => {
    await ctx.salvarHomologacao({
      status: status as any,
      protocolo: protocolo || null,
      data_solicitacao: dataSolicitacao || null,
      data_aprovacao: status === "aprovada"
        ? (dataAprovacao || new Date().toISOString().split("T")[0])
        : (dataAprovacao || null),
      motivo_reprovacao: status === "reprovada" ? motivo : null,
      observacoes: observacoes || null,
    });
    setEditMode(false);
  };

  return (
    <Card className={cn("shadow-sm", !habilitado && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10">
              <ShieldCheck className="w-4.5 h-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Homologação na concessionária</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Parecer de Acesso / Aprovação do projeto</p>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-xs", cfg.classes)}>{cfg.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!habilitado ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            Aguardando proposta aceita pelo cliente
          </div>
        ) : editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="solicitada">Solicitada</SelectItem>
                  <SelectItem value="em_analise">Em análise</SelectItem>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="reprovada">Reprovada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Protocolo</Label>
              <Input value={protocolo} onChange={e => setProtocolo(e.target.value)} placeholder="Nº do protocolo" />
            </div>
            <div className="space-y-2">
              <Label>Data solicitação</Label>
              <Input type="date" value={dataSolicitacao} onChange={e => setDataSolicitacao(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Data aprovação</Label>
              <Input type="date" value={dataAprovacao} onChange={e => setDataAprovacao(e.target.value)} />
            </div>
            {status === "reprovada" && (
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label>Motivo da reprovação *</Label>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} />
              </div>
            )}
            <div className="col-span-1 sm:col-span-2 space-y-2">
              <Label>Observações</Label>
              <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
            </div>
            <div className="col-span-1 sm:col-span-2 flex gap-2 justify-end">
              <Button variant="ghost" onClick={() => setEditMode(false)}>Cancelar</Button>
              <Button
                onClick={handleSave}
                disabled={ctx.homologacaoSaving || (status === "reprovada" && !motivo.trim())}
              >
                Salvar
              </Button>
            </div>
          </div>
        ) : (
          <>
            {homolog && currentStatus !== "nao_solicitada" && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                {homolog.protocolo && (
                  <div><span className="text-muted-foreground">Protocolo:</span> <span className="font-medium text-foreground">{homolog.protocolo}</span></div>
                )}
                {homolog.data_solicitacao && (
                  <div><span className="text-muted-foreground">Solicitação:</span> <span className="font-medium text-foreground">{formatDateBR(homolog.data_solicitacao)}</span></div>
                )}
                {homolog.data_aprovacao && (
                  <div><span className="text-muted-foreground">Aprovação:</span> <span className="font-medium text-foreground">{formatDateBR(homolog.data_aprovacao)}</span></div>
                )}
                {homolog.motivo_reprovacao && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-muted-foreground">Motivo reprovação:</span>{" "}
                    <span className="font-medium text-destructive">{homolog.motivo_reprovacao}</span>
                  </div>
                )}
                {homolog.observacoes && (
                  <div className="col-span-1 sm:col-span-2">
                    <span className="text-muted-foreground">Observações:</span>{" "}
                    <span className="text-foreground">{homolog.observacoes}</span>
                  </div>
                )}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <Button onClick={startEdit} variant={currentStatus === "nao_solicitada" ? "default" : "outline"}>
                <FileCheck2 className="h-4 w-4 mr-2" />
                {currentStatus === "nao_solicitada" ? "Registrar homologação" : "Editar homologação"}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Vistoria Card ──
function VistoriaCard({ ctx, habilitado }: { ctx: ReturnType<typeof useConcessionaria>; habilitado: boolean }) {
  const [resultModal, setResultModal] = useState(false);
  const [resultado, setResultado] = useState<string>("aprovada");
  const [motivo, setMotivo] = useState("");
  const [editMode, setEditMode] = useState(false);

  // Local form state for edit
  const [protocolo, setProtocolo] = useState("");
  const [dataSolicitacao, setDataSolicitacao] = useState("");
  const [dataAgendada, setDataAgendada] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const status = ctx.vistoria?.status || "nao_solicitada";
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.nao_solicitada;

  const handleRegistrarSolicitacao = () => {
    setProtocolo("");
    setDataSolicitacao(new Date().toISOString().split("T")[0]);
    setEditMode(false);
    ctx.avancarVistoria("solicitada", {
      protocolo: protocolo || undefined,
      data_solicitacao: new Date().toISOString().split("T")[0],
    });
  };

  const handleAgendarVistoria = () => {
    ctx.avancarVistoria("agendada", { data_agendada: dataAgendada || undefined });
  };

  const handleRegistrarResultado = () => {
    ctx.avancarVistoria(resultado as any, {
      resultado,
      data_realizada: new Date().toISOString().split("T")[0],
      motivo_reprovacao: resultado === "reprovada" ? motivo : null,
    });
    setResultModal(false);
  };

  const handleSaveEdit = () => {
    ctx.salvarVistoria({
      protocolo,
      data_solicitacao: dataSolicitacao || null,
      data_agendada: dataAgendada || null,
      observacoes,
    });
    setEditMode(false);
  };

  const startEdit = () => {
    setProtocolo(ctx.vistoria?.protocolo || "");
    setDataSolicitacao(ctx.vistoria?.data_solicitacao || "");
    setDataAgendada(ctx.vistoria?.data_agendada || "");
    setObservacoes(ctx.vistoria?.observacoes || "");
    setEditMode(true);
  };

  return (
    <>
      <Card className={cn("shadow-sm", !habilitado && status === "nao_solicitada" && "opacity-60")}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-info/10">
                <ClipboardList className="w-4.5 h-4.5 text-info" />
              </div>
              <CardTitle className="text-base font-semibold">Vistoria</CardTitle>
            </div>
            <Badge variant="outline" className={cn("text-xs", cfg.classes)}>{cfg.label}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {editMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Protocolo</Label>
                <Input value={protocolo} onChange={e => setProtocolo(e.target.value)} placeholder="Nº do protocolo" />
              </div>
              <div className="space-y-2">
                <Label>Data solicitação</Label>
                <Input type="date" value={dataSolicitacao} onChange={e => setDataSolicitacao(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Data agendada</Label>
                <Input type="date" value={dataAgendada} onChange={e => setDataAgendada(e.target.value)} />
              </div>
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} rows={2} />
              </div>
              <div className="col-span-1 sm:col-span-2 flex gap-2 justify-end">
                <Button variant="ghost" onClick={() => setEditMode(false)}>Cancelar</Button>
                <Button onClick={handleSaveEdit} disabled={ctx.vistoriaSaving}>Salvar</Button>
              </div>
            </div>
          ) : (
            <>
              {/* Show existing data */}
              {ctx.vistoria && status !== "nao_solicitada" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {ctx.vistoria.protocolo && (
                    <div>
                      <span className="text-muted-foreground">Protocolo:</span>{" "}
                      <span className="font-medium text-foreground">{ctx.vistoria.protocolo}</span>
                    </div>
                  )}
                  {ctx.vistoria.data_solicitacao && (
                    <div>
                      <span className="text-muted-foreground">Solicitação:</span>{" "}
                      <span className="font-medium text-foreground">{formatDateBR(ctx.vistoria.data_solicitacao)}</span>
                    </div>
                  )}
                  {ctx.vistoria.data_agendada && (
                    <div>
                      <span className="text-muted-foreground">Agendada:</span>{" "}
                      <span className="font-medium text-foreground">{formatDateBR(ctx.vistoria.data_agendada)}</span>
                    </div>
                  )}
                  {ctx.vistoria.data_realizada && (
                    <div>
                      <span className="text-muted-foreground">Realizada:</span>{" "}
                      <span className="font-medium text-foreground">{formatDateBR(ctx.vistoria.data_realizada)}</span>
                    </div>
                  )}
                  {ctx.vistoria.motivo_reprovacao && (
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-muted-foreground">Motivo reprovação:</span>{" "}
                      <span className="font-medium text-destructive">{ctx.vistoria.motivo_reprovacao}</span>
                    </div>
                  )}
                  {ctx.vistoria.observacoes && (
                    <div className="col-span-1 sm:col-span-2">
                      <span className="text-muted-foreground">Observações:</span>{" "}
                      <span className="text-foreground">{ctx.vistoria.observacoes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Action buttons by status */}
              <div className="flex flex-wrap gap-2">
                {status === "nao_solicitada" && (
                  <Button onClick={handleRegistrarSolicitacao} disabled={ctx.vistoriaSaving}>
                    Registrar solicitação
                  </Button>
                )}
                {status === "solicitada" && (
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Input
                      type="date"
                      className="w-auto"
                      value={dataAgendada}
                      onChange={e => setDataAgendada(e.target.value)}
                      placeholder="Data agendada"
                    />
                    <Button onClick={handleAgendarVistoria} disabled={ctx.vistoriaSaving || !dataAgendada}>
                      Agendar vistoria
                    </Button>
                  </div>
                )}
                {status === "agendada" && (
                  <Button onClick={() => setResultModal(true)} disabled={ctx.vistoriaSaving}>
                    Registrar resultado
                  </Button>
                )}
                {(status === "aprovada" || status === "reprovada") && (
                  <Button variant="outline" onClick={startEdit}>Editar</Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Result modal */}
      <Dialog open={resultModal} onOpenChange={setResultModal}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle>Resultado da vistoria</DialogTitle>
            <DialogDescription>Informe se a vistoria foi aprovada ou reprovada.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Resultado</Label>
              <Select value={resultado} onValueChange={setResultado}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="aprovada">Aprovada</SelectItem>
                  <SelectItem value="reprovada">Reprovada</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {resultado === "reprovada" && (
              <div className="space-y-2">
                <Label>Motivo da reprovação *</Label>
                <Textarea value={motivo} onChange={e => setMotivo(e.target.value)} placeholder="Descreva o motivo..." rows={3} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setResultModal(false)}>Cancelar</Button>
            <Button
              onClick={handleRegistrarResultado}
              disabled={ctx.vistoriaSaving || (resultado === "reprovada" && !motivo.trim())}
            >
              Confirmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Medidor Card ──
function MedidorCard({ ctx, habilitado }: { ctx: ReturnType<typeof useConcessionaria>; habilitado: boolean }) {
  const [antigo, setAntigo] = useState(ctx.medidor?.numero_medidor_antigo || "");
  const [novo, setNovo] = useState(ctx.medidor?.numero_medidor_novo || "");
  const [dataTroca, setDataTroca] = useState(ctx.medidor?.data_troca || "");
  const [obs, setObs] = useState(ctx.medidor?.observacoes || "");

  const handleSave = () => {
    ctx.salvarMedidor({
      numero_medidor_antigo: antigo || null,
      numero_medidor_novo: novo || null,
      data_troca: dataTroca || null,
      tipo: "bidirecional",
      observacoes: obs || null,
    });
  };

  return (
    <Card className={cn("shadow-sm", !habilitado && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10">
            <Gauge className="w-4.5 h-4.5 text-warning" />
          </div>
          <CardTitle className="text-base font-semibold">Troca do medidor</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!habilitado ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            Aguardando aprovação da vistoria
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nº medidor antigo</Label>
                <Input value={antigo} onChange={e => setAntigo(e.target.value)} placeholder="Número antigo" />
              </div>
              <div className="space-y-2">
                <Label>Nº medidor novo</Label>
                <Input value={novo} onChange={e => setNovo(e.target.value)} placeholder="Número novo" />
              </div>
              <div className="space-y-2">
                <Label>Data da troca</Label>
                <Input type="date" value={dataTroca} onChange={e => setDataTroca(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Input value="Bidirecional" disabled />
              </div>
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={ctx.medidorSaving}>Salvar registro</Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ── Ativação Card ──
function AtivacaoCard({ ctx, habilitado, ativacaoConfirmada }: {
  ctx: ReturnType<typeof useConcessionaria>;
  habilitado: boolean;
  ativacaoConfirmada: boolean;
}) {
  const [dataAtivacao, setDataAtivacao] = useState(ctx.ativacao?.data_ativacao || "");
  const [numeroUc, setNumeroUc] = useState(ctx.ativacao?.numero_uc || "");
  const [confirmadoPor, setConfirmadoPor] = useState(ctx.ativacao?.confirmado_por || "");
  const [obs, setObs] = useState(ctx.ativacao?.observacoes || "");

  const handleConfirmar = () => {
    ctx.salvarAtivacao({
      data_ativacao: dataAtivacao || null,
      numero_uc: numeroUc || null,
      confirmado_por: confirmadoPor || null,
      observacoes: obs || null,
    });
  };

  return (
    <Card className={cn("shadow-sm", !habilitado && "opacity-60")}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10">
            <Zap className="w-4.5 h-4.5 text-success" />
          </div>
          <CardTitle className="text-base font-semibold">Ativação do sistema</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {ativacaoConfirmada && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success text-sm font-medium">
            <CheckCircle className="h-4 w-4 shrink-0" />
            Sistema ativo desde {ctx.ativacao?.data_ativacao ? formatDateBR(ctx.ativacao.data_ativacao) : "—"}
          </div>
        )}
        {!habilitado && !ativacaoConfirmada ? (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 text-warning text-sm">
            <Lock className="h-4 w-4 shrink-0" />
            Aguardando registro do medidor
          </div>
        ) : !ativacaoConfirmada ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data de ativação</Label>
                <Input type="date" value={dataAtivacao} onChange={e => setDataAtivacao(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Número da UC</Label>
                <Input value={numeroUc} onChange={e => setNumeroUc(e.target.value)} placeholder="Nº UC" />
              </div>
              <div className="space-y-2">
                <Label>Confirmado por</Label>
                <Input value={confirmadoPor} onChange={e => setConfirmadoPor(e.target.value)} placeholder="Nome do responsável" />
              </div>
              <div className="col-span-1 sm:col-span-2 space-y-2">
                <Label>Observações</Label>
                <Textarea value={obs} onChange={e => setObs(e.target.value)} rows={2} />
              </div>
            </div>
            <div className="flex justify-end">
              <Button onClick={handleConfirmar} disabled={ctx.ativacaoSaving}>Confirmar ativação</Button>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
