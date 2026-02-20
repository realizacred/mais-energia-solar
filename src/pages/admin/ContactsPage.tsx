import { useState, useMemo, lazy, Suspense } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  MessageCircle,
  UserPlus,
  Phone,
  Loader2,
  Contact as ContactIcon,
  Clock,
  Save,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { InternalChat } from "@/components/admin/inbox/InternalChat";

interface Contact {
  id: string;
  name: string | null;
  phone_e164: string;
  tags: string[];
  source: string | null;
  linked_cliente_id: string | null;
  last_interaction_at: string | null;
  created_at: string;
}

function formatPhone(e164: string) {
  if (!e164 || e164.length < 12) return e164;
  const ddd = e164.substring(2, 4);
  const num = e164.substring(4);
  if (num.length === 9) return `(${ddd}) ${num.substring(0, 5)}-${num.substring(5)}`;
  return `(${ddd}) ${num.substring(0, 4)}-${num.substring(4)}`;
}

function canonicalizePreview(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  let phone = digits.startsWith("55") ? digits : "55" + digits;
  if (phone.length === 12) {
    phone = phone.substring(0, 4) + "9" + phone.substring(4);
  }
  if (phone.length !== 13) return null;
  return phone;
}

interface ContactsListProps {
  onSelectContact: (contact: Contact) => void;
  onQuickChat: (contact: Contact) => void;
  onNewContact: () => void;
  selectedId?: string | null;
}

export function ContactsList({ onSelectContact, onQuickChat, onNewContact, selectedId }: ContactsListProps) {
  const [search, setSearch] = useState("");

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contacts")
        .select("id, name, phone_e164, tags, source, linked_cliente_id, last_interaction_at, created_at")
        .order("last_interaction_at", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as Contact[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter(
      (c) =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        c.phone_e164.includes(q.replace(/\D/g, ""))
    );
  }, [contacts, search]);

  return (
    <div className="flex flex-col h-full">
      {/* Search + New */}
      <div className="p-3 border-b border-border/40 space-y-2 shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar nome ou telefone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
              autoComplete="off"
              name="contact-search"
            />
          </div>
          <Button size="icon" variant="default" onClick={onNewContact} title="Novo contato">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{contacts.length} contatos</p>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-3 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="p-4 rounded-full bg-muted/50 mb-4">
              <ContactIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {search ? "Nenhum contato encontrado" : "Nenhum contato"}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {search
                ? "Tente outra busca"
                : "Adicione contatos para iniciar conversas"}
            </p>
            {!search && (
              <Button size="sm" variant="outline" onClick={onNewContact}>
                <UserPlus className="h-4 w-4 mr-1" />
                Adicionar contato
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map((contact) => (
              <div
                key={contact.id}
                className={`flex items-center gap-3 p-3 transition-colors hover:bg-accent/50 ${
                  selectedId === contact.id ? "bg-accent/60" : ""
                }`}
              >
                {/* Clickable area → open detail/edit */}
                <button
                  onClick={() => onSelectContact(contact)}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-primary">
                      {(contact.name || contact.phone_e164).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {contact.name || formatPhone(contact.phone_e164)}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Phone className="h-3 w-3 shrink-0" />
                      <span className="truncate">{formatPhone(contact.phone_e164)}</span>
                      {contact.last_interaction_at && (
                        <>
                          <span className="text-border">·</span>
                          <Clock className="h-3 w-3 shrink-0" />
                          <span className="truncate">
                            {formatDistanceToNow(new Date(contact.last_interaction_at), {
                              addSuffix: true,
                              locale: ptBR,
                            })}
                          </span>
                        </>
                      )}
                    </div>
                    {contact.tags?.length > 0 && (
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {contact.tags.slice(0, 3).map((tag) => (
                          <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </button>

                {/* Quick WhatsApp chat button */}
                <button
                  onClick={(e) => { e.stopPropagation(); onQuickChat(contact); }}
                  className="shrink-0 h-9 w-9 rounded-full bg-success/10 hover:bg-success/20 flex items-center justify-center transition-colors"
                  title="Abrir conversa"
                >
                  <MessageCircle className="h-4 w-4 text-success" />
                </button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}

/* ====== New/Recall Dialog ====== */

interface RecallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prefillPhone?: string;
  prefillName?: string;
  onSuccess: (conversationId: string) => void;
}

export function RecallDialog({
  open,
  onOpenChange,
  prefillPhone = "",
  prefillName = "",
  onSuccess,
}: RecallDialogProps) {
  const [phone, setPhone] = useState(prefillPhone);
  const [name, setName] = useState(prefillName);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Reset on open
  const handleOpenChange = (v: boolean) => {
    if (v) {
      setPhone(prefillPhone);
      setName(prefillName);
      setMessage("");
    }
    onOpenChange(v);
  };

  const phonePreview = canonicalizePreview(phone);
  const isValid = !!phonePreview;

  const handleSubmit = async () => {
    if (!isValid) return;
    setLoading(true);
    try {
      const params: Record<string, unknown> = { p_phone_raw: phone.trim() };
      if (name.trim()) params.p_name_optional = name.trim();
      if (message.trim()) params.p_message_optional = message.trim();

      const { data, error } = await (supabase.rpc as any)(
        "rpc_recall_or_start_conversation",
        params
      );
      if (error) throw error;

      const result = data as { conversation_id: string; reused: boolean };
      toast({
        title: result.reused ? "Conversa reaberta" : "Nova conversa criada",
      });
      onSuccess(result.conversation_id);
      handleOpenChange(false);
    } catch (err: any) {
      toast({
        title: "Erro",
        description: err.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-success" />
            {prefillPhone ? "Chamar cliente" : "Nova conversa"}
          </DialogTitle>
          <DialogDescription>
            Abra ou reabra uma conversa. Se já existir, será reutilizada.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="recall-phone">Telefone *</Label>
            <Input
              id="recall-phone"
              placeholder="(11) 99999-9999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading || !!prefillPhone}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="recall-phone-input"
            />
            {phone.length >= 10 && (
              <p className={`text-xs ${isValid ? "text-success" : "text-destructive"}`}>
                {isValid
                  ? `✓ Normalizado: +${phonePreview}`
                  : "✗ Formato inválido — use DDD + número"}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="recall-name">Nome (opcional)</Label>
            <Input
              id="recall-name"
              placeholder="Nome do contato"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={loading}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="recall-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="recall-msg">Mensagem inicial (opcional)</Label>
            <Textarea
              id="recall-msg"
              placeholder="Olá! Gostaria de..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              disabled={loading}
              className="min-h-[80px]"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              name="recall-message-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading || !isValid}>
            {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            {prefillPhone ? "Chamar" : "Iniciar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ====== Contact Edit Dialog ====== */

function ContactEditDialog({
  contact,
  open,
  onOpenChange,
  onChat,
  onUpdated,
}: {
  contact: Contact | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onChat: () => void;
  onUpdated?: () => void;
}) {
  const [editName, setEditName] = useState("");
  const [editTags, setEditTags] = useState("");
  const { toast } = useToast();

  const handleOpenChange = (v: boolean) => {
    if (v && contact) {
      setEditName(contact.name || "");
      setEditTags((contact.tags || []).join(", "));
    }
    onOpenChange(v);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!contact) return;
      const tags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      const { error } = await supabase
        .from("contacts")
        .update({ name: editName.trim() || null, tags })
        .eq("id", contact.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Contato atualizado" });
      onUpdated?.();
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  if (!contact) return null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Editar contato</DialogTitle>
          <DialogDescription>Atualize as informações do contato.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <span className="text-lg font-bold text-primary">
                {(contact.name || contact.phone_e164).charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">
                {formatPhone(contact.phone_e164)}
              </p>
              {contact.last_interaction_at && (
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Última interação{" "}
                  {formatDistanceToNow(new Date(contact.last_interaction_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-name">Nome</Label>
            <Input
              id="contact-name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Nome do contato"
              name="contact-edit-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact-tags">Tags</Label>
            <Input
              id="contact-tags"
              value={editTags}
              onChange={(e) => setEditTags(e.target.value)}
              placeholder="cliente, vip, indicação (separadas por vírgula)"
              name="contact-edit-tags"
            />
            <p className="text-xs text-muted-foreground">Separe as tags por vírgula</p>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onChat}
            className="gap-2 text-success border-success/30 hover:bg-success/10"
          >
            <MessageCircle className="h-4 w-4" />
            Conversar
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


interface ContactsPageProps {
  onOpenConversation?: (conversationId: string) => void;
}

export default function ContactsPage({ onOpenConversation }: ContactsPageProps) {
  const [showRecall, setShowRecall] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showDetail, setShowDetail] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleSelectContact = (contact: Contact) => {
    setSelectedContact(contact);
    setShowDetail(true);
  };

  const handleQuickChat = (contact: Contact) => {
    setSelectedContact(contact);
    setShowRecall(true);
  };

  const handleOpenRecallDialog = () => {
    setShowRecall(true);
  };

  const navigate = useNavigate();

  const handleSuccess = async (conversationId: string) => {
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    await queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
    setShowDetail(false);
    if (onOpenConversation) {
      onOpenConversation(conversationId);
    } else {
      navigate(`/admin/inbox?conversation=${conversationId}`);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <Tabs defaultValue="clients" className="flex flex-col h-full">
        <div className="shrink-0 border-b border-border/40 px-3 pt-2">
          <TabsList className="w-full grid grid-cols-2 h-9">
            <TabsTrigger value="clients" className="text-xs">👤 Clientes</TabsTrigger>
            <TabsTrigger value="team" className="text-xs">🏢 Equipe</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="team" className="flex-1 min-h-0 m-0" style={{ height: "calc(100% - 52px)" }}>
          <div className="h-full">
            <InternalChat />
          </div>
        </TabsContent>

        <TabsContent value="clients" className="flex-1 min-h-0 m-0">
          <div className="h-full">
            <ContactsList
              onSelectContact={handleSelectContact}
              onQuickChat={handleQuickChat}
              onNewContact={() => setShowNew(true)}
              selectedId={selectedContact?.id}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* Edit contact dialog */}
      <ContactEditDialog
        contact={selectedContact}
        open={showDetail}
        onOpenChange={setShowDetail}
        onChat={() => { setShowDetail(false); handleOpenRecallDialog(); }}
        onUpdated={() => queryClient.invalidateQueries({ queryKey: ["contacts"] })}
      />

      <RecallDialog
        open={showRecall}
        onOpenChange={setShowRecall}
        prefillPhone={selectedContact?.phone_e164 || ""}
        prefillName={selectedContact?.name || ""}
        onSuccess={handleSuccess}
      />

      <RecallDialog
        open={showNew}
        onOpenChange={setShowNew}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
