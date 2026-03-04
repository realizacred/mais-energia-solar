import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Save, Loader2, Globe, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { updateContactInfo } from "@/services/contactWhatsAppService";

const ROLE_OPTIONS = [
  { value: "cliente", label: "Cliente", color: "bg-success/10 text-success border-success/20" },
  { value: "fornecedor", label: "Fornecedor", color: "bg-info/10 text-info border-info/20" },
  { value: "funcionario", label: "Funcionário", color: "bg-warning/10 text-warning border-warning/20" },
  { value: "outro", label: "Outro", color: "bg-muted text-muted-foreground border-border" },
];

interface WaContactEditorProps {
  phoneE164: string;
  tenantId?: string;
}

export function WaContactEditor({ phoneE164 }: WaContactEditorProps) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRoles, setEditRoles] = useState<string[]>([]);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["wa-contact-by-phone", phoneE164],
    queryFn: async () => {
      if (!phoneE164) return null;
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, display_name, phone_e164, emails, roles, external_refs, source")
        .eq("phone_e164", phoneE164)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!phoneE164,
    staleTime: 30_000,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!contact?.id) throw new Error("Contato não encontrado");
      await updateContactInfo(contact.id, {
        displayName: editName.trim() || undefined,
        email: editEmail.trim() || undefined,
        roles: editRoles.length > 0 ? editRoles : undefined,
      });
    },
    onSuccess: () => {
      toast.success("Contato atualizado");
      qc.invalidateQueries({ queryKey: ["wa-contact-by-phone", phoneE164] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = () => {
    setEditName(contact?.display_name || contact?.name || "");
    setEditEmail((contact?.emails as any[])?.[0]?.value || "");
    setEditRoles((contact?.roles as string[]) || ["cliente"]);
    setEditing(true);
  };

  const toggleRole = (role: string) => {
    setEditRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  };

  if (isLoading) return null;
  if (!contact) return null;

  const roles = (contact.roles as string[]) || [];
  const googleRef = (contact.external_refs as any)?.google?.resourceName;
  const emails = (contact.emails as any[]) || [];

  if (editing) {
    return (
      <div className="space-y-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/40">
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Editar Contato</p>
          <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => setEditing(false)}>
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="space-y-1">
          <Label className="text-[10px]">Nome</Label>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="h-7 text-xs"
            placeholder="Nome do contato"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px]">E-mail</Label>
          <Input
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            className="h-7 text-xs"
            placeholder="email@exemplo.com"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-[10px]">Tipo do contato</Label>
          <div className="flex flex-wrap gap-1">
            {ROLE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => toggleRole(opt.value)}
                className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  editRoles.includes(opt.value)
                    ? opt.color + " font-medium"
                    : "bg-background text-muted-foreground border-border/40 opacity-50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <Button
          size="sm"
          className="w-full h-7 text-xs gap-1"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
          Salvar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Contato</p>
        <Button size="icon" variant="ghost" className="h-5 w-5" onClick={startEdit}>
          <Pencil className="h-2.5 w-2.5" />
        </Button>
      </div>

      {/* Roles */}
      <div className="flex flex-wrap gap-1">
        {roles.length > 0
          ? roles.map((r) => {
              const opt = ROLE_OPTIONS.find((o) => o.value === r);
              return (
                <Badge key={r} variant="outline" className={`text-[9px] px-1.5 py-0 ${opt?.color || ""}`}>
                  {opt?.label || r}
                </Badge>
              );
            })
          : <span className="text-[10px] text-muted-foreground">Sem tipo definido</span>}
      </div>

      {/* Email */}
      {emails.length > 0 && (
        <p className="text-[10px] text-muted-foreground truncate">
          ✉ {emails[0].value}
        </p>
      )}

      {/* Google sync badge */}
      {googleRef && (
        <div className="flex items-center gap-1 text-[9px] text-success">
          <Globe className="h-2.5 w-2.5" />
          <span>Google: sincronizado</span>
        </div>
      )}
    </div>
  );
}
