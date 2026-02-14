import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Plus, Search, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { label: "Rascunho", variant: "secondary" },
  generated: { label: "Gerada", variant: "default" },
  sent: { label: "Enviada", variant: "outline" },
  accepted: { label: "Aceita", variant: "default" },
  rejected: { label: "Recusada", variant: "destructive" },
  expired: { label: "Expirada", variant: "secondary" },
};

const formatBRL = (v: number | null) => {
  if (!v) return "—";
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
};

export function ProposalList() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [propostas, setPropostas] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadPropostas();
  }, []);

  const loadPropostas = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from("propostas_nativas")
        .select(`
          id, titulo, codigo, versao_atual, created_at, lead_id, cliente_id,
          proposta_versoes (
            id, versao_numero, status, valor_total, economia_mensal, payback_meses, potencia_kwp, grupo, created_at
          )
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      setPropostas(data || []);
    } catch (e) {
      console.error("Erro ao carregar propostas:", e);
    } finally {
      setLoading(false);
    }
  };

  const filtered = propostas.filter(p => {
    if (!search) return true;
    const q = search.toLowerCase();
    return p.titulo?.toLowerCase().includes(q) || p.codigo?.toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Propostas Nativas</h2>
          <p className="text-sm text-muted-foreground">{propostas.length} proposta(s) encontrada(s)</p>
        </div>
        <Button className="gap-2" onClick={() => navigate("/admin/propostas-nativas/nova")}>
          <Plus className="h-4 w-4" /> Nova Proposta
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por título ou código..."
          className="pl-9 h-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <FileText className="h-7 w-7 opacity-30" />
            </div>
            <p className="font-medium">Nenhuma proposta nativa ainda</p>
            <p className="text-sm mt-1">Clique em "Nova Proposta" para criar com o wizard.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const latestVersion = p.proposta_versoes
              ?.sort((a: any, b: any) => b.versao_numero - a.versao_numero)?.[0];
            const statusInfo = STATUS_LABELS[latestVersion?.status] || STATUS_LABELS.draft;

            return (
              <Card
                key={p.id}
                className="hover:shadow-md transition-shadow cursor-pointer border-border/60"
                onClick={() => {
                  if (latestVersion) {
                    navigate(`/admin/propostas-nativas/${p.id}/versoes/${latestVersion.id}`);
                  }
                }}
              >
                <CardContent className="flex items-center gap-4 py-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{p.titulo}</p>
                      <Badge variant={statusInfo.variant} className="text-[10px]">{statusInfo.label}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.codigo} • v{latestVersion?.versao_numero ?? 1}
                      {latestVersion?.potencia_kwp ? ` • ${latestVersion.potencia_kwp} kWp` : ""}
                      {latestVersion?.grupo ? ` • Grupo ${latestVersion.grupo}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{formatBRL(latestVersion?.valor_total)}</p>
                    {latestVersion?.payback_meses ? (
                      <p className="text-xs text-muted-foreground">{latestVersion.payback_meses} meses payback</p>
                    ) : null}
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
