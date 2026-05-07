/**
 * SuperAdmin — Split de clientes SM "absorvidos" pela antiga dedup-por-telefone.
 * Dry-run obrigatório antes do apply.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { invokeEdgeFunction } from "@/lib/edgeFunctionAuth";
import { toast } from "sonner";
import { AlertTriangle, PlayCircle, ShieldCheck } from "lucide-react";

interface Plan {
  cliente_mae_id: string;
  cliente_mae_nome: string | null;
  sm_id_absorvido: string;
  novo_cliente: {
    nome: string | null;
    telefone: string | null;
    cpf_cnpj: string | null;
    email: string | null;
    cliente_code: string;
  };
  projetos_a_mover: Array<{ id: string; external_id: string | null; nome: string | null }>;
  propostas_a_mover: Array<{ id: string; external_id: string | null }>;
  deals_a_atualizar: Array<{ id: string; from_customer: string | null }>;
}

interface Summary {
  dry_run: boolean;
  pares_detectados: number;
  pares_processados: number;
  novos_clientes: number;
  projetos_movidos: number;
  propostas_movidas: number;
  deals_atualizados: number;
  erros: Array<{ par: string; error: string }>;
  plano: Plan[];
}

export default function SuperAdminSmSplitAbsorbedPage() {
  const [limit, setLimit] = useState(200);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [confirmText, setConfirmText] = useState("");

  const run = async (dryRun: boolean) => {
    setLoading(true);
    setSummary(null);
    try {
      const data = await invokeEdgeFunction<{ ok: boolean; summary: Summary; error?: string }>(
        "sm-split-absorbed-clients",
        { body: { dry_run: dryRun, limit } },
      );
      if (!data?.ok) throw new Error(data?.error || "Falha");
      setSummary(data.summary);
      toast.success(dryRun ? "Dry-run concluído" : "Apply concluído");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error("Erro", { description: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center gap-3">
        <ShieldCheck className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-2xl font-bold">SolarMarket — Split de clientes absorvidos</h1>
          <p className="text-sm text-muted-foreground">
            Corrige resíduo da antiga dedup-por-telefone. Cada sm_id "extra" vira um cliente próprio (1:1).
          </p>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Não toca clientes corretos</AlertTitle>
        <AlertDescription>
          Apenas pares (cliente_mae, sm_id) onde o mesmo cliente CRM tem &gt;1 sm_id vinculado.
          O sm_id mais antigo permanece no cliente-mãe; os demais são separados.
          WhatsApp, billing e clientes 1:1 não são afetados.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader><CardTitle>Execução</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div>
              <Label>Limite de pares</Label>
              <Input type="number" min={1} max={500} value={limit}
                onChange={(e) => setLimit(Number(e.target.value))} className="w-32" />
            </div>
            <Button onClick={() => run(true)} disabled={loading} variant="secondary">
              <PlayCircle className="w-4 h-4 mr-2" />
              Dry-run
            </Button>
            <div className="ml-auto flex items-end gap-2">
              <div>
                <Label>Digite APLICAR para liberar</Label>
                <Input value={confirmText} onChange={(e) => setConfirmText(e.target.value)} className="w-44" />
              </div>
              <Button
                onClick={() => run(false)}
                disabled={loading || confirmText !== "APLICAR"}
                variant="destructive"
              >
                Aplicar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {summary && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Resumo
              <Badge variant={summary.dry_run ? "secondary" : "default"}>
                {summary.dry_run ? "DRY-RUN" : "APPLY"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Stat label="Pares detectados" value={summary.pares_detectados} />
              <Stat label="Pares processados" value={summary.pares_processados} />
              <Stat label="Novos clientes" value={summary.novos_clientes} />
              <Stat label="Projetos movidos" value={summary.projetos_movidos} />
              <Stat label="Propostas movidas" value={summary.propostas_movidas} />
              <Stat label="Deals atualizados" value={summary.deals_atualizados} />
              <Stat label="Erros" value={summary.erros.length} tone={summary.erros.length ? "danger" : undefined} />
            </div>

            {summary.erros.length > 0 && (
              <div className="rounded-md border border-destructive/40 p-3 text-sm">
                <strong>Erros:</strong>
                <ul className="list-disc pl-5">
                  {summary.erros.map((e, i) => (
                    <li key={i}><code>{e.par}</code>: {e.error}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-2">Cliente mãe</th>
                    <th className="py-2 pr-2">sm_id</th>
                    <th className="py-2 pr-2">Novo cliente</th>
                    <th className="py-2 pr-2">Projetos</th>
                    <th className="py-2 pr-2">Propostas</th>
                    <th className="py-2 pr-2">Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.plano.map((p) => (
                    <tr key={`${p.cliente_mae_id}:${p.sm_id_absorvido}`} className="border-b align-top">
                      <td className="py-2 pr-2">
                        <div className="font-medium">{p.cliente_mae_nome ?? "—"}</div>
                        <code className="text-xs text-muted-foreground">{p.cliente_mae_id}</code>
                      </td>
                      <td className="py-2 pr-2"><Badge variant="outline">{p.sm_id_absorvido}</Badge></td>
                      <td className="py-2 pr-2">
                        <div className="font-medium">{p.novo_cliente.nome ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">
                          {p.novo_cliente.telefone ?? "sem tel"} · {p.novo_cliente.cpf_cnpj ?? "sem doc"}
                        </div>
                        <code className="text-xs">{p.novo_cliente.cliente_code}</code>
                      </td>
                      <td className="py-2 pr-2">
                        {p.projetos_a_mover.length === 0 ? <span className="text-muted-foreground">—</span> :
                          <ul className="list-disc pl-4 text-xs">
                            {p.projetos_a_mover.map((x) => (
                              <li key={x.id}>{x.nome ?? x.external_id ?? x.id.slice(0, 8)}</li>
                            ))}
                          </ul>}
                      </td>
                      <td className="py-2 pr-2">
                        {p.propostas_a_mover.length === 0 ? <span className="text-muted-foreground">—</span> :
                          <ul className="list-disc pl-4 text-xs">
                            {p.propostas_a_mover.map((x) => <li key={x.id}>#{x.external_id ?? x.id.slice(0, 8)}</li>)}
                          </ul>}
                      </td>
                      <td className="py-2 pr-2">
                        <Badge variant="secondary">{p.deals_a_atualizar.length}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "danger" }) {
  return (
    <div className={`rounded-md border p-3 ${tone === "danger" ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}
