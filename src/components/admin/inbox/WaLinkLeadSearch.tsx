import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, User, Phone, Mail, Loader2, Link2Off, Zap } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { WaConversation } from "@/hooks/useWaInbox";

interface LeadResult {
  id: string;
  nome: string;
  telefone: string;
  estado: string | null;
  cidade: string | null;
  lead_code: string | null;
  status_id: string | null;
}

interface ClienteResult {
  id: string;
  nome: string;
  telefone: string;
  email: string | null;
  lead_id: string | null;
  cidade: string | null;
}

interface WaLinkLeadSearchProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversation: WaConversation | null;
  onLink: (leadId: string | null) => void;
}

// Strip country code "55" prefix and format for better matching
const stripCountryCode = (phone: string) => {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length >= 12) {
    return digits.substring(2);
  }
  return digits;
};

// Build phone search patterns handling Brazil's 9th digit variation
const buildPhonePatterns = (digits: string): string[] => {
  const patterns = [digits];
  // 11 digits = DDD(2) + 9 + number(8) → also try without the 9
  if (digits.length === 11 && digits[2] === "9") {
    patterns.push(digits.slice(0, 2) + digits.slice(3));
  }
  // 10 digits = DDD(2) + number(8) → also try with the 9
  if (digits.length === 10) {
    patterns.push(digits.slice(0, 2) + "9" + digits.slice(2));
  }
  // Always try last 8 digits as fallback
  if (digits.length >= 8) {
    const last8 = digits.slice(-8);
    if (!patterns.includes(last8)) patterns.push(last8);
  }
  return patterns;
};

export function WaLinkLeadSearch({
  open,
  onOpenChange,
  conversation,
  onLink,
}: WaLinkLeadSearchProps) {
  const initialPhone = stripCountryCode(conversation?.cliente_telefone || "");
  const [search, setSearch] = useState(initialPhone);
  const [tab, setTab] = useState<"leads" | "clientes">("leads");

  // Reset search when dialog opens or conversation changes
  useEffect(() => {
    if (open) {
      setSearch(stripCountryCode(conversation?.cliente_telefone || ""));
    }
  }, [open, conversation?.cliente_telefone]);

  // Search leads
  const { data: leads = [], isLoading: leadsLoading } = useQuery({
    queryKey: ["wa-link-leads", search],
    queryFn: async () => {
      let query = supabase
        .from("leads")
        .select("id, nome, telefone, estado, cidade, lead_code, status_id")
        .limit(20);

      if (search.trim().length >= 2) {
        const digits = search.replace(/\D/g, "");
        
        if (digits.length >= 4) {
          // Build multiple phone patterns to handle 9th digit variations
          const patterns = buildPhonePatterns(digits);
          const phoneFilters = patterns.flatMap((p) => [
            `telefone_normalized.ilike.%${p}%`,
            `telefone.ilike.%${p}%`,
          ]);
          phoneFilters.push(`nome.ilike.%${search}%`);
          query = query.or(phoneFilters.join(","));
        } else {
          query = query.ilike("nome", `%${search}%`);
        }
      }
      // When empty, just return most recent leads

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as LeadResult[];
    },
    enabled: open,
    staleTime: 5 * 1000,
  });

  // Search clients
  const { data: clientes = [], isLoading: clientesLoading } = useQuery({
    queryKey: ["wa-link-clientes", search],
    queryFn: async () => {
      let query = supabase
        .from("clientes")
        .select("id, nome, telefone, email, lead_id, cidade")
        .limit(20);

      if (search.trim().length >= 2) {
        const digits = search.replace(/\D/g, "");

        if (digits.length >= 4) {
          const patterns = buildPhonePatterns(digits);
          const phoneFilters = patterns.map((p) => `telefone.ilike.%${p}%`);
          phoneFilters.push(`nome.ilike.%${search}%`);
          query = query.or(phoneFilters.join(","));
        } else {
          query = query.ilike("nome", `%${search}%`);
        }
      }
      // When empty, return most recent clients

      const { data, error } = await query.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClienteResult[];
    },
    enabled: open,
    staleTime: 5 * 1000,
  });

  const handleSelectLead = (lead: LeadResult) => {
    onLink(lead.id);
    onOpenChange(false);
  };

  const handleSelectCliente = (cliente: ClienteResult) => {
    // Link by lead_id if client has one, otherwise link client id
    const linkId = cliente.lead_id || cliente.id;
    onLink(linkId);
    onOpenChange(false);
  };

  const isLoading = tab === "leads" ? leadsLoading : clientesLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Vincular Lead / Cliente
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nome, telefone ou email..."
              className="pl-9 h-10"
              autoFocus
            />
          </div>

          {/* Tabs */}
          <Tabs value={tab} onValueChange={(v) => setTab(v as "leads" | "clientes")}>
            <TabsList className="w-full">
              <TabsTrigger value="leads" className="flex-1">
                Leads {leads.length > 0 && `(${leads.length})`}
              </TabsTrigger>
              <TabsTrigger value="clientes" className="flex-1">
                Clientes {clientes.length > 0 && `(${clientes.length})`}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="leads" className="mt-2">
              <ScrollArea className="h-[280px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : leads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum lead encontrado.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {leads.map((lead) => (
                      <button
                        key={lead.id}
                        onClick={() => handleSelectLead(lead)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{lead.nome}</span>
                            {lead.lead_code && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">{lead.lead_code}</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {lead.telefone}
                            </span>
                            {lead.estado && <span>{lead.estado}</span>}
                            {lead.cidade && <span>{lead.cidade}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="clientes" className="mt-2">
              <ScrollArea className="h-[280px]">
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  </div>
                ) : clientes.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    Nenhum cliente encontrado.
                  </p>
                ) : (
                  <div className="space-y-1">
                    {clientes.map((cliente) => (
                      <button
                        key={cliente.id}
                        onClick={() => handleSelectCliente(cliente)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left"
                      >
                        <div className="w-9 h-9 rounded-full bg-success/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium truncate block">{cliente.nome}</span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {cliente.telefone}
                            </span>
                            {cliente.email && (
                              <span className="flex items-center gap-1 truncate">
                                <Mail className="h-3 w-3" />
                                {cliente.email}
                              </span>
                            )}
                            {cliente.cidade && <span>{cliente.cidade}</span>}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>

          {/* Current link info */}
          {conversation?.lead_id && (
            <div className="flex items-center justify-between px-2 py-1.5 bg-muted/30 rounded-lg text-xs text-muted-foreground">
              <span>Lead vinculado atualmente: <code className="text-[10px]">{conversation.lead_id.substring(0, 8)}...</code></span>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs text-destructive hover:text-destructive"
                onClick={() => { onLink(null); onOpenChange(false); }}
              >
                <Link2Off className="h-3 w-3 mr-1" />
                Desvincular
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
