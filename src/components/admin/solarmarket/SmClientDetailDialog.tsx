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
import { FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Pencil, Trash2, Save, X, User } from "lucide-react";
import type { SmClient } from "@/hooks/useSolarMarket";

interface Props {
  client: SmClient | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, data: Partial<SmClient>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
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
      document: client.document,
      city: client.city,
      state: client.state,
      company: client.company,
    });
    setEditing(true);
  };

  const cancelEdit = () => {
    setEditing(false);
    setForm({});
  };

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
    if (!v) {
      setEditing(false);
      setForm({});
    }
    onOpenChange(v);
  };

  if (!client) return null;

  const set = (key: keyof SmClient, val: string) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {editing ? "Editar Cliente SM" : "Detalhes do Cliente SM"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ID Badge */}
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs font-mono">
                ID SM: {client.sm_client_id}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Sync: {new Date(client.synced_at).toLocaleDateString("pt-BR")}
              </span>
            </div>

            {editing ? (
              /* ── Edit Mode ── */
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
                </div>
                <FormGrid>
                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                  </div>
                </FormGrid>
                <FormGrid>
                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    <Input value={form.document ?? ""} onChange={(e) => set("document", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Empresa</Label>
                    <Input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} />
                  </div>
                </FormGrid>
                <FormGrid>
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} maxLength={2} />
                  </div>
                </FormGrid>
              </div>
            ) : (
              /* ── View Mode ── */
              <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                <span className="text-muted-foreground font-medium">Nome</span>
                <span className="text-foreground">{client.name || "—"}</span>

                <span className="text-muted-foreground font-medium">Email</span>
                <span className="text-foreground">{client.email || "—"}</span>

                <span className="text-muted-foreground font-medium">Telefone</span>
                <span className="text-foreground">{client.phone || "—"}</span>

                <span className="text-muted-foreground font-medium">CPF/CNPJ</span>
                <span className="text-foreground">{client.document || "—"}</span>

                <span className="text-muted-foreground font-medium">Cidade/UF</span>
                <span className="text-foreground">
                  {[client.city, client.state].filter(Boolean).join("/") || "—"}
                </span>

                <span className="text-muted-foreground font-medium">Empresa</span>
                <span className="text-foreground">{client.company || "—"}</span>

                <span className="text-muted-foreground font-medium">Responsável</span>
                <span className="text-foreground">{client.responsible?.name || "—"}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            {editing ? (
              <>
                <Button variant="outline" onClick={cancelEdit} disabled={saving}>
                  <X className="h-4 w-4 mr-1" /> Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Spinner size="sm" className="mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                  Salvar
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                >
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

      {/* Delete Confirmation */}
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
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting && <Spinner size="sm" className="mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
