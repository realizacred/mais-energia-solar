import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { AutomationFlowNode, TRIGGER_LABELS, ACTION_LABELS } from "@/types/automation-flow";
import { cn } from "@/lib/utils";
import { 
  nodeIcons, 
  nodeColors, 
  nodeTitles, 
  nodeTitleColors 
} from "./AutomationNodeConstants";

interface AutomationCanvasProps {
  nodes: AutomationFlowNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: AutomationFlowNode) => void;
  onAddNode: (index: number) => void;
  onRemoveNode: (id: string) => void;
}

export function AutomationCanvas({ 
  nodes, 
  selectedNodeId, 
  onNodeSelect, 
  onAddNode, 
  onRemoveNode 
}: AutomationCanvasProps) {
  return (
    <div className="flex flex-col items-center py-8 space-y-4 min-h-full">
      <div className="flex flex-col items-center space-y-4 w-full max-w-md">
        <div className="w-px h-8 bg-border" />
        <div className="px-4 py-2 bg-muted rounded-full text-xs font-medium text-muted-foreground border">
          Início do Flow
        </div>
        <div className="w-px h-8 bg-border" />

        {nodes.map((node, index) => {
          const Icon = nodeIcons[node.type];
          const isSelected = selectedNodeId === node.id;
          const subtitle = node.type === 'trigger' 
            ? (node.config.triggerType ? TRIGGER_LABELS[node.config.triggerType] : "Configurar gatilho...")
            : (node.config.actionType ? ACTION_LABELS[node.config.actionType] : "Configurar nó...");

          return (
            <div key={node.id} className="flex flex-col items-center w-full">
              <div 
                onClick={() => onNodeSelect(node)}
                className={cn(
                  "group relative w-full p-4 bg-card border rounded-xl shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-teal-500/50",
                  isSelected && "border-teal-500 ring-2 ring-teal-500/20 ring-offset-1 shadow-md"
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn("p-2.5 rounded-lg text-white shadow-sm", nodeColors[node.type])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-bold">
                        {index + 1}
                      </Badge>
                      <h3 className={cn("text-sm font-bold uppercase tracking-tight", nodeTitleColors[node.type])}>
                        {nodeTitles[node.type]}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-foreground truncate">
                      {subtitle}
                    </p>
                    
                    {/* Config Summary Preview */}
                    <div className="mt-2 flex flex-col gap-1.5">
                      {node.config.actionType === 'whatsapp' && (node.config as any).wa_content_template && (
                        <div className="text-[11px] text-muted-foreground bg-teal-50/50 p-2 rounded border border-teal-100/50 line-clamp-2 italic">
                          "{(node.config as any).wa_content_template}"
                        </div>
                      )}

                      <div className="flex flex-wrap gap-1">
                        {node.config.funil_id && (
                          <Badge variant="secondary" className="text-[10px] h-4 bg-teal-100 text-teal-700 hover:bg-teal-100">Funil vinculado</Badge>
                        )}
                        {node.config.actionType === 'whatsapp' && (
                          <>
                            <Badge variant="secondary" className="text-[10px] h-4 bg-blue-100 text-blue-700 hover:bg-blue-100">
                              {node.config.wa_message_type === 'text' ? 'Texto' : 
                               node.config.wa_message_type === 'image' ? 'Imagem' :
                               node.config.wa_message_type === 'document' ? 'Documento' : 'Áudio'}
                            </Badge>
                            {node.config.wa_destinatario_tipo && (
                              <Badge variant="secondary" className="text-[10px] h-4 bg-slate-100 text-slate-700 hover:bg-slate-100">
                                Para: {node.config.wa_destinatario_tipo === 'cliente' ? 'Cliente' : 
                                       node.config.wa_destinatario_tipo === 'responsavel' ? 'Responsável' : 'Fixo'}
                              </Badge>
                            )}
                          </>
                        )}
                        {node.config.webhook_url && (
                          <Badge variant="secondary" className="text-[10px] h-4">Webhook</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveNode(node.id);
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>

              {/* Add next node button */}
              <div className="flex flex-col items-center py-2">
                <div className="w-px h-6 bg-border" />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8 rounded-full border-teal-300 bg-background shadow-sm text-teal-600 hover:bg-teal-50 hover:border-teal-400 transition-all group"
                  onClick={() => onAddNode(index + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <div className="w-px h-6 bg-border" />
              </div>
            </div>
          );
        })}

        {nodes.length === 0 && (
          <Button
            variant="outline"
            className="w-full h-24 border-dashed border-teal-300 flex flex-col gap-2 rounded-xl text-teal-600 hover:bg-teal-50"
            onClick={() => onAddNode(0)}
          >
            <Plus className="h-6 w-6" />
            <span className="text-sm font-medium">Adicionar gatilho inicial</span>
          </Button>
        )}
        
        {nodes.length > 0 && (
          <div className="px-4 py-2 bg-muted rounded-full text-xs font-medium text-muted-foreground border opacity-60">
            Fim do Flow
          </div>
        )}
      </div>
    </div>
  );
}
