import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Tag } from "lucide-react";
import type { WaConversation, WaTag } from "@/hooks/useWaInbox";

// ── Transfer Dialog ───────────────────────────────────
export function WaTransferDialog({
  open,
  onOpenChange,
  onTransfer,
  vendedores,
  currentAssigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onTransfer: (toUserId: string, reason?: string) => Promise<void> | void;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  currentAssigned?: string | null;
}) {
  const [toUser, setToUser] = useState("");
  const [reason, setReason] = useState("");
  const [isTransferring, setIsTransferring] = useState(false);

  // Filter out the currently assigned user
  const availableVendedores = vendedores.filter(
    (v) => v.user_id && v.user_id !== currentAssigned
  );

  const handleSubmit = async () => {
    if (!toUser || isTransferring) return;
    setIsTransferring(true);
    try {
      await onTransfer(toUser, reason || undefined);
      setToUser("");
      setReason("");
      onOpenChange(false);
    } catch (err) {
      console.error("Transfer failed:", err);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isTransferring) onOpenChange(v); }}>
      <DialogContent className="w-[90vw] max-w-md">
        <DialogHeader>
          <DialogTitle>Transferir Conversa</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Transferir para *</Label>
            <Select value={toUser} onValueChange={setToUser}>
              <SelectTrigger><SelectValue placeholder="Selecionar consultor" /></SelectTrigger>
              <SelectContent>
                {availableVendedores.map((v) => (
                  <SelectItem key={v.id} value={v.user_id!}>{v.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Motivo (opcional)</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Motivo da transferência..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isTransferring}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!toUser || isTransferring}>
            {isTransferring ? "Transferindo..." : "Transferir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Assign Dialog ─────────────────────────────────────
export function WaAssignDialog({
  open,
  onOpenChange,
  onAssign,
  vendedores,
  currentAssigned,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onAssign: (userId: string | null) => void;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  currentAssigned: string | null;
}) {
  const [selected, setSelected] = useState(currentAssigned || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>Atribuir Conversa</DialogTitle>
        </DialogHeader>
        <div>
          <Label>Vendedor</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger><SelectValue placeholder="Selecionar..." /></SelectTrigger>
            <SelectContent>
              {vendedores.map((v) => (
                <SelectItem key={v.id} value={v.user_id || v.id}>{v.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button variant="outline" className="border-destructive text-destructive hover:bg-destructive/10" onClick={() => { onAssign(null); onOpenChange(false); }}>
            Remover Atribuição
          </Button>
          <Button onClick={() => { onAssign(selected); onOpenChange(false); }} disabled={!selected}>
            Atribuir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Tags Dialog ───────────────────────────────────────
export function WaTagsDialog({
  open,
  onOpenChange,
  conversation,
  allTags,
  onToggleTag,
  onCreateTag,
  onDeleteTag,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: WaConversation | null;
  allTags: WaTag[];
  onToggleTag: (tagId: string, add: boolean) => void;
  onCreateTag: (tag: { name: string; color: string }) => void;
  onDeleteTag: (tagId: string) => void;
}) {
  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState("#6366f1");

  const activeTagIds = new Set(conversation?.tags?.map((ct) => ct.tag_id) || []);
  const PRESET_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#a855f7", "#ec4899"];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Tag className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Gerenciar Tags
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Crie e gerencie as etiquetas das conversas
            </p>
          </div>
        </DialogHeader>

        {/* Body — scrollable */}
        <div className="p-5 space-y-2 flex-1 min-h-0 overflow-y-auto">
          {allTags.map((tag) => {
            const isActive = activeTagIds.has(tag.id);
            return (
              <div key={tag.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                  <span className="text-sm font-medium text-foreground truncate">{tag.name}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0 overflow-visible">
                  <Switch checked={isActive} onCheckedChange={(checked) => onToggleTag(tag.id, checked)} />
                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive/80" onClick={() => onDeleteTag(tag.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
          {allTags.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Tag className="w-8 h-8 text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Nenhuma tag criada</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Crie uma abaixo para começar</p>
            </div>
          )}
        </div>

        {/* Footer — fixed */}
        <div className="p-4 border-t border-border bg-muted/30 shrink-0 space-y-3">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Criar Nova Tag
          </p>
          <div className="flex items-center gap-2">
            <Input
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Nome da tag"
              className="h-9 text-sm flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTagName.trim()) {
                  onCreateTag({ name: newTagName.trim(), color: newTagColor });
                  setNewTagName("");
                }
              }}
            />
            <Button
              size="sm"
              variant="default"
              className="h-9 px-3"
              disabled={!newTagName.trim()}
              onClick={() => {
                onCreateTag({ name: newTagName.trim(), color: newTagColor });
                setNewTagName("");
              }}
            >
              <Plus className="h-4 w-4 mr-1" />
              Criar
            </Button>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESET_COLORS.map((c) => (
              <Button
                key={c}
                variant="ghost"
                size="icon"
                className={`w-6 h-6 rounded-full p-0 transition-all ${newTagColor === c ? "ring-2 ring-offset-1 ring-offset-background ring-primary" : "hover:ring-1 hover:ring-border"}`}
                style={{ backgroundColor: c }}
                onClick={() => setNewTagColor(c)}
                aria-label={`Cor ${c}`}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Link Lead Dialog ──────────────────────────────────
export function WaLinkLeadDialog({
  open,
  onOpenChange,
  conversation,
  onLink,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: WaConversation | null;
  onLink: (leadId: string | null) => void;
}) {
  const [leadId, setLeadId] = useState(conversation?.lead_id || "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-sm">
        <DialogHeader>
          <DialogTitle>Vincular Lead</DialogTitle>
        </DialogHeader>
        <div>
          <Label>ID do Lead</Label>
          <Input value={leadId} onChange={(e) => setLeadId(e.target.value)} placeholder="UUID do lead..." className="font-mono text-xs" />
          <p className="text-[10px] text-muted-foreground mt-1">
            O sistema tentou vincular automaticamente pelo telefone. Use esta opção para vincular manualmente.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => { onLink(null); onOpenChange(false); }}>Desvincular</Button>
          <Button onClick={() => { onLink(leadId || null); onOpenChange(false); }} disabled={!leadId}>Vincular</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
