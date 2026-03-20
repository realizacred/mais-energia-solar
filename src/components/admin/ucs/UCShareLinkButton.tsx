/**
 * UCShareLinkButton — Generate and copy shareable link for a UC.
 * Creates a token in uc_client_tokens and copies the public URL.
 */
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link2, Copy, Check, Trash2, ExternalLink, Share2 } from "lucide-react";

interface Props {
  unitId: string;
}

interface ClientToken {
  id: string;
  token: string;
  label: string | null;
  is_active: boolean;
  created_at: string;
  last_accessed_at: string | null;
}

export function UCShareLinkButton({ unitId }: Props) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [copied, setCopied] = useState(false);

  const { data: tokens = [], isLoading } = useQuery({
    queryKey: ["uc_client_tokens", unitId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("uc_client_tokens")
        .select("id, token, label, is_active, created_at, last_accessed_at")
        .eq("unit_id", unitId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as ClientToken[];
    },
    staleTime: 1000 * 60 * 5,
  });

  const createToken = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("uc_client_tokens")
        .insert({ unit_id: unitId, label: "Link do cliente" })
        .select("token")
        .single();
      if (error) throw error;
      return data.token;
    },
    onSuccess: (token) => {
      qc.invalidateQueries({ queryKey: ["uc_client_tokens", unitId] });
      copyToClipboard(token);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao gerar link", description: err.message, variant: "destructive" });
    },
  });

  const deleteToken = useMutation({
    mutationFn: async (tokenId: string) => {
      const { error } = await supabase
        .from("uc_client_tokens")
        .update({ is_active: false })
        .eq("id", tokenId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uc_client_tokens", unitId] });
      toast({ title: "Link desativado" });
    },
  });

  const copyToClipboard = async (token: string) => {
    const url = `${getPublicUrl()}/uc/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Link copiado!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Não foi possível copiar", variant: "destructive" });
    }
  };

  const activeToken = tokens[0];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Portal do Cliente
          </CardTitle>
          {!activeToken && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs gap-1"
              onClick={() => createToken.mutate()}
              disabled={createToken.isPending}
            >
              <Link2 className="w-3.5 h-3.5" />
              {createToken.isPending ? "Gerando..." : "Gerar Link"}
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-10 bg-muted/50 rounded animate-pulse" />
        ) : activeToken ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-muted/30 rounded-lg p-3 border border-border">
              <code className="text-xs text-muted-foreground flex-1 truncate">
                {getPublicUrl()}/uc/{activeToken.token}
              </code>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 shrink-0"
                onClick={() => copyToClipboard(activeToken.token)}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-success" /> : <Copy className="w-3.5 h-3.5" />}
              </Button>
              <a
                href={`${getPublicUrl()}/uc/${activeToken.token}`}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0"
              >
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Button>
              </a>
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Criado em {new Date(activeToken.created_at).toLocaleDateString("pt-BR")}
                {activeToken.last_accessed_at && (
                  <> · Último acesso: {new Date(activeToken.last_accessed_at).toLocaleDateString("pt-BR")}</>
                )}
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-destructive hover:text-destructive gap-1"
                onClick={() => deleteToken.mutate(activeToken.id)}
                disabled={deleteToken.isPending}
              >
                <Trash2 className="w-3 h-3" /> Desativar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Gere um link para compartilhar o relatório de economia desta UC com o cliente. O cliente poderá visualizar faturas e economia sem precisar de login.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
