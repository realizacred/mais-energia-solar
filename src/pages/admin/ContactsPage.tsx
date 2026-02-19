import { useState, useMemo, lazy, Suspense } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
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
  ChevronRight,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  onRecall: (contact: Contact) => void;
  onNewContact: () => void;
  selectedId?: string | null;
}

export function ContactsList({ onRecall, onNewContact, selectedId }: ContactsListProps) {
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
              <button
                key={contact.id}
                onClick={() => onRecall(contact)}
                className={`w-full flex items-center gap-3 p-3 text-left transition-colors hover:bg-accent/50 active:bg-accent/70 ${
                  selectedId === contact.id ? "bg-accent/60" : ""
                }`}
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
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
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

/* ====== Contact Details (right pane on desktop) ====== */

function ContactDetails({ contact, onRecall }: { contact: Contact; onRecall: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <span className="text-2xl font-bold text-primary">
          {(contact.name || contact.phone_e164).charAt(0).toUpperCase()}
        </span>
      </div>
      <h2 className="text-lg font-semibold text-foreground mb-1">
        {contact.name || formatPhone(contact.phone_e164)}
      </h2>
      <p className="text-sm text-muted-foreground mb-1 flex items-center gap-1.5">
        <Phone className="h-3.5 w-3.5" />
        {formatPhone(contact.phone_e164)}
      </p>
      {contact.last_interaction_at && (
        <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1.5">
          <Clock className="h-3 w-3" />
          Última interação{" "}
          {formatDistanceToNow(new Date(contact.last_interaction_at), {
            addSuffix: true,
            locale: ptBR,
          })}
        </p>
      )}
      {contact.tags?.length > 0 && (
        <div className="flex gap-1.5 flex-wrap justify-center mb-4">
          {contact.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>
      )}
      <Button onClick={onRecall} className="mt-2">
        <MessageCircle className="h-4 w-4 mr-2" />
        Chamar / Abrir conversa
      </Button>
    </div>
  );
}

function EmptyRightPane() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-6 text-center">
      <div className="p-4 rounded-full bg-muted/50 mb-4">
        <ContactIcon className="h-10 w-10 text-muted-foreground/50" />
      </div>
      <p className="text-sm text-muted-foreground">
        Selecione um contato para ver detalhes
      </p>
    </div>
  );
}

/* ====== Full Page Component ====== */

export default function ContactsPage() {
  const [showRecall, setShowRecall] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [showNew, setShowNew] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const handleRecall = (contact: Contact) => {
    setSelectedContact(contact);
    // On mobile: open dialog immediately. On desktop: just select (user clicks button in detail pane)
    if (window.innerWidth < 768) {
      setShowRecall(true);
    }
  };

  const handleOpenRecallDialog = () => {
    setShowRecall(true);
  };

  const handleSuccess = async (conversationId: string) => {
    await queryClient.invalidateQueries({ queryKey: ["contacts"] });
    await queryClient.invalidateQueries({ queryKey: ["wa-conversations"] });
    navigate(`/app?tab=messages&conversation=${conversationId}`);
  };

  return (
    <div className="h-[calc(100dvh-56px)] md:grid md:grid-cols-[360px_1fr]">
      {/* Left: contacts list (always visible) */}
      <div className="h-full border-r border-border/40 overflow-hidden">
        <ContactsList
          onRecall={handleRecall}
          onNewContact={() => setShowNew(true)}
          selectedId={selectedContact?.id}
        />
      </div>

      {/* Right: detail pane (desktop only) */}
      <div className="hidden md:flex h-full overflow-y-auto">
        {selectedContact ? (
          <ContactDetails contact={selectedContact} onRecall={handleOpenRecallDialog} />
        ) : (
          <EmptyRightPane />
        )}
      </div>

      {/* Recall from contact */}
      <RecallDialog
        open={showRecall}
        onOpenChange={setShowRecall}
        prefillPhone={selectedContact?.phone_e164 || ""}
        prefillName={selectedContact?.name || ""}
        onSuccess={handleSuccess}
      />

      {/* New contact (blank) */}
      <RecallDialog
        open={showNew}
        onOpenChange={setShowNew}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
