import { useState, useEffect } from "react";
import { MessageSquare, Loader2, Save } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import {
  getVendedorWaSettings,
  saveVendedorWaSettings,
  DEFAULT_AUTO_MESSAGE_TEMPLATE,
} from "@/lib/waAutoMessage";
import { supabase } from "@/integrations/supabase/client";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface WaAutoMessageToggleProps {
  /** If provided, manages settings for this specific vendedor (admin mode) */
  vendedorId?: string;
  /** Compact mode hides template editor */
  compact?: boolean;
}

/**
 * Toggle + template editor for automatic WhatsApp welcome messages.
 * Persisted in vendedores.settings jsonb.
 */
export function WaAutoMessageToggle({ vendedorId: propVendedorId, compact }: WaAutoMessageToggleProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [template, setTemplate] = useState(DEFAULT_AUTO_MESSAGE_TEMPLATE);
  const [templateDirty, setTemplateDirty] = useState(false);
  const [resolvedVendedorId, setResolvedVendedorId] = useState<string | null>(propVendedorId || null);

  // Resolve vendedorId from user if not provided as prop
  useEffect(() => {
    if (propVendedorId) {
      setResolvedVendedorId(propVendedorId);
      return;
    }
    if (!user) return;

    const resolve = async () => {
      const { data } = await (supabase as any)
        .from("consultores")
        .select("id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .maybeSingle();
      if (data) setResolvedVendedorId(data.id);
    };
    resolve();
  }, [user, propVendedorId]);

  // Load settings from DB
  useEffect(() => {
    if (!resolvedVendedorId) return;
    setLoading(true);
    getVendedorWaSettings(resolvedVendedorId).then((s) => {
      setEnabled(s.wa_auto_message_enabled !== false);
      setTemplate(s.wa_auto_message_template || DEFAULT_AUTO_MESSAGE_TEMPLATE);
      setTemplateDirty(false);
      setLoading(false);
    });
  }, [resolvedVendedorId]);

  const handleToggle = async (checked: boolean) => {
    if (!resolvedVendedorId) return;
    setEnabled(checked);
    const ok = await saveVendedorWaSettings(resolvedVendedorId, { wa_auto_message_enabled: checked });
    if (!ok) {
      toast({ title: "Erro", description: "Não foi possível salvar a preferência.", variant: "destructive" });
      setEnabled(!checked);
    }
  };

  const handleSaveTemplate = async () => {
    if (!resolvedVendedorId) return;
    setSaving(true);
    const ok = await saveVendedorWaSettings(resolvedVendedorId, { wa_auto_message_template: template });
    setSaving(false);
    if (ok) {
      setTemplateDirty(false);
      toast({ title: "Template salvo ✅" });
    } else {
      toast({ title: "Erro ao salvar", variant: "destructive" });
    }
  };

  const handleResetTemplate = () => {
    setTemplate(DEFAULT_AUTO_MESSAGE_TEMPLATE);
    setTemplateDirty(true);
  };

  if (!user || loading) {
    return (
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border animate-pulse">
        <MessageSquare className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="flex-1 h-4 bg-muted rounded" />
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-muted/50 border">
      {/* Toggle row */}
      <div className="flex items-center gap-3 p-3">
        <MessageSquare className="h-4 w-4 text-primary shrink-0" />
        <div className="flex-1 min-w-0">
          <Label htmlFor="wa-auto-msg" className="text-sm font-medium cursor-pointer">
            Mensagem automática ao criar lead
          </Label>
          <p className="text-xs text-muted-foreground">
            Envia uma mensagem profissional de boas-vindas via WhatsApp
          </p>
        </div>
        <Switch
          id="wa-auto-msg"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {/* Template editor (collapsible) */}
      {!compact && enabled && (
        <Collapsible>
          <CollapsibleTrigger className="w-full px-3 pb-2 text-xs text-primary hover:underline cursor-pointer text-left">
            ✏️ Editar template da mensagem
          </CollapsibleTrigger>
          <CollapsibleContent className="px-3 pb-3 space-y-2">
            <Textarea
              value={template}
              onChange={(e) => {
                setTemplate(e.target.value);
                setTemplateDirty(true);
              }}
              rows={8}
              className="text-xs font-mono"
              placeholder="Template da mensagem..."
            />
            <p className="text-[10px] text-muted-foreground">
              Variáveis: {"{nome}"} {"{consultor}"} {"{dados}"} {"{cidade}"} {"{estado}"} {"{consumo}"} {"{tipo_telhado}"}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={handleResetTemplate}
              >
                Restaurar padrão
              </Button>
              {templateDirty && (
                <Button
                  size="sm"
                  className="text-xs gap-1"
                  onClick={handleSaveTemplate}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                  Salvar template
                </Button>
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
