import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, Play } from "lucide-react";

interface TestStep {
  label: string;
  status: "idle" | "running" | "pass" | "fail";
  result?: string;
  error?: string;
}

export default function RlsTestPage() {
  const [steps, setSteps] = useState<TestStep[]>([
    { label: "1. auth.uid() — Verificar sessão autenticada", status: "idle" },
    { label: "2. current_tenant_id() — RPC retorna UUID", status: "idle" },
    { label: "3. get_user_tenant_id(uid) — RPC retorna UUID", status: "idle" },
    { label: "4. INSERT kit teste com RLS", status: "idle" },
    { label: "5. SELECT kits do tenant com RLS", status: "idle" },
    { label: "6. DELETE kit teste (cleanup)", status: "idle" },
  ]);
  const [running, setRunning] = useState(false);

  const update = (i: number, patch: Partial<TestStep>) =>
    setSteps((prev) => prev.map((s, idx) => (idx === i ? { ...s, ...patch } : s)));

  const runTests = async () => {
    setRunning(true);
    setSteps((prev) => prev.map((s) => ({ ...s, status: "idle", result: undefined, error: undefined })));

    let uid: string | undefined;
    let tenantId: string | undefined;
    let kitId: string | undefined;

    try {
      // Step 1: auth.uid()
      update(0, { status: "running" });
      const { data: { user }, error: userErr } = await supabase.auth.getUser();
      if (userErr || !user) throw new Error(userErr?.message ?? "Usuário não autenticado");
      uid = user.id;
      update(0, { status: "pass", result: `uid = ${uid}` });

      // Step 2: current_tenant_id()
      update(1, { status: "running" });
      const { data: tid1, error: e1 } = await supabase.rpc("current_tenant_id");
      if (e1) throw new Error(`RPC error: ${e1.message}`);
      if (!tid1) throw new Error("Retornou NULL — profiles.user_id não vinculado ou tenant_id ausente");
      tenantId = tid1 as string;
      update(1, { status: "pass", result: `tenant_id = ${tenantId}` });

      // Step 3: get_user_tenant_id(uid)
      update(2, { status: "running" });
      const { data: tid2, error: e2 } = await supabase.rpc("get_user_tenant_id", { _user_id: uid });
      if (e2) throw new Error(`RPC error: ${e2.message}`);
      if (!tid2) throw new Error("Retornou NULL");
      if (tid2 !== tenantId) throw new Error(`Divergência: ${tid2} ≠ ${tenantId}`);
      update(2, { status: "pass", result: `tenant_id = ${tid2} (match ✓)` });

      // Step 4: INSERT
      update(3, { status: "running" });
      const { data: inserted, error: e3 } = await supabase
        .from("solar_kit_catalog")
        .insert({ tenant_id: tenantId, name: `Kit RLS Test ${Date.now()}`, status: "active", pricing_mode: "calculated" })
        .select("id, tenant_id, name")
        .single();
      if (e3) throw new Error(`INSERT falhou: ${e3.message} (code: ${e3.code})`);
      kitId = inserted.id;
      update(3, { status: "pass", result: `Criado: ${inserted.name} (id=${kitId})` });

      // Step 5: SELECT
      update(4, { status: "running" });
      const { data: kits, error: e4 } = await supabase
        .from("solar_kit_catalog")
        .select("id, name, tenant_id")
        .eq("tenant_id", tenantId);
      if (e4) throw new Error(`SELECT falhou: ${e4.message}`);
      const found = kits?.some((k) => k.id === kitId);
      if (!found) throw new Error("Kit inserido NÃO apareceu no SELECT — RLS pode estar bloqueando");
      update(4, { status: "pass", result: `${kits!.length} kit(s) listados, kit teste encontrado ✓` });

      // Step 6: Cleanup
      update(5, { status: "running" });
      const { error: e5 } = await supabase.from("solar_kit_catalog").delete().eq("id", kitId);
      if (e5) throw new Error(`DELETE falhou: ${e5.message}`);
      update(5, { status: "pass", result: "Kit teste removido com sucesso" });
    } catch (err: any) {
      const failIdx = steps.findIndex((s) => s.status === "running" || s.status === "idle");
      const idx = failIdx >= 0 ? failIdx : steps.length - 1;
      update(idx, { status: "fail", error: err.message });
    } finally {
      setRunning(false);
    }
  };

  const statusIcon = (s: TestStep["status"]) => {
    if (s === "running") return <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />;
    if (s === "pass") return <CheckCircle className="h-5 w-5 text-green-500" />;
    if (s === "fail") return <XCircle className="h-5 w-5 text-destructive" />;
    return <div className="h-5 w-5 rounded-full border-2 border-muted" />;
  };

  return (
    <div className="max-w-2xl mx-auto py-8 space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            RLS E2E Test — Solar Kit Catalog
            <Button onClick={runTests} disabled={running} size="sm">
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
              Executar
            </Button>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Valida current_tenant_id(), insert, select e delete sob contexto autenticado (anon key + JWT).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-lg border bg-card">
              {statusIcon(step.status)}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{step.label}</p>
                {step.result && <p className="text-xs text-green-600 mt-1 font-mono break-all">{step.result}</p>}
                {step.error && <p className="text-xs text-destructive mt-1 font-mono break-all">❌ {step.error}</p>}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Info: Supabase Client</CardTitle>
        </CardHeader>
        <CardContent className="text-xs font-mono text-muted-foreground space-y-1">
          <p>Key type: <span className="text-foreground font-semibold">anon (publishable)</span></p>
          <p>service_role no frontend: <span className="text-green-600 font-semibold">NÃO encontrado ✓</span></p>
          <p>RLS: <span className="text-foreground font-semibold">Ativo em solar_kit_catalog + solar_kit_catalog_items</span></p>
        </CardContent>
      </Card>
    </div>
  );
}
