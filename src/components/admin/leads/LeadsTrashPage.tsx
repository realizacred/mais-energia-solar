import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Archive, RotateCcw, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PageHeader, LoadingState } from "@/components/ui-kit";

interface ArchivedLead {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  lead_code: string | null;
  updated_at: string;
  created_at: string;
  consultor: string | null;
}

export default function LeadsTrashPage() {
  const [leads, setLeads] = useState<ArchivedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [defaultStatusId, setDefaultStatusId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchArchived = useCallback(async () => {
    setLoading(true);

    // Busca o status "Arquivado" e o primeiro status padrão para restauração
    const [arquivadoRes, defaultRes] = await Promise.all([
      supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Arquivado")
        .single(),
      supabase
        .from("lead_status")
        .select("id")
        .neq("nome", "Arquivado")
        .order("ordem", { ascending: true })
        .limit(1)
        .single(),
    ]);

    if (arquivadoRes.error || !arquivadoRes.data) {
      toast({ title: "Status 'Arquivado' não encontrado", variant: "destructive" });
      setLoading(false);
      return;
    }

    if (defaultRes.data) {
      setDefaultStatusId(defaultRes.data.id);
    }

    const { data, error } = await supabase
      .from("leads")
      .select("id, nome, telefone, cidade, estado, lead_code, updated_at, created_at, consultor")
      .eq("status_id", arquivadoRes.data.id)
      .is("deleted_at", null)
      .order("updated_at", { ascending: false })
      .limit(200);

    if (error) {
      toast({ title: "Erro ao carregar arquivados", variant: "destructive" });
    } else {
      setLeads(data || []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => { fetchArchived(); }, [fetchArchived]);

  const handleRestore = async () => {
    if (!restoreId || !defaultStatusId) return;

    const { error } = await supabase
      .from("leads")
      .update({ status_id: defaultStatusId })
      .eq("id", restoreId);

    if (error) {
      toast({ title: "Erro ao restaurar", variant: "destructive" });
    } else {
      toast({ title: "Lead restaurado com sucesso!" });
      setLeads(prev => prev.filter(l => l.id !== restoreId));
    }
    setRestoreId(null);
  };

  const filtered = leads.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return l.nome.toLowerCase().includes(s) || l.telefone.includes(s) || (l.lead_code?.toLowerCase().includes(s));
  });

  if (loading) return <LoadingState message="Carregando arquivados..." />;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Archive}
        title="Leads Arquivados"
        description={`${leads.length} leads arquivados. Restaure para reativá-los no funil.`}
      />

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou código..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Badge variant="outline">{filtered.length} resultados</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Archive className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">Nenhum lead arquivado</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Cidade/UF</TableHead>
                  <TableHead>Consultor</TableHead>
                  <TableHead>Arquivado em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(lead => (
                  <TableRow key={lead.id} className="opacity-70 hover:opacity-100 transition-opacity">
                    <TableCell>
                      <div>
                        <p className="font-medium text-sm">{lead.nome}</p>
                        {lead.lead_code && <p className="text-xs text-muted-foreground">{lead.lead_code}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{lead.telefone}</TableCell>
                    <TableCell className="text-sm">{lead.cidade}/{lead.estado}</TableCell>
                    <TableCell className="text-sm">{lead.consultor || "—"}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(lead.updated_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => setRestoreId(lead.id)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        Restaurar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!restoreId} onOpenChange={() => setRestoreId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Restaurar Lead</AlertDialogTitle>
            <AlertDialogDescription>
              O lead será restaurado e voltará a aparecer na listagem ativa do funil.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRestore}>Restaurar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
