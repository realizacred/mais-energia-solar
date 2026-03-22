import { useState, useEffect } from "react";
import { formatIntegerBR } from "@/lib/formatters";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users,
  UserCheck,
  MessageCircle,
  Bell,
  ClipboardList,
  Shield,
  Trash2,
  AlertTriangle,
  Database,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/ui-kit/Spinner";
import { motion } from "framer-motion";

interface SegmentInfo {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
  colorClass: string;
  tables: Record<string, number>;
}

const SEGMENT_META: Record<string, { icon: React.ComponentType<{ className?: string }>; description: string; colorClass: string }> = {
  crm: { icon: Users, description: "Leads, orçamentos e simulações. Reseta sequences de códigos.", colorClass: "text-primary" },
  clientes: { icon: UserCheck, description: "Clientes, projetos, parcelas e comissões.", colorClass: "text-primary" },
  whatsapp: { icon: MessageCircle, description: "Conversas, mensagens, outbox e webhooks. Preserva instâncias.", colorClass: "text-primary" },
  followups: { icon: Bell, description: "Fila de follow-ups e logs de automação.", colorClass: "text-warning" },
  checklists: { icon: ClipboardList, description: "Checklists de instalação, instalador e cliente com arquivos.", colorClass: "text-primary" },
  audit: { icon: Shield, description: "Logs de auditoria, distribuição e contadores de uso.", colorClass: "text-destructive" },
};

export function DataResetManager() {
  const [segments, setSegments] = useState<SegmentInfo[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [confirmed, setConfirmed] = useState(false);

  const fetchCounts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data-reset", {
        body: { action: "counts" },
      });

      if (error) throw error;

      const result: SegmentInfo[] = Object.entries(data.segments as Record<string, string>).map(
        ([key, label]) => ({
          key,
          label,
          ...(SEGMENT_META[key] || { icon: Database, description: "", colorClass: "text-muted-foreground" }),
          tables: (data.counts as Record<string, Record<string, number>>)[key] || {},
        })
      );

      setSegments(result);
    } catch (err: any) {
      console.error("Error fetching counts:", err);
      toast.error("Erro ao carregar contagens: " + (err.message || "Erro desconhecido"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounts();
  }, []);

  const toggleSegment = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalRecords = (tables: Record<string, number>) =>
    Object.values(tables).reduce((sum, v) => sum + Math.max(v, 0), 0);

  const selectedTotal = segments
    .filter((s) => selected.has(s.key))
    .reduce((sum, s) => sum + totalRecords(s.tables), 0);

  const handleReset = async () => {
    setResetting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-data-reset", {
        body: { action: "reset", segments: Array.from(selected) },
      });

      if (error) throw error;

      toast.success(
        `✅ Limpeza concluída! ${data.tables_truncated?.length || 0} tabelas zeradas.`
      );
      setSelected(new Set());
      setShowConfirm(false);
      setConfirmText("");
      setConfirmed(false);
      await fetchCounts();
    } catch (err: any) {
      console.error("Reset error:", err);
      toast.error("Erro ao executar limpeza: " + (err.message || "Erro desconhecido"));
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-80 mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Database className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Limpeza de Dados</h1>
            <p className="text-sm text-muted-foreground">
              Selecione os segmentos para apagar. Configurações, usuários e instâncias são preservados.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchCounts} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {/* Segments Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {segments.map((seg, i) => {
          const Icon = seg.icon;
          const total = totalRecords(seg.tables);
          const isSelected = selected.has(seg.key);

          return (
            <motion.div
              key={seg.key}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.35 }}
            >
              <Card
                className={`cursor-pointer transition-all duration-200 bg-card border-border shadow-sm ${
                  isSelected
                    ? "ring-2 ring-destructive/50 bg-destructive/5 border-destructive/30"
                    : "hover:shadow-md hover:border-primary/30"
                } ${total === 0 ? "opacity-60" : ""}`}
                onClick={() => total > 0 && toggleSegment(seg.key)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={isSelected}
                        disabled={total === 0}
                        onCheckedChange={() => total > 0 && toggleSegment(seg.key)}
                        onClick={(e) => e.stopPropagation()}
                      />
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10">
                        <Icon className={`h-4 w-4 ${seg.colorClass}`} />
                      </div>
                      <CardTitle className="text-sm font-semibold text-foreground">{seg.label}</CardTitle>
                    </div>
                    <Badge variant={total > 0 ? "secondary" : "outline"} className="text-xs font-mono">
                      {total.toLocaleString("pt-BR")} reg.
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground mb-3">{seg.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(seg.tables).map(([table, count]) => (
                      <Badge
                        key={table}
                        variant="outline"
                        className="text-[10px] font-mono px-1.5 py-0"
                      >
                        {table}: {count >= 0 ? count : "?"}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {/* Action Bar */}
      {selected.size > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {selected.size} segmento{selected.size > 1 ? "s" : ""} selecionado{selected.size > 1 ? "s" : ""}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedTotal.toLocaleString("pt-BR")} registros serão apagados permanentemente
                  </p>
                </div>
              </div>
              <Button
                variant="destructive"
                onClick={() => setShowConfirm(true)}
                className="gap-2"
              >
                <Trash2 className="h-4 w-4" />
                Apagar Dados
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirm} onOpenChange={(open) => {
        if (!open) {
          setShowConfirm(false);
          setConfirmText("");
          setConfirmed(false);
        }
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Limpeza de Dados
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p>
                  Esta ação é <strong>irreversível</strong>. Os seguintes segmentos serão apagados:
                </p>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {segments
                    .filter((s) => selected.has(s.key))
                    .map((s) => (
                      <li key={s.key}>
                        {s.label} ({totalRecords(s.tables).toLocaleString("pt-BR")} registros)
                      </li>
                    ))}
                </ul>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="confirm-irreversible"
                      checked={confirmed}
                      onCheckedChange={(c) => setConfirmed(c === true)}
                    />
                    <Label htmlFor="confirm-irreversible" className="text-sm">
                      Entendo que isso é irreversível
                    </Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      Digite <strong>CONFIRMAR</strong> para liberar o botão
                    </Label>
                    <Input
                      value={confirmText}
                      onChange={(e) => setConfirmText(e.target.value)}
                      placeholder="CONFIRMAR"
                      className="font-mono"
                    />
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={!confirmed || confirmText !== "CONFIRMAR" || resetting}
              onClick={handleReset}
              className="gap-2"
            >
              {resetting ? (
                <Spinner size="sm" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
              {resetting ? "Apagando..." : "Apagar Permanentemente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
