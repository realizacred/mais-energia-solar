import { supabase } from "@/integrations/supabase/client";

export interface EmailTemplate {
  id: string;
  nome: string;
  assunto: string;
  corpo_html: string;
  corpo_texto: string | null;
  canal: string;
  is_default: boolean;
  ativo: boolean;
  ordem: number;
  variaveis: any[] | null;
}

export const emailTemplateService = {
  async fetchAll(): Promise<EmailTemplate[]> {
    const { data, error } = await (supabase as any)
      .from("proposta_email_templates")
      .select("id, nome, assunto, corpo_html, corpo_texto, canal, is_default, ativo, ordem, variaveis")
      .order("ordem", { ascending: true });
    if (error) throw error;
    return (data ?? []) as EmailTemplate[];
  },

  async save(id: string | undefined, data: Record<string, any>) {
    if (id) {
      const { error } = await (supabase as any)
        .from("proposta_email_templates")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    } else {
      const { error } = await (supabase as any)
        .from("proposta_email_templates")
        .insert(data);
      if (error) throw error;
    }
  },

  async delete(id: string) {
    const { error } = await (supabase as any)
      .from("proposta_email_templates")
      .delete()
      .eq("id", id);
    if (error) throw error;
  },

  async duplicate(payload: Record<string, any>) {
    const { error } = await (supabase as any)
      .from("proposta_email_templates")
      .insert(payload);
    if (error) throw error;
  }
};
