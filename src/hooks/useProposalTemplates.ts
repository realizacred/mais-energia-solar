/**
 * Hook para carregar templates de proposta e templates de e-mail/whatsapp.
 * Centraliza queries que antes estavam inline em StepDocumento.tsx.
 * (§16 AGENTS.md — queries devem ficar em src/hooks/)
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PropostaTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  grupo: string;
  categoria: string;
  tipo: string;
  thumbnail_url: string | null;
}

export interface EmailTemplate {
  id: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  corpo_texto: string | null;
  canal: string;
  is_default: boolean;
  ativo: boolean;
  variaveis: any[] | null;
}

export function useProposalTemplates() {
  return useQuery({
    queryKey: ["proposta-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_templates")
        .select("id, nome, descricao, grupo, categoria, tipo, thumbnail_url")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as PropostaTemplate[];
    },
    staleTime: 1000 * 60 * 15,
  });
}

export function useEmailTemplates() {
  return useQuery({
    queryKey: ["proposta-email-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_email_templates" as any)
        .select("id, nome, assunto, corpo_html, corpo_texto, canal, is_default, ativo, variaveis")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return ((data as unknown as EmailTemplate[]) || []);
    },
    staleTime: 1000 * 60 * 15,
  });
}

/**
 * Hook para carregar templates de WhatsApp ativos (canal = 'whatsapp' ou 'ambos')
 */
export function useWhatsAppTemplates() {
  return useQuery({
    queryKey: ["proposta-wa-templates-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposta_email_templates" as any)
        .select("id, nome, corpo_texto, canal, is_default, ativo, variaveis")
        .eq("ativo", true)
        .in("canal", ["whatsapp", "ambos"])
        .order("ordem", { ascending: true });
      if (error) throw error;
      return ((data as unknown as EmailTemplate[]) || []);
    },
    staleTime: 1000 * 60 * 15,
  });
}
