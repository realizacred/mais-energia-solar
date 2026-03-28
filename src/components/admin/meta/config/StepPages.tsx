import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { META_KEYS, type MetaConfigMap, useSaveMetaKey } from "./useMetaFbConfigs";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StepPagesProps {
  configs: MetaConfigMap;
  onNext: () => void;
  onBack: () => void;
}

interface FbPage {
  id: string;
  name: string;
  category?: string;
  access_token?: string;
}

interface AdAccount {
  id: string;
  name: string;
  account_status?: number;
}

export function StepPages({ configs, onNext, onBack }: StepPagesProps) {
  const accessToken = configs[META_KEYS.accessToken]?.api_key;
  const saveMutation = useSaveMetaKey();

  const [selectedPages, setSelectedPages] = useState<string[]>(() => {
    try {
      return JSON.parse(configs[META_KEYS.selectedPages]?.api_key || "[]");
    } catch { return []; }
  });

  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(() => {
    try {
      return JSON.parse(configs[META_KEYS.selectedAccounts]?.api_key || "[]");
    } catch { return []; }
  });

  const pagesQuery = useQuery({
    queryKey: ["fb-pages", accessToken?.slice(-8)],
    queryFn: async () => {
      if (!accessToken) return [];
      const res = await fetch(`https://graph.facebook.com/v21.0/me/accounts?access_token=${accessToken}&fields=id,name,category`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return (json.data || []) as FbPage[];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!accessToken,
    retry: false,
  });

  const accountsQuery = useQuery({
    queryKey: ["fb-adaccounts", accessToken?.slice(-8)],
    queryFn: async () => {
      if (!accessToken) return [];
      const res = await fetch(`https://graph.facebook.com/v21.0/me/adaccounts?access_token=${accessToken}&fields=id,name,account_status`);
      const json = await res.json();
      if (json.error) throw new Error(json.error.message);
      return (json.data || []) as AdAccount[];
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!accessToken,
    retry: false,
  });

  const togglePage = (id: string) => {
    setSelectedPages(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const toggleAccount = (id: string) => {
    setSelectedAccounts(prev => prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]);
  };

  const handleNext = async () => {
    try {
      await saveMutation.mutateAsync({ serviceKey: META_KEYS.selectedPages, apiKey: JSON.stringify(selectedPages) });
      await saveMutation.mutateAsync({ serviceKey: META_KEYS.selectedAccounts, apiKey: JSON.stringify(selectedAccounts) });
      toast.success("Seleção salva ✅");
      onNext();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const hasPermissionError = pagesQuery.isError || accountsQuery.isError;

  return (
    <div className="space-y-6">
      {/* Pages */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Páginas do Facebook</h3>
        {pagesQuery.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}
        {pagesQuery.isError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Não foi possível listar páginas. Verifique as permissões do token. Você pode continuar mesmo assim.</span>
          </div>
        )}
        {pagesQuery.data && pagesQuery.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma página encontrada para este token.</p>
        )}
        {pagesQuery.data?.map((page) => (
          <label key={page.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
            <Checkbox
              checked={selectedPages.includes(page.id)}
              onCheckedChange={() => togglePage(page.id)}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{page.name}</p>
              {page.category && <p className="text-[11px] text-muted-foreground">{page.category}</p>}
            </div>
            <Badge variant="outline" className="text-[10px]">ID: {page.id}</Badge>
          </label>
        ))}
      </div>

      {/* Ad Accounts */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Contas de Anúncios</h3>
        {accountsQuery.isLoading && (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        )}
        {accountsQuery.isError && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>Não foi possível listar contas. Permissão <code className="bg-muted px-1 rounded text-[11px]">ads_read</code> pode ser necessária.</span>
          </div>
        )}
        {accountsQuery.data && accountsQuery.data.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conta de anúncios encontrada.</p>
        )}
        {accountsQuery.data?.map((acc) => (
          <label key={acc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 cursor-pointer transition-colors">
            <Checkbox
              checked={selectedAccounts.includes(acc.id)}
              onCheckedChange={() => toggleAccount(acc.id)}
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{acc.name || acc.id}</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{acc.id}</Badge>
          </label>
        ))}
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}>Voltar</Button>
        <Button onClick={handleNext} disabled={saveMutation.isPending}>
          {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
          {hasPermissionError ? "Continuar mesmo assim" : "Próximo"}
        </Button>
      </div>
    </div>
  );
}
