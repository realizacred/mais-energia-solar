import { useState, useMemo } from "react";
import { 
  AlertCircle, 
  CheckCircle2, 
  ChevronRight, 
  Clock, 
  CalendarDays, 
  DollarSign, 
  Plus, 
  History,
  MoreVertical,
  ExternalLink,
  Ban,
  Filter
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { ProjetoItem } from "@/hooks/useProjetoPipeline";
import { useTasks, type Task } from "@/hooks/useTasks";
import { useConsultoresAtivos } from "@/hooks/useConsultoresAtivos";
import { priorityConfig } from "../tasks/taskConstants";
import { CreateTaskDialog } from "../tasks/CreateTaskDialog";

interface Props {
  projetos: ProjetoItem[];
  onViewProjeto: (p: ProjetoItem, tab?: string) => void;
  loading?: boolean;
}

export function CentralPendencias({ projetos, onViewProjeto, loading }: Props) {
  // 1. Carregar tarefas via hook unificado
  const { tasks, updateTaskStatus, isCreating, createTask } = useTasks({
    status: ["open", "doing"],
  });

  const [showCreate, setShowCreate] = useState(false);
  const { data: vendedores } = useConsultoresAtivos();

  // 2. Mapear projetos para acesso rápido
  const projetoMap = useMemo(() => {
    const map = new Map<string, ProjetoItem>();
    projetos.forEach(p => map.set(p.id, p));
    return map;
  }, [projetos]);

  // 3. Filtrar e formatar pendências (Tasks + Legado)
  const pendencias = useMemo(() => {
    // A. Tasks ativas vinculadas a projetos
    const taskPendencies = tasks
      .filter(t => t.related_type === "projeto" && t.related_id)
      .map(t => ({
        id: t.id,
        type: "task" as const,
        task: t,
        projeto: projetoMap.get(t.related_id!),
        priority: t.priority,
        title: t.title,
        description: t.description,
        createdAt: t.created_at,
        dueAt: t.due_at,
        source: t.source,
        assignedTo: t.assigned_to,
      }));

    // B. Fallback Legado (projetos em aguardando_documentacao que NÃO possuem task ativa)
    const projetoIdsComTask = new Set(taskPendencies.map(tp => tp.projeto?.id).filter(Boolean));
    
    const legacyPendencies = projetos
      .filter(p => p.status === "aguardando_documentacao" && !projetoIdsComTask.has(p.id))
      .map(p => ({
        id: `legacy-${p.id}`,
        type: "legacy" as const,
        projeto: p,
        priority: "P1" as const, // Legado assumimos P1
        title: "Aguardando Documentação",
        description: "Projeto parado na etapa de documentação (Legado)",
        createdAt: p.updated_at,
        dueAt: null,
        source: "legacy" as any,
        assignedTo: p.consultor_id,
      }));

    return [...taskPendencies, ...legacyPendencies].sort((a, b) => {
      // Prioridade primeiro (P0 > P1 > P2)
      const pMap = { P0: 0, P1: 1, P2: 2 };
      const diff = (pMap[a.priority as keyof typeof pMap] ?? 2) - (pMap[b.priority as keyof typeof pMap] ?? 2);
      if (diff !== 0) return diff;
      // Data mais antiga primeiro
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [tasks, projetos, projetoMap]);

  if (pendencias.length === 0 && !loading) return null;

  return (
    <div className="space-y-4 mb-8">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">Central de Pendências</h2>
            <p className="text-xs text-muted-foreground">Gestão operacional de tarefas e bloqueios</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-amber-500/5 text-amber-600 border-amber-500/20 px-2 py-1 gap-1.5 font-bold hidden sm:flex">
            <Clock className="w-3.5 h-3.5" />
            {pendencias.length} pendente{pendencias.length !== 1 ? 's' : ''}
          </Badge>
          
          <CreateTaskDialog
            open={showCreate}
            onOpenChange={setShowCreate}
            onSubmit={async (input) => {
              await createTask(input);
              setShowCreate(false);
            }}
            isSubmitting={isCreating}
            vendedores={vendedores || []}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {pendencias.map((item) => (
          <PendenciaCard 
            key={item.id} 
            item={item} 
            onResolve={() => item.type === "task" && updateTaskStatus({ taskId: item.task!.id, status: "done" })}
            onAdiar={() => {}} // TODO na fase 2B
            onView={() => item.projeto && onViewProjeto(item.projeto, item.type === "legacy" ? "documentos" : undefined)} 
          />
        ))}
      </div>
    </div>
  );
}

function PendenciaCard({ 
  item, 
  onResolve, 
  onAdiar,
  onView 
}: { 
  item: any; 
  onResolve: () => void;
  onAdiar: () => void;
  onView: () => void;
}) {
  const projeto = item.projeto;
  const prio = priorityConfig[item.priority] || priorityConfig.P2;
  const isOverdue = item.dueAt && new Date(item.dueAt) < new Date();

  return (
    <Card 
      className={cn(
        "group transition-all border-l-4 shadow-sm bg-card/50 hover:bg-card relative",
        item.priority === "P0" ? "border-l-destructive" : 
        item.priority === "P1" ? "border-l-amber-500" : "border-l-info"
      )}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start gap-2">
          <div className="min-w-0 flex-1" onClick={onView} role="button">
            <div className="flex items-center gap-1.5 mb-1">
              <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase tracking-tighter opacity-80">
                {projeto?.codigo || "PROJETO-N/A"}
              </p>
              <Badge className={cn("text-[8px] h-3.5 px-1 uppercase", prio.color)}>
                {item.priority}
              </Badge>
              {item.type === "legacy" && (
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 uppercase border-amber-500/30 text-amber-600 bg-amber-500/5">
                  LEGADO
                </Badge>
              )}
            </div>
            <h3 className="text-sm font-bold text-foreground truncate group-hover:text-primary transition-colors">
              {projeto?.cliente?.nome || "Sem nome"}
            </h3>
            <p className="text-xs font-medium text-foreground/80 line-clamp-1 mt-0.5">
              {item.title}
            </p>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuItem onClick={onView} className="gap-2">
                <ExternalLink className="h-4 w-4" /> Abrir Projeto
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              {item.type === "task" && (
                <>
                  <DropdownMenuItem onClick={onResolve} className="text-success gap-2">
                    <CheckCircle2 className="h-4 w-4" /> Resolver
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onAdiar} className="gap-2">
                    <Clock className="h-4 w-4" /> Adiar
                  </DropdownMenuItem>
                </>
              )}
              {item.type === "legacy" && (
                <DropdownMenuItem onClick={onView} className="gap-2">
                  <History className="h-4 w-4" /> Regularizar
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-muted-foreground border-t border-border/40 pt-2">
          <span className="flex items-center gap-1 font-medium">
            <DollarSign className="w-3 h-3 text-success" />
            {formatBRL(projeto?.valor_total || 0)}
          </span>
          <span className={cn("flex items-center gap-1", isOverdue && "text-destructive font-bold")}>
            <Clock className="w-3 h-3" />
            {item.dueAt 
              ? formatDistanceToNow(new Date(item.dueAt), { addSuffix: true, locale: ptBR })
              : formatDistanceToNow(new Date(item.createdAt), { addSuffix: true, locale: ptBR })}
          </span>
        </div>

        {item.description && (
          <p className="text-[10px] text-muted-foreground line-clamp-1 italic">
            "{item.description}"
          </p>
        )}

        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1">
             <div className="w-4 h-4 rounded-full bg-muted flex items-center justify-center text-[8px] font-bold">
               {item.source === "ai" ? "🤖" : item.source === "sla" ? "⚖️" : "👤"}
             </div>
             <span className="text-[10px] text-muted-foreground capitalize">
               {item.source || "manual"}
             </span>
          </div>
          
          {item.type === "task" ? (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onResolve}
              className="h-6 text-[10px] font-bold text-success hover:text-success hover:bg-success/10 px-2 gap-1"
            >
              <CheckCircle2 className="h-3 w-3" /> RESOLVER
            </Button>
          ) : (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onView}
              className="h-6 text-[10px] font-bold text-amber-600 hover:text-amber-700 hover:bg-amber-500/10 px-2 gap-1"
            >
              <History className="h-3 w-3" /> DOCUMENTOS
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}