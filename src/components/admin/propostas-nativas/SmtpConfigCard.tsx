import { useState, useEffect } from "react";
import { Save, Loader2, Mail, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

export function SmtpConfigCard() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [config, setConfig] = useState({
    host: "",
    port: 587,
    username: "",
    password_encrypted: "",
    from_email: "",
    from_name: "",
    use_tls: true,
    ativo: true,
  });
  const [existingId, setExistingId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("tenant_smtp_config")
      .select("*")
      .maybeSingle();

    if (data) {
      setExistingId(data.id);
      setConfig({
        host: data.host || "",
        port: data.port || 587,
        username: data.username || "",
        password_encrypted: data.password_encrypted || "",
        from_email: data.from_email || "",
        from_name: data.from_name || "",
        use_tls: data.use_tls ?? true,
        ativo: data.ativo ?? true,
      });
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!config.host || !config.username || !config.from_email) {
      toast({ title: "Preencha host, usuário e email de envio", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const payload = { ...config };
      if (existingId) {
        const { error } = await (supabase as any)
          .from("tenant_smtp_config")
          .update(payload)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("tenant_smtp_config")
          .insert(payload);
        if (error) throw error;
      }
      toast({ title: "Configuração SMTP salva!" });
      loadConfig();
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/60">
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Mail className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-semibold">Configuração SMTP</h3>
          <div className="ml-auto flex items-center gap-2">
            <Label className="text-xs">Ativo</Label>
            <Switch
              checked={config.ativo}
              onCheckedChange={(v) => setConfig((c) => ({ ...c, ativo: v }))}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Host SMTP</Label>
            <Input
              value={config.host}
              onChange={(e) => setConfig((c) => ({ ...c, host: e.target.value }))}
              placeholder="smtp.gmail.com"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Porta</Label>
            <Input
              type="number"
              value={config.port}
              onChange={(e) => setConfig((c) => ({ ...c, port: Number(e.target.value) }))}
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Usuário</Label>
            <Input
              value={config.username}
              onChange={(e) => setConfig((c) => ({ ...c, username: e.target.value }))}
              placeholder="email@dominio.com"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Senha</Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={config.password_encrypted}
                onChange={(e) => setConfig((c) => ({ ...c, password_encrypted: e.target.value }))}
                className="h-8 text-xs pr-8"
              />
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-0 top-0 h-8 w-8"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Email de envio</Label>
            <Input
              value={config.from_email}
              onChange={(e) => setConfig((c) => ({ ...c, from_email: e.target.value }))}
              placeholder="propostas@empresa.com"
              className="h-8 text-xs"
            />
          </div>
          <div>
            <Label className="text-xs">Nome do remetente</Label>
            <Input
              value={config.from_name || ""}
              onChange={(e) => setConfig((c) => ({ ...c, from_name: e.target.value }))}
              placeholder="Empresa Solar"
              className="h-8 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={config.use_tls}
            onCheckedChange={(v) => setConfig((c) => ({ ...c, use_tls: v }))}
          />
          <Label className="text-xs">Usar TLS</Label>
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
          Salvar Configuração
        </Button>
      </CardContent>
    </Card>
  );
}
