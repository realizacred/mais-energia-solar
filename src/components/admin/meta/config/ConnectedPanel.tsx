import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CheckCircle2, Settings, Pause, Play, Facebook, Zap, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MetaLeadAdsDiagnosticsCard } from "@/components/admin/integrations/MetaLeadAdsDiagnosticsCard";
import type { MetaConfigMap } from "./useMetaFbConfigs";
import { META_KEYS } from "./useMetaFbConfigs";

interface ConnectedPanelProps {
  configs: MetaConfigMap;
  automation: any;
  pipelineName?: string;
  stageName?: string;
  responsibleName?: string;
  onReconfigure: () => void;
}

export function ConnectedPanel({ configs, automation, pipelineName, stageName, responsibleName, onReconfigure }: ConnectedPanelProps) {
  const queryClient = useQueryClient();

  const toggleActive = useMutation({
    mutationFn: async (active: boolean) => {
      const mainConfig = configs[META_KEYS.accessToken];
      if (mainConfig?.id) {
        await supabase
          .from("integration_configs")
          .update({ is_active: active, updated_at: new Date().toISOString() })
          .eq("id", mainConfig.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["meta-fb-configs"] });
      toast.success("Status atualizado");
    },
  });

  const toggleAutomation = useMutation({
    mutationFn: async (active: boolean) => {
      if (!automation?.id) return;
      await supabase
        .from("facebook_lead_automations")
        .update({ active, updated_at: new Date().toISOString() })
        .eq("id", automation.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["fb-lead-automation"] });
      toast.success("Automação atualizada");
    },
  });

  const mainConfig = configs[META_KEYS.accessToken];
  const isActive = mainConfig?.is_active ?? false;

  return (
    <div className="space-y-4">
      <MetaLeadAdsDiagnosticsCard />

      {/* Connection status */}
      <Card className="border-border/40">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Facebook className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">Facebook Ads</p>
                  <Badge variant={isActive ? "default" : "secondary"} className="text-[10px]">
                    {isActive ? "Conectado" : "Inativo"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground">Token configurado</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                checked={isActive}
                onCheckedChange={(v) => toggleActive.mutate(v)}
                disabled={toggleActive.isPending}
              />
              <Button variant="outline" size="sm" onClick={onReconfigure}>
                <Settings className="h-3.5 w-3.5 mr-1" /> Gerenciar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Automation status */}
      {automation && (
        <Card className="border-border/40">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-success" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground">Automação</p>
                    <Badge variant={automation.active ? "default" : "secondary"} className="text-[10px]">
                      {automation.active ? "Ativa" : "Pausada"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-muted-foreground mt-0.5">
                    <span>Lead Facebook</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{pipelineName || "—"}</span>
                    <ArrowRight className="h-3 w-3" />
                    <span>{stageName || "—"}</span>
                  </div>
                  {responsibleName && (
                    <p className="text-[11px] text-muted-foreground">
                      Responsável: {automation.round_robin ? `Rodízio (${automation.round_robin_users?.length || 0})` : responsibleName}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleAutomation.mutate(!automation.active)}
                  disabled={toggleAutomation.isPending}
                >
                  {automation.active ? <Pause className="h-3.5 w-3.5 mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
                  {automation.active ? "Pausar" : "Ativar"}
                </Button>
                <Button variant="outline" size="sm" onClick={onReconfigure}>
                  Configurar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!automation && (
        <Card className="border-dashed border-2 border-border/60">
          <CardContent className="p-4 text-center">
            <p className="text-sm text-muted-foreground mb-3">Automação não configurada. Os leads do Facebook não serão criados no CRM automaticamente.</p>
            <Button variant="outline" onClick={onReconfigure}>Configurar automação</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
