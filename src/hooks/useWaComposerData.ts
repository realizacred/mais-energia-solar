import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface QuickReplyDb {
  id: string;
  titulo: string;
  conteudo: string;
  emoji: string | null;
  categoria: string | null;
  media_url: string | null;
  media_type: string | null;
  media_filename: string | null;
  ativo: boolean;
}

export interface QrCategory {
  id: string;
  nome: string;
  slug: string;
  cor: string;
  emoji: string | null;
}

export function useWaComposerData() {
  const { data: writingAssistantEnabled } = useQuery({
    queryKey: ["writing-assistant-enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_ai_settings")
        .select("templates")
        .maybeSingle();
      const templates = data?.templates as Record<string, any> | null;
      return templates?.writing_assistant?.enabled !== false;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: quickReplies = [] } = useQuery({
    queryKey: ["wa-quick-replies-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_quick_replies")
        .select("id, titulo, conteudo, categoria, emoji, media_url, media_type, media_filename, ordem, ativo")
        .eq("ativo", true)
        .order("ordem", { ascending: true })
        .order("titulo", { ascending: true });
      if (error) throw error;
      return data as QuickReplyDb[];
    },
    staleTime: 60 * 1000,
  });

  const { data: dbCategories = [] } = useQuery({
    queryKey: ["wa-qr-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_quick_reply_categories")
        .select("id, nome, slug, cor, emoji, ordem, ativo")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return data as QrCategory[];
    },
    staleTime: 60 * 1000,
  });

  return {
    writingAssistantEnabled: writingAssistantEnabled !== false,
    quickReplies,
    dbCategories,
  };
}
