import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Pencil, Trash2, Save, X } from "lucide-react";
import type { SmClient } from "@/hooks/useSolarMarket";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  client: SmClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<SmClient>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <p className="text-sm font-medium text-foreground min-h-[20px]">{value || "—"}</p>
    </div>
  );
}

export function SmClientDetailDialog({ client, open, onOpenChange, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<Partial<SmClient>>({});

  const startEdit = () => {
    if (!client) return;
    setForm({
      name: client.name,
      email: client.email,
      phone: client.phone,
      secondary_phone: client.secondary_phone,
      document: client.document,
      zip_code: client.zip_code,
      number: client.number,
      complement: client.complement,
      neighborhood: client.neighborhood,
      city: client.city,
      state: client.state,
      company: client.company,
    });
    setEditing(true);
  };

  const cancelEdit = () => { setEditing(false); setForm({}); };

  const handleSave = async () => {
    if (!client) return;
    setSaving(true);
    try {
      await onSave(client.id, form);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!client) return;
    setDeleting(true);
    try {
      await onDelete(client.id);
      setConfirmDelete(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) { setEditing(false); setForm({}); }
    onOpenChange(v);
  };

  if (!client) return null;

  const set = (key: keyof SmClient, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const endereco = [client.address, client.number, client.complement, client.neighborhood]
    .filter(Boolean).join(", ");
  const cidadeEstado = [client.city, client.state].filter(Boolean).join("/");

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[calc(100dvh-2rem)] flex flex-col p-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-base">
                {editing ? "Editar Cliente SM" : client.name || "Cliente SM"}
              </DialogTitle>
              <Badge variant="outline" className="text-[10px] font-mono">
                ID {client.sm_client_id}
              </Badge>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            {editing ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Nome *</Label>
                  <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Nome do cliente" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Telefone *</Label>
                    <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="(00) 00000-0000" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Tel. Secundário</Label>
                    <Input value={form.secondary_phone ?? ""} onChange={(e) => set("secondary_phone", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Email</Label>
                    <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="email@exemplo.com" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">CPF/CNPJ</Label>
                    <Input value={form.document ?? ""} onChange={(e) => set("document", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Empresa</Label>
                  <Input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} />
                </div>

                <hr className="border-border" />

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">CEP</Label>
                    <Input value={form.zip_code ?? ""} onChange={(e) => set("zip_code", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Número</Label>
                    <Input value={form.number ?? ""} onChange={(e) => set("number", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Bairro</Label>
                    <Input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Complemento</Label>
                    <Input value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Cidade</Label>
                    <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Estado</Label>
                    <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} maxLength={2} />
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {/* Dados do Cliente */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Dados do Cliente</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Nome" value={client.name} />
                    <Field label="CPF/CNPJ" value={client.document} />
                    <Field label="Email" value={client.email} />
                    <Field label="Empresa" value={client.company} />
                  </div>
                </div>

                <hr className="border-border" />

                {/* Contato */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contato</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Tel. Principal" value={client.phone} />
                    <Field label="Tel. Secundário" value={client.secondary_phone} />
                  </div>
                </div>

                <hr className="border-border" />

                {/* Endereço */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Endereço</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Endereço" value={endereco || null} />
                    <Field label="Cidade/UF" value={cidadeEstado || null} />
                    <Field label="CEP" value={client.zip_code} />
                  </div>
                </div>

                <hr className="border-border" />

                {/* Responsável */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Responsável & Representante</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Responsável" value={client.responsible?.name} />
                    <Field label="Email Resp." value={client.responsible?.email} />
                    <Field label="Representante" value={client.representative?.name} />
                    <Field label="Email Repr." value={client.representative?.email} />
                  </div>
                </div>

                <hr className="border-border" />

                {/* Datas */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Datas</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Criado no SM"
                      value={client.sm_created_at ? format(new Date(client.sm_created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null}
                    />
                    <Field
                      label="Última Sincronização"
                      value={format(new Date(client.synced_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex-col-reverse sm:flex-row gap-2 px-6 py-4 border-t">
            {editing ? (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>Cancelar</Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner size="sm" className="mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="h-4 w-4 mr-1" /> Excluir
                </Button>
                <Button variant="outline" onClick={startEdit}>
                  <Pencil className="h-4 w-4 mr-1" /> Editar
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir cliente?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{client.name}</strong>? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleting && <Spinner size="sm" className="mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
