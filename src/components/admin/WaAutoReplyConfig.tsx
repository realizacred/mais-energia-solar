import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Zap, Save, MessageCircle, Clock, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface AutoReplyConfig {
  auto_reply_enabled: boolean;
  auto_reply_message: string;
  auto_reply_cooldown_minutes: number;
}

export function WaAutoReplyConfig() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDirty, setIsDirty] = useState(false);
  const [localConfig, setLocalConfig] = useState<AutoReplyConfig>({
    auto_reply_enabled: false,
    auto_reply_message: "Olá {nome}! 👋 Recebemos sua mensagem e em breve um de nossos consultores entrará em contato. Obrigado!",
    auto_reply_cooldown_minutes: 60,
  });

  const { isLoading } = useQuery({
    queryKey: ["wa-auto-reply-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("whatsapp_automation_config")
        .select("auto_reply_enabled, auto_reply_message, auto_reply_cooldown_minutes")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setLocalConfig({
          auto_reply_enabled: data.auto_reply_enabled ?? false,
          auto_reply_message: data.auto_reply_message ?? localConfig.auto_reply_message,
          auto_reply_cooldown_minutes: data.auto_reply_cooldown_minutes ?? 60,
        });
      }
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("whatsapp_automation_config")
        .update({
          auto_reply_enabled: localConfig.auto_reply_enabled,
          auto_reply_message: localConfig.auto_reply_message,
          auto_reply_cooldown_minutes: localConfig.auto_reply_cooldown_minutes,
        })
        .neq("id", "00000000-0000-0000-0000-000000000000");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-auto-reply-config"] });
      setIsDirty(false);
      toast({ title: "Configuração salva!" });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const updateField = <K extends keyof AutoReplyConfig>(key: K, value: AutoReplyConfig[K]) => {
    setLocalConfig((prev) => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  if (isLoading) return null;

  return (
    <Card className={`border-2 transition-colors ${localConfig.auto_reply_enabled ? "border-success/30 bg-success/5" : "border-border/30"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-gradient-to-br from-success/20 to-success/5 border border-success/10">
              <Zap className="h-5 w-5 text-success" />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                Auto-Resposta Instantânea
                {localConfig.auto_reply_enabled && (
                  <Badge className="bg-success/20 text-success text-[10px]">Ativa</Badge>
                )}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Responda automaticamente quando um novo contato enviar a primeira mensagem
              </CardDescription>
            </div>
          </div>
          <Switch
            checked={localConfig.auto_reply_enabled}
            onCheckedChange={(v) => updateField("auto_reply_enabled", v)}
          />
        </div>
      </CardHeader>

      {localConfig.auto_reply_enabled && (
        <CardContent className="space-y-4 pt-0">
          {/* Message Template */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <MessageCircle className="h-3.5 w-3.5" />
                Mensagem automática
              </Label>
              <Tooltip>
                <TooltipTrigger>
                  <Info className="h-3 w-3 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Use <code>{"{nome}"}</code> para o nome do contato e <code>{"{telefone}"}</code> para o número.
                </TooltipContent>
              </Tooltip>
            </div>
            <Textarea
              value={localConfig.auto_reply_message}
              onChange={(e) => updateField("auto_reply_message", e.target.value)}
              className="min-h-[80px] text-sm resize-y"
              placeholder="Olá {nome}! 👋 Recebemos sua mensagem..."
            />
            <div className="flex gap-1.5 flex-wrap">
              {["{nome}", "{telefone}"].map((v) => (
                <Badge
                  key={v}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 text-[10px]"
                  onClick={() => {
                    updateField("auto_reply_message", localConfig.auto_reply_message + ` ${v}`);
                  }}
                >
                  {v}
                </Badge>
              ))}
            </div>
          </div>

          {/* Cooldown */}
          <div className="space-y-2">
            <Label className="text-xs font-medium flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />
              Cooldown (minutos)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                min={5}
                max={1440}
                value={localConfig.auto_reply_cooldown_minutes}
                onChange={(e) => updateField("auto_reply_cooldown_minutes", parseInt(e.target.value) || 60)}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">
                Evita enviar mais de uma resposta automática para o mesmo contato neste período
              </span>
            </div>
          </div>

          {/* Save */}
          {isDirty && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              size="sm"
              className="gap-1.5"
            >
              <Save className="h-3.5 w-3.5" />
              Salvar alterações
            </Button>
          )}
        </CardContent>
      )}
    </Card>
  );
}