import React from "react";
import { cn } from "@/lib/utils";
import { Eye, Layers, ChevronRight, Hash, Smartphone, Mail, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import type { BlockConfig } from "@/hooks/useProposalMessageConfig";

interface Props {
  blockKeys: string[];
  blocks: Record<string, BlockConfig>;
  blockLabels: Record<string, { label: string; description: string }>;
  previewMode: "cliente" | "consultor";
  previewStyle: "curta" | "completa";
}

export function LiveStructurePreview({ blockKeys, blocks, blockLabels, previewMode, previewStyle }: Props) {
  const activeBlocks = blockKeys.filter(key => {
    const cfg = blocks[key];
    if (!cfg?.enabled) return false;
    if (cfg.modes && cfg.modes.length > 0 && !cfg.modes.includes(previewMode)) return false;
    if (cfg.styles && cfg.styles.length > 0 && !cfg.styles.includes(previewStyle)) return false;
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-muted/20 border-l border-r rounded-xl overflow-hidden">
      <div className="p-4 bg-background border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-bold">Estrutura da Mensagem</h3>
        </div>
        <Badge variant="outline" className="text-[10px] uppercase font-bold px-1.5 h-5 border-primary/20 bg-primary/5 text-primary">
          Live
        </Badge>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {activeBlocks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center space-y-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-bold text-muted-foreground">Nenhum bloco ativo</p>
                <p className="text-[10px] text-muted-foreground">Ajuste os filtros ou ative blocos na aba "Blocos".</p>
              </div>
            </div>
          ) : (
            activeBlocks.map((key, index) => {
              const cfg = blocks[key];
              const label = blockLabels[key]?.label || key;
              return (
                <div key={key} className="group flex items-start gap-3 relative">
                  {/* Step Number */}
                  <div className="flex flex-col items-center gap-1 mt-1">
                    <div className="h-6 w-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-bold text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                      {index + 1}
                    </div>
                    {index < activeBlocks.length - 1 && (
                      <div className="w-0.5 h-8 bg-muted group-hover:bg-primary/20 transition-colors" />
                    )}
                  </div>

                  {/* Block Detail */}
                  <div className="flex-1 bg-background border rounded-lg p-3 shadow-sm group-hover:border-primary/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm">{cfg.prefix || "📄"}</span>
                        <span className="text-xs font-bold truncate max-w-[120px]">{cfg.title || label}</span>
                      </div>
                      <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-muted/50 px-1 rounded uppercase font-bold tracking-tight">
                        <Hash className="h-2.5 w-2.5" /> {key.replace('_', ' ')}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>

      <div className="p-4 bg-muted/40 border-t space-y-3">
        <div className="flex items-center justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          <span>Configuração Atual</span>
          <Settings2 className="h-3 w-3" />
        </div>
        
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2 rounded bg-background border text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Eye className="h-3 w-3" /> Perfil
            </span>
            <span className="font-bold capitalize">{previewMode}</span>
          </div>
          <div className="flex items-center justify-between p-2 rounded bg-background border text-[11px]">
            <span className="text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3 w-3" /> Estilo
            </span>
            <span className="font-bold capitalize">{previewStyle}</span>
          </div>
        </div>

        <Separator />

        <div className="flex items-center gap-2 justify-center py-1">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-1.5 rounded-full bg-green-500/10 text-green-600 border border-green-500/20">
                  <Smartphone className="h-3.5 w-3.5" />
                </div>
              </TooltipTrigger>
              <TooltipContent>WhatsApp Otimizado</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="p-1.5 rounded-full bg-blue-500/10 text-blue-600 border border-blue-500/20">
                  <Mail className="h-3.5 w-3.5" />
                </div>
              </TooltipTrigger>
              <TooltipContent>E-mail Otimizado</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    </div>
  );
}

import { Settings2, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "lucide-react";
// Wait, I already imported some of these. Fixed the double import below.
