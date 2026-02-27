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
import { ScrollArea } from "@/components/ui/scroll-area";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { FormGrid } from "@/components/ui-kit/FormModalTemplate";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Pencil, Trash2, Save, X, User, Phone, Mail, MapPin, Building2, Calendar, CreditCard } from "lucide-react";
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

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-2 text-sm">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <span className="text-muted-foreground">{label}: </span>
        <span className="font-medium">{value}</span>
      </div>
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

  const endereco = [client.address, client.number, client.complement, client.neighborhood]
    .filter(Boolean)
    .join(", ");
  const cidadeEstado = [client.city, client.state].filter(Boolean).join("/");

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {editing ? "Editar Cliente SM" : client.name || "Cliente SM"}
              </DialogTitle>
              <Badge variant="outline" className="text-xs font-mono">
                ID SM: {client.sm_client_id}
              </Badge>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
              <span>Sync: {new Date(client.synced_at).toLocaleDateString("pt-BR")}</span>
              {client.sm_created_at && (
                <span>Criado SM: {format(new Date(client.sm_created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
              )}
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 pb-4">
            <div className="space-y-4 pt-4">
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
                      <Label>Empresa</Label>
                      <Input value={form.company ?? ""} onChange={(e) => set("company", e.target.value)} />
                    </div>
                  </FormGrid>
                  <FormGrid>
                    <div className="space-y-2">
                      <Label>CPF/CNPJ</Label>
                      <Input value={form.document ?? ""} onChange={(e) => set("document", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Telefone Principal</Label>
                      <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
                    </div>
                  </FormGrid>
                  <FormGrid>
                    <div className="space-y-2">
                      <Label>Telefone Secundário</Label>
                      <Input value={form.secondary_phone ?? ""} onChange={(e) => set("secondary_phone", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>CEP</Label>
                      <Input value={form.zip_code ?? ""} onChange={(e) => set("zip_code", e.target.value)} />
                    </div>
                  </FormGrid>
                  <FormGrid>
                    <div className="space-y-2">
                      <Label>Número</Label>
                      <Input value={form.number ?? ""} onChange={(e) => set("number", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Complemento</Label>
                      <Input value={form.complement ?? ""} onChange={(e) => set("complement", e.target.value)} />
                    </div>
                  </FormGrid>
                  <FormGrid>
                    <div className="space-y-2">
                      <Label>Bairro</Label>
                      <Input value={form.neighborhood ?? ""} onChange={(e) => set("neighborhood", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Cidade</Label>
                      <Input value={form.city ?? ""} onChange={(e) => set("city", e.target.value)} />
                    </div>
                  </FormGrid>
                  <div className="space-y-2 max-w-[50%]">
                    <Label>Estado</Label>
                    <Input value={form.state ?? ""} onChange={(e) => set("state", e.target.value)} maxLength={2} />
                  </div>
                </div>
              ) : (
                /* ── View Mode ── */
                <div className="space-y-4">
                  {/* Dados Pessoais */}
                  <SectionCard icon={User} title="Dados do Cliente" variant="blue">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <InfoRow icon={User} label="Nome" value={client.name} />
                      <InfoRow icon={CreditCard} label="CPF/CNPJ" value={client.document} />
                      <InfoRow icon={Mail} label="Email" value={client.email} />
                      <InfoRow icon={Building2} label="Empresa" value={client.company} />
                    </div>
                  </SectionCard>

                  {/* Contato */}
                  <SectionCard icon={Phone} title="Contato" variant="neutral">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <InfoRow icon={Phone} label="Tel. Principal" value={client.phone} />
                      <InfoRow icon={Phone} label="Tel. Secundário" value={client.secondary_phone} />
                    </div>
                  </SectionCard>

                  {/* Endereço */}
                  <SectionCard icon={MapPin} title="Endereço" variant="green">
                    <div className="space-y-2">
                      {endereco && <InfoRow icon={MapPin} label="Endereço" value={endereco} />}
                      {cidadeEstado && <InfoRow icon={MapPin} label="Cidade/UF" value={cidadeEstado} />}
                      <InfoRow icon={MapPin} label="CEP" value={client.zip_code} />
                    </div>
                  </SectionCard>

                  {/* Responsável / Representante */}
                  <SectionCard icon={User} title="Responsável & Representante" variant="neutral">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <InfoRow icon={User} label="Responsável" value={client.responsible?.name} />
                      <InfoRow icon={Mail} label="Email Resp." value={client.responsible?.email} />
                      <InfoRow icon={User} label="Representante" value={client.representative?.name} />
                      <InfoRow icon={Mail} label="Email Repr." value={client.representative?.email} />
                    </div>
                  </SectionCard>

                  {/* Datas */}
                  <SectionCard icon={Calendar} title="Datas" variant="neutral">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <InfoRow
                        icon={Calendar}
                        label="Criado no SM"
                        value={client.sm_created_at ? format(new Date(client.sm_created_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : null}
                      />
                      <InfoRow
                        icon={Calendar}
                        label="Última Sincronização"
                        value={format(new Date(client.synced_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      />
                    </div>
                  </SectionCard>
                </div>
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="gap-2 p-6 pt-2 border-t">
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
