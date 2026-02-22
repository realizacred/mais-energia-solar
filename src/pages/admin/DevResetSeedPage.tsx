import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  AlertTriangle, CheckCircle2, FlaskConical, Trash2, XCircle, Eye,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface PreviewCounts {
  proposta_versoes: number;
  propostas: number;
  projetos: number;
  deals: number;
  clientes: number;
}

interface DeleteResult {
  proposta_versoes_deleted: number;
  propostas_deleted: number;
  projetos_deleted: number;
  deals_deleted: number;
  clientes_deleted: number;
}

export default function DevResetSeedPage() {
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [preview, setPreview] = useState<PreviewCounts | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [result, setResult] = useState<DeleteResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setIsAdmin(false); return; }
      const { data } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(!!data);
    })();
  }, []);

  const loadPreview = async () => {
    setLoadingPreview(true);
    setError(null);
    setResult(null);
    try {
      const { data, error: err } = await supabase.rpc("preview_seed_data" as any);
      if (err) throw err;
      setPreview(data as unknown as PreviewCounts);
    } catch (e: any) {
      setError(e.message || String(e));
      toast({ title: "Erro ao carregar preview", description: e.message, variant: "destructive" });
    } finally {
      setLoadingPreview(false);
    }
  };

  const runDelete = async () => {
    setConfirmOpen(false);
    setDeleting(true);
    setError(null);
    try {
      const { data, error: err } = await supabase.rpc("delete_seed_data" as any);
      if (err) throw err;
      const res = data as unknown as DeleteResult;
      setResult(res);
      setPreview(null);
      localStorage.removeItem("lastSeedRunId");
      const total = Object.values(res).reduce((a, b) => a + b, 0);
      toast({ title: "🧹 Limpeza concluída", description: `${total} registros removidos.` });
    } catch (e: any) {
      setError(e.message || String(e));
      toast({ title: "Erro ao deletar seed", description: e.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const totalPreview = preview
    ? preview.proposta_versoes + preview.propostas + preview.projetos + preview.deals + preview.clientes
    : 0;

  if (isAdmin === null) {
    return <div className="flex items-center justify-center min-h-[40vh]"><Spinner size="md" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center space-y-3">
            <AlertTriangle className="h-10 w-10 text-destructive mx-auto" />
            <p className="font-semibold text-lg">Acesso restrito</p>
            <p className="text-sm text-muted-foreground">Somente administradores.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preview & Limpeza</CardTitle>
          <CardDescription>
            Primeiro visualize quantos registros serão afetados, depois confirme a exclusão.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preview button */}
          <Button onClick={loadPreview} disabled={loadingPreview || deleting} variant="outline" className="w-full">
            {loadingPreview ? <><Spinner size="sm" className="mr-2" /> Carregando...</> : <><Eye className="h-4 w-4 mr-2" /> Visualizar dados de seed</>}
          </Button>

          {/* Preview results */}
          {preview && (
            <div className="rounded-md border p-4 space-y-2">
              <p className="text-sm font-medium">Registros encontrados:</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {([
                  ["Versões de proposta", preview.proposta_versoes],
                  ["Propostas", preview.propostas],
                  ["Projetos", preview.projetos],
                  ["Deals", preview.deals],
                  ["Clientes", preview.clientes],
                ] as [string, number][]).map(([label, count]) => (
                  <div key={label} className="flex justify-between">
                    <span className="text-muted-foreground">{label}</span>
                    <Badge variant={count > 0 ? "destructive" : "secondary"}>{count}</Badge>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-2">Total: {totalPreview} registros</p>
            </div>
          )}

          {/* Delete button */}
          <Button
            onClick={() => setConfirmOpen(true)}
            disabled={deleting || !preview || totalPreview === 0}
            variant="destructive"
            className="w-full"
          >
            {deleting ? <><Spinner size="sm" className="mr-2" /> Deletando...</> : "🧹 Limpar dados de seed"}
          </Button>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <pre className="whitespace-pre-wrap break-all">{error}</pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result */}
      {result && (
        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-base text-success flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Limpeza concluída
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {([
                ["Versões deletadas", result.proposta_versoes_deleted],
                ["Propostas deletadas", result.propostas_deleted],
                ["Projetos deletados", result.projetos_deleted],
                ["Deals deletados", result.deals_deleted],
                ["Clientes deletados", result.clientes_deleted],
              ] as [string, number][]).map(([label, count]) => (
                <div key={label} className="flex justify-between">
                  <span className="text-muted-foreground">{label}</span>
                  <Badge variant="outline">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Confirm modal */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja apagar <strong>{totalPreview}</strong> registros de seed deste tenant?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={runDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Sim, apagar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
