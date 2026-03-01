import React, { useState } from "react";
import { FormModalTemplate, FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { connectProvider } from "@/services/monitoring/monitoringService";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function ConnectSolarmanModal({ open, onOpenChange, onSuccess }: Props) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    appId: "",
    appSecret: "",
    email: "",
    password: "",
  });

  const handleChange = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const isValid = form.appId && form.appSecret && form.email && form.password;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const result = await connectProvider("solarman_business", form);
      if (result.success) {
        toast.success("Solarman Business conectado com sucesso!");
        onOpenChange(false);
        onSuccess();
        setForm({ appId: "", appSecret: "", email: "", password: "" });
      } else {
        toast.error(result.error || "Falha na conexão");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro inesperado");
    } finally {
      setSaving(false);
    }
  };

  return (
    <FormModalTemplate
      open={open}
      onOpenChange={onOpenChange}
      title="Conectar Solarman Business"
      submitLabel="Conectar"
      onSubmit={handleSubmit}
      disabled={!isValid}
      saving={saving}
      asForm
    >
      <FormGrid>
        <div className="space-y-1.5">
          <Label htmlFor="sm-appId">App ID</Label>
          <Input
            id="sm-appId"
            placeholder="Ex: 201911067156002"
            value={form.appId}
            onChange={handleChange("appId")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sm-appSecret">App Secret</Label>
          <Input
            id="sm-appSecret"
            type="password"
            placeholder="Seu App Secret"
            value={form.appSecret}
            onChange={handleChange("appSecret")}
          />
        </div>
      </FormGrid>
      <FormGrid>
        <div className="space-y-1.5">
          <Label htmlFor="sm-email">Email</Label>
          <Input
            id="sm-email"
            type="email"
            placeholder="seu@email.com"
            value={form.email}
            onChange={handleChange("email")}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sm-password">Senha</Label>
          <Input
            id="sm-password"
            type="password"
            placeholder="Senha do Solarman"
            value={form.password}
            onChange={handleChange("password")}
          />
        </div>
      </FormGrid>
      <p className="text-2xs text-muted-foreground">
        A senha é usada apenas para autenticação e <strong>não é armazenada</strong>. Apenas o token
        de acesso é salvo no servidor.
      </p>
    </FormModalTemplate>
  );
}
