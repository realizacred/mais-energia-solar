import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Target, GitBranch, Search, Plus, Trash2, Settings2 } from "lucide-react";
import { AutomationFlowNode, AutomationNodeType } from "@/types/automation-flow";
import { cn } from "@/lib/utils";

interface AutomationCanvasProps {
  nodes: AutomationFlowNode[];
  selectedNodeId: string | null;
  onNodeSelect: (node: AutomationFlowNode) => void;
  onAddNode: (index: number) => void;
  onRemoveNode: (id: string) => void;
}

const nodeIcons: Record<AutomationNodeType, any> = {
  trigger: FileText,
  action: Target,
  condition: GitBranch,
  search: Search,
};

const nodeColors: Record<AutomationNodeType, string> = {
  trigger: "bg-teal-600",
  action: "bg-blue-600",
  condition: "bg-orange-600",
  search: "bg-purple-600",
};

const nodeTitles: Record<AutomationNodeType, string> = {
  trigger: "Gatilho",
  action: "Ação",
  condition: "Condição",
  search: "Busca",
};

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
          
          return (
            <div key={node.id} className="flex flex-col items-center w-full">
              <div 
                onClick={() => onNodeSelect(node)}
                className={cn(
                  "group relative w-full p-4 bg-card border rounded-xl shadow-sm cursor-pointer transition-all hover:shadow-md hover:border-primary/50",
                  isSelected && "border-primary ring-2 ring-primary/20 ring-offset-1 shadow-md"
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
                      <h3 className="text-sm font-bold text-teal-600 dark:text-teal-400 uppercase tracking-tight">
                        {nodeTitles[node.type]}
                      </h3>
                    </div>
                    <p className="mt-0.5 text-sm font-medium text-foreground truncate">
                      {node.config.triggerType || node.config.actionType || "Configurar nó..."}
                    </p>
                    
                    {/* Config Summary Preview */}
                    <div className="mt-2 flex flex-wrap gap-1">
                      {node.config.funil_id && (
                        <Badge variant="secondary" className="text-[10px] h-4">Funil vinculado</Badge>
                      )}
                      {node.config.webhook_url && (
                        <Badge variant="secondary" className="text-[10px] h-4">Webhook</Badge>
                      )}
                      {node.config.template_mensagem && (
                        <Badge variant="secondary" className="text-[10px] h-4">Mensagem</Badge>
                      )}
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
                  className="h-8 w-8 rounded-full border-dashed bg-background shadow-sm hover:bg-primary hover:text-white hover:border-primary transition-all group"
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
            className="w-full h-24 border-dashed flex flex-col gap-2 rounded-xl"
            onClick={() => onAddNode(0)}
          >
            <Plus className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Adicionar gatilho inicial</span>
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
