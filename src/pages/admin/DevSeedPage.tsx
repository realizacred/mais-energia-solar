import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui-kit/Spinner";
import { AlertTriangle, CheckCircle2, ExternalLink, FlaskConical, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface SeedResult {
  clienteId: string | null;
  clienteCode: string | null;
  dealId: string | null;
  dealNum: number | null;
  propostaId: string | null;
  propostaNum: number | null;
  propostaCodigo: string | null;
  projetoId: string | null;
}

interface StepStatus {
  label: string;
  status: "idle" | "running" | "success" | "error";
  message?: string;
}

export default function DevSeedPage() {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<SeedResult | null>(null);
  const [steps, setSteps] = useState<StepStatus[]>([
    { label: "Criar/obter cliente", status: "idle" },
    { label: "Criar projeto (deal)", status: "idle" },
    { label: "Criar proposta nativa", status: "idle" },
  ]);

  // Check admin on mount
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(!!data);
    })();
  }, []);

  const updateStep = (index: number, patch: Partial<StepStatus>) => {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  };

  const runSeed = async () => {
    setRunning(true);
    setResult(null);
    setSteps([
      { label: "Criar/obter cliente", status: "idle" },
      { label: "Criar projeto (deal)", status: "idle" },
      { label: "Criar proposta nativa", status: "idle" },
    ]);

    const seedResult: SeedResult = {
      clienteId: null, clienteCode: null,
      dealId: null, dealNum: null,
      propostaId: null, propostaNum: null, propostaCodigo: null, projetoId: null,
    };

    try {
      // ─── Step A: get_or_create_cliente ───
      updateStep(0, { status: "running" });

      const { data: clienteId, error: clienteErr } = await supabase.rpc(
        "get_or_create_cliente" as any,
        {
          p_nome: "Cliente Teste",
          p_telefone: "11999990000",
          p_email: null,
          p_cpf_cnpj: null,
          p_empresa: null,
          p_cep: null,
          p_estado: null,
          p_cidade: null,
          p_rua: null,
          p_numero: null,
          p_bairro: null,
          p_complemento: null,
        }
      );

      if (clienteErr || !clienteId) {
        const msg = clienteErr?.message || "RPC retornou null";
        console.error("[Seed] Cliente error:", clienteErr);
        updateStep(0, { status: "error", message: msg });
        toast({ title: "Erro no seed", description: `Cliente: ${msg}`, variant: "destructive" });
        setRunning(false);
        return;
      }

      seedResult.clienteId = clienteId as string;
      console.debug("[Seed] clienteId:", seedResult.clienteId);

      // Fetch cliente_code
      const { data: clienteRow } = await supabase
        .from("clientes")
        .select("cliente_code")
        .eq("id", seedResult.clienteId)
        .maybeSingle();
      seedResult.clienteCode = clienteRow?.cliente_code || null;

      updateStep(0, { status: "success", message: `ID: ${seedResult.clienteId} | Code: ${seedResult.clienteCode}` });

      // ─── Step B: Criar deal ───
      updateStep(1, { status: "running" });

      // Get owner_id (current user's consultor)
      const { data: { user } } = await supabase.auth.getUser();
      let ownerId: string | null = null;
      if (user) {
        const { data: consultor } = await supabase
          .from("consultores")
          .select("id")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle();
        ownerId = consultor?.id || null;
      }

      if (!ownerId) {
        // Fallback: pick first active consultor in tenant
        const { data: fallback } = await supabase
          .from("consultores")
          .select("id")
          .eq("ativo", true)
          .limit(1)
          .maybeSingle();
        ownerId = fallback?.id || null;
      }

      if (!ownerId) {
        updateStep(1, { status: "error", message: "Nenhum consultor ativo encontrado no tenant" });
        toast({ title: "Erro no seed", description: "Sem consultor ativo para owner_id", variant: "destructive" });
        setRunning(false);
        return;
      }

      // Get default pipeline + first stage
      const { data: pipeline } = await (supabase as any)
        .from("pipelines")
        .select("id, kind")
        .eq("is_default", true)
        .maybeSingle();

      let pipelineId = pipeline?.id || null;
      let stageId: string | null = null;

      if (!pipelineId) {
        // Fallback: first pipeline
        const { data: firstPipe } = await (supabase as any)
          .from("pipelines")
          .select("id, kind")
          .limit(1)
          .maybeSingle();
        pipelineId = firstPipe?.id || null;
      }

      if (pipelineId) {
        const { data: firstStage } = await (supabase as any)
          .from("pipeline_stages")
          .select("id")
          .eq("pipeline_id", pipelineId)
          .eq("is_closed", false)
          .order("position", { ascending: true })
          .limit(1)
          .maybeSingle();
        stageId = firstStage?.id || null;
      }

      console.debug("[Seed] deal payload:", { ownerId, customerId: seedResult.clienteId, pipelineId, stageId });

      const { data: dealRow, error: dealErr } = await supabase
        .from("deals")
        .insert({
          title: "Projeto Seed Teste",
          pipeline_id: pipelineId,
          stage_id: stageId,
          owner_id: ownerId,
          customer_id: seedResult.clienteId,
          value: 25000,
          status: "open",
        } as any)
        .select("id, deal_num")
        .single();

      if (dealErr || !dealRow) {
        const msg = dealErr?.message || "Insert retornou null";
        console.error("[Seed] Deal error:", dealErr);
        updateStep(1, { status: "error", message: msg });
        toast({ title: "Erro no seed", description: `Projeto: ${msg}`, variant: "destructive" });
        setRunning(false);
        return;
      }

      seedResult.dealId = dealRow.id;
      seedResult.dealNum = (dealRow as any).deal_num;
      console.debug("[Seed] dealId:", seedResult.dealId, "deal_num:", seedResult.dealNum);

      updateStep(1, { status: "success", message: `ID: ${seedResult.dealId} | #${seedResult.dealNum}` });

      // ─── Step C: Criar proposta nativa ───
      updateStep(2, { status: "running" });

      // We need the projeto_id that corresponds to this deal
      // The projetos table may auto-create via trigger, or we need to find it
      const { data: projetoRow } = await supabase
        .from("projetos")
        .select("id")
        .eq("deal_id", seedResult.dealId)
        .maybeSingle();

      const projetoIdForProposta = projetoRow?.id || null;

      console.debug("[Seed] proposta payload:", {
        projetoId: projetoIdForProposta,
        dealId: seedResult.dealId,
      });

      const { data: propostaData, error: propostaErr } = await supabase.rpc(
        "create_proposta_nativa_atomic" as any,
        {
          p_titulo: "Proposta Seed Teste",
          p_lead_id: null,
          p_projeto_id: projetoIdForProposta,
          p_deal_id: seedResult.dealId,
          p_origem: "native",
          p_potencia_kwp: 5.5,
          p_valor_total: 25000,
          p_snapshot: {},
        }
      );

      if (propostaErr || !propostaData) {
        const msg = propostaErr?.message || "RPC retornou null";
        console.error("[Seed] Proposta error:", propostaErr);
        updateStep(2, { status: "error", message: msg });
        toast({ title: "Erro no seed", description: `Proposta: ${msg}`, variant: "destructive" });
        setRunning(false);
        return;
      }

      const propResult = propostaData as any;
      seedResult.propostaId = propResult.proposta_id;
      seedResult.projetoId = propResult.projeto_id || projetoIdForProposta;

      // Fetch proposta_num and codigo
      const { data: propRow } = await supabase
        .from("propostas_nativas")
        .select("proposta_num, codigo")
        .eq("id", seedResult.propostaId)
        .maybeSingle();
      seedResult.propostaNum = propRow?.proposta_num || null;
      seedResult.propostaCodigo = (propRow as any)?.codigo || null;

      console.debug("[Seed] propostaId:", seedResult.propostaId, "proposta_num:", seedResult.propostaNum);

      updateStep(2, { status: "success", message: `ID: ${seedResult.propostaId} | #${seedResult.propostaNum} | Código: ${seedResult.propostaCodigo}` });

      setResult(seedResult);
      toast({ title: "✅ Seed completo!", description: "Cliente + Projeto + Proposta criados." });
    } catch (err: any) {
      console.error("[Seed] Unexpected error:", err);
      toast({ title: "Erro inesperado no seed", description: err?.message || String(err), variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Spinner size="md" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-semibold text-lg">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">
              Esta página é acessível somente para administradores.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FlaskConical className="h-6 w-6 text-primary" />
          Seed de Dados de Teste
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cria um Cliente + Projeto (deal) + Proposta Nativa usando os mesmos fluxos do sistema.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Criar fluxo completo</CardTitle>
          <CardDescription>
            Cliente Teste (11999990000) → Projeto Seed → Proposta Seed
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                {step.status === "idle" && <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />}
                {step.status === "running" && <Spinner size="sm" />}
                {step.status === "success" && <CheckCircle2 className="h-4 w-4 text-success" />}
                {step.status === "error" && <XCircle className="h-4 w-4 text-destructive" />}
                <span className={step.status === "error" ? "text-destructive" : ""}>
                  {step.label}
                </span>
                {step.message && (
                  <span className="text-[11px] text-muted-foreground ml-auto truncate max-w-[50%]" title={step.message}>
                    {step.message}
                  </span>
                )}
              </div>
            ))}
          </div>

          <Button onClick={runSeed} disabled={running} className="w-full">
            {running ? (
              <>
                <Spinner size="sm" className="mr-2" />
                Criando dados...
              </>
            ) : (
              "🌱 Criar Cliente + Projeto + Proposta (teste)"
            )}
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-base text-success flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Dados criados com sucesso
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Cliente */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Cliente Teste</p>
                <p className="text-xs text-muted-foreground">
                  Code: <Badge variant="outline" className="text-[10px]">{result.clienteCode}</Badge>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/clientes`)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir clientes
              </Button>
            </div>

            {/* Projeto */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Projeto #{result.dealNum}</p>
                <p className="text-xs text-muted-foreground">
                  Deal ID: <Badge variant="outline" className="text-[10px]">{result.dealId?.slice(0, 8)}...</Badge>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/projetos`)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir projetos
              </Button>
            </div>

            {/* Proposta */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Proposta #{result.propostaNum}</p>
                <p className="text-xs text-muted-foreground">
                  Código: <Badge variant="outline" className="text-[10px]">{result.propostaCodigo}</Badge>
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate(`/admin/propostas-nativas`)}
              >
                <ExternalLink className="h-3 w-3 mr-1" />
                Abrir propostas
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
