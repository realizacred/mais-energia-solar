/**
 * AuditoriaTelefonesPage — Audita o padrão de telefones (XX) XXXXX-XXXX em
 * clientes, leads, consultores e fornecedores.
 *
 * Reaproveita:
 *  - view pública v_auditoria_telefones (SSOT no banco)
 *  - useAuditoriaTelefones (data fetching)
 *  - design system SaaS Premium (LoadingState, Card, Badge, Tabs)
 *
 * RB-62 (governança): formatação BR é aplicada por trigger no banco;
 * esta página apenas mostra status e permite re-disparar normalização
 * via UPDATE (a trigger reformata automaticamente).
 */
import { useMemo, useState } from "react";
import { useAuditoriaTelefones, type StatusPhone, type AuditoriaTelefoneRow } from "@/hooks/useAuditoriaTelefones";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Phone, AlertTriangle, CheckCircle2, XCircle, RefreshCcw } from "lucide-react";
import { LoadingState } from "@/components/shared/LoadingState";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const STATUS_META: Record<StatusPhone, { label: string; color: string; icon: any }> = {
  ok: { label: "Padronizado", color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  corrigivel: { label: "Corrigível", color: "bg-amber-500/10 text-amber-600 border-amber-500/30", icon: AlertTriangle },
  invalido: { label: "Inválido", color: "bg-destructive/10 text-destructive border-destructive/30", icon: XCircle },
  vazio: { label: "Vazio", color: "bg-muted text-muted-foreground border-border", icon: Phone },
};

export default function AuditoriaTelefonesPage() {
  const { data, isLoading } = useAuditoriaTelefones();
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState("");
  const [tab, setTab] = useState<"todos" | StatusPhone>("corrigivel");

  const stats = useMemo(() => {
    const acc: Record<StatusPhone, number> = { ok: 0, corrigivel: 0, invalido: 0, vazio: 0 };
    (data ?? []).forEach((r) => { acc[r.status_phone] = (acc[r.status_phone] ?? 0) + 1; });
    return acc;
  }, [data]);

  const filtered = useMemo(() => {
    const rows = (data ?? []).filter((r) => tab === "todos" || r.status_phone === tab);
    if (!filtro.trim()) return rows;
    const f = filtro.toLowerCase();
    return rows.filter((r) =>
      (r.rotulo ?? "").toLowerCase().includes(f) ||
      (r.telefone_atual ?? "").toLowerCase().includes(f) ||
      r.tabela.includes(f)
    );
  }, [data, tab, filtro]);

  const renormalizar = async (row: AuditoriaTelefoneRow) => {
    if (!row.telefone_sugerido) return;
    try {
      const { error } = await supabase
        .from(row.tabela as any)
        .update({ telefone: row.telefone_sugerido })
        .eq("id", row.registro_id);
      if (error) throw error;
      toast.success(`Telefone re-normalizado em ${row.tabela}`);
      queryClient.invalidateQueries({ queryKey: ["auditoria-telefones"] });
    } catch (e: any) {
      toast.error(`Falha: ${e.message}`);
    }
  };

  if (isLoading) return <LoadingState message="Auditando telefones..." />;

  return (
    <div className="space-y-6 p-6">
      <header className="border-l-4 border-primary pl-4">
        <h1 className="text-2xl font-bold tracking-tight">Auditoria de Telefones</h1>
        <p className="text-sm text-muted-foreground">
          Padrão BR <code className="bg-muted px-1 rounded">(XX) XXXXX-XXXX</code> aplicado por trigger.
          Registros aqui mostram o estado atual de todas as fontes.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(STATUS_META) as StatusPhone[]).map((k) => {
          const M = STATUS_META[k];
          const Icon = M.icon;
          return (
            <Card key={k} className="border-l-4" style={{ borderLeftColor: "currentColor" }}>
              <CardContent className="p-4 flex items-center gap-3">
                <Icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <div className="text-2xl font-bold">{stats[k] ?? 0}</div>
                  <div className="text-xs text-muted-foreground">{M.label}</div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <CardTitle>Registros</CardTitle>
          <Input
            placeholder="Filtrar por nome, telefone ou tabela..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="max-w-sm"
          />
        </CardHeader>
        <CardContent>
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="corrigivel">Corrigíveis ({stats.corrigivel})</TabsTrigger>
              <TabsTrigger value="invalido">Inválidos ({stats.invalido})</TabsTrigger>
              <TabsTrigger value="vazio">Vazios ({stats.vazio})</TabsTrigger>
              <TabsTrigger value="ok">Padronizados ({stats.ok})</TabsTrigger>
              <TabsTrigger value="todos">Todos</TabsTrigger>
            </TabsList>
            <TabsContent value={tab} className="mt-4">
              {filtered.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground text-sm">
                  Nenhum registro nesta categoria.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b text-left text-muted-foreground">
                      <tr>
                        <th className="py-2 px-2">Tabela</th>
                        <th className="py-2 px-2">Nome</th>
                        <th className="py-2 px-2">Telefone atual</th>
                        <th className="py-2 px-2">Sugerido</th>
                        <th className="py-2 px-2">Status</th>
                        <th className="py-2 px-2 text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.slice(0, 500).map((r) => {
                        const M = STATUS_META[r.status_phone];
                        return (
                          <tr key={`${r.tabela}-${r.registro_id}`} className="border-b hover:bg-muted/30">
                            <td className="py-2 px-2"><Badge variant="outline">{r.tabela}</Badge></td>
                            <td className="py-2 px-2 font-medium">{r.rotulo ?? "—"}</td>
                            <td className="py-2 px-2 font-mono text-xs">{r.telefone_atual || <span className="text-muted-foreground">—</span>}</td>
                            <td className="py-2 px-2 font-mono text-xs text-emerald-600">{r.telefone_sugerido ?? "—"}</td>
                            <td className="py-2 px-2"><Badge className={M.color} variant="outline">{M.label}</Badge></td>
                            <td className="py-2 px-2 text-right">
                              {r.status_phone === "corrigivel" && r.telefone_sugerido && (
                                <Button size="sm" variant="outline" onClick={() => renormalizar(r)}>
                                  <RefreshCcw className="h-3.5 w-3.5 mr-1" /> Aplicar
                                </Button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {filtered.length > 500 && (
                    <div className="text-xs text-muted-foreground py-3 text-center">
                      Mostrando 500 de {filtered.length} registros. Use o filtro para refinar.
                    </div>
                  )}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
