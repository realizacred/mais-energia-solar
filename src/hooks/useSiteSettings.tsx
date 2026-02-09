import React, { useState, useEffect, useCallback, createContext, useContext } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type SiteSettingsRow = Database["public"]["Tables"]["site_settings"]["Row"];

/** Default fallback values when no DB row exists */
const DEFAULTS: Partial<SiteSettingsRow> = {
  nome_empresa: "Mais Energia Solar",
  slogan: "Energia solar para todos",
  telefone: "(32) 99843-7675",
  whatsapp: "5532998437675",
  email: "contato@maisenergiasolar.com.br",
  cidade: "Cataguases",
  estado: "MG",
  instagram_url: "https://www.instagram.com/maismaisenergiasolaroficial/",
  hero_titulo: "O futuro da energia é agora!",
  hero_subtitulo: "Soluções em energia solar fotovoltaica para residências, comércios, indústrias e propriedades rurais. Projetos personalizados com a melhor tecnologia.",
  hero_badge_texto: "Economia de até 90% na conta de luz",
  hero_cta_texto: "Solicitar Orçamento Grátis",
  hero_cta_whatsapp_texto: "Fale no WhatsApp",
  cta_titulo: "Deseja financiar seu sistema de energia solar?",
  cta_subtitulo: "Envie suas informações que nossa equipe irá fazer uma cotação com as instituições financeiras parceiras e enviar a melhor proposta para você.",
  stat_anos_experiencia: 15,
  stat_projetos_realizados: 500,
  stat_economia_percentual: 90,
  texto_sobre: "A Mais Energia Solar foi fundada em 2009, atuando inicialmente no ramo de reparos em eletrônicos. A partir de 2019, acompanhando as tendências do mercado, passamos a nos especializar em Energia Solar Fotovoltaica, Projetos Elétricos e Soluções Sustentáveis.",
  texto_sobre_resumido: "Hoje, somos referência no desenvolvimento e instalação de sistemas de energia solar e também em bombas solares para irrigação, oferecendo soluções inovadoras para propriedades residenciais, comerciais, industriais e rurais.",
  whatsapp_mensagem_padrao: "Olá! Vi o site de vocês e gostaria de mais informações sobre energia solar.",
} as Partial<SiteSettingsRow>;

interface SiteSettingsContextType {
  settings: SiteSettingsRow | null;
  loading: boolean;
  updateSettings: (updates: Partial<SiteSettingsRow>) => Promise<{ error: string | null }>;
  refetch: () => Promise<void>;
  /** Get a field value with fallback */
  get: <K extends keyof SiteSettingsRow>(key: K) => SiteSettingsRow[K];
}

const SiteSettingsContext = createContext<SiteSettingsContextType | undefined>(undefined);

export function SiteSettingsProvider({ children }: { children: React.ReactNode }) {
  const value = useSiteSettingsInternal();
  return (
    <SiteSettingsContext.Provider value={value}>
      {children}
    </SiteSettingsContext.Provider>
  );
}

export function useSiteSettings() {
  const ctx = useContext(SiteSettingsContext);
  if (!ctx) throw new Error("useSiteSettings must be used within SiteSettingsProvider");
  return ctx;
}

function useSiteSettingsInternal(): SiteSettingsContextType {
  const [settings, setSettings] = useState<SiteSettingsRow | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSettings = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .limit(1)
        .single();

      if (error) {
        console.warn("Could not load site settings:", error.message);
        return;
      }
      if (data) setSettings(data);
    } catch (err) {
      console.warn("Site settings fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const get = useCallback(
    <K extends keyof SiteSettingsRow>(key: K): SiteSettingsRow[K] => {
      if (settings && settings[key] != null) return settings[key];
      return (DEFAULTS as any)[key] ?? ("" as any);
    },
    [settings]
  );

  const updateSettings = useCallback(
    async (updates: Partial<SiteSettingsRow>) => {
      if (!settings) return { error: "No settings loaded" };
      const { error } = await supabase
        .from("site_settings")
        .update(updates)
        .eq("id", settings.id);
      if (error) return { error: error.message };
      setSettings({ ...settings, ...updates } as SiteSettingsRow);
      return { error: null };
    },
    [settings]
  );

  return { settings, loading, updateSettings, refetch: fetchSettings, get };
}
