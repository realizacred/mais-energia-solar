import { useState, useEffect } from "react";
import { Save, Globe, Phone, MapPin, Type, BarChart3, Palette, Sparkles, Building2, Instagram, Facebook, Linkedin, Youtube } from "lucide-react";
import { InlineLoader } from "@/components/loading/InlineLoader";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractColorsFromImage } from "@/lib/colorExtractor";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import type { Database } from "@/integrations/supabase/types";

type SiteSettings = Database["public"]["Tables"]["site_settings"]["Row"];

export function SiteConfigManager() {
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const { settings: brandSettings, updateSettings: updateBrandSettings } = useBrandSettings();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("site_settings")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      console.warn("Site settings not found:", error.message);
    } else if (data) {
      setSettings(data);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);

    const { id, created_at, updated_at, tenant_id, ...updates } = settings;
    const { error } = await supabase
      .from("site_settings")
      .update(updates)
      .eq("id", settings.id);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!", description: "As alterações foram aplicadas." });
    }
    setSaving(false);
  };

  const handleExtractColors = async () => {
    if (!brandSettings?.logo_url) {
      toast({ title: "Logo não encontrada", description: "Faça upload de uma logo na seção Identidade Visual primeiro.", variant: "destructive" });
      return;
    }
    setExtracting(true);
    try {
      const palette = await extractColorsFromImage(brandSettings.logo_url);
      await updateBrandSettings({
        // Cores Principais
        color_primary: palette.primary,
        color_primary_foreground: palette.primaryForeground,
        color_secondary: palette.secondary,
        color_secondary_foreground: palette.secondaryForeground,
        color_accent: palette.accent,
        color_accent_foreground: palette.accentForeground,
        // Interface
        color_background: palette.background,
        color_foreground: palette.foreground,
        color_card: palette.card,
        color_card_foreground: palette.cardForeground,
        color_border: palette.border,
        color_muted: palette.muted,
        color_muted_foreground: palette.mutedForeground,
        // Status
        color_success: palette.success,
        color_warning: palette.warning,
        color_destructive: palette.destructive,
        color_info: palette.info,
        // Modo Escuro
        dark_color_primary: palette.darkPrimary,
        dark_color_background: palette.darkBackground,
        dark_color_foreground: palette.darkForeground,
        dark_color_card: palette.darkCard,
        dark_color_border: palette.darkBorder,
        dark_color_muted: palette.darkMuted,
        dark_color_muted_foreground: palette.darkMutedForeground,
      });
      toast({ title: "Cores extraídas!", description: "Paleta completa (cores, interface, status e modo escuro) aplicada com base na logo." });
    } catch (err) {
      toast({ title: "Erro na extração", description: "Não foi possível extrair cores da logo.", variant: "destructive" });
    }
    setExtracting(false);
  };

  const update = (field: keyof SiteSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  if (loading) {
    return <InlineLoader context="data_load" />;
  }

  if (!settings) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-muted-foreground">Nenhuma configuração de site encontrada. Execute a migração primeiro.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Configurações do Site</h3>
          <p className="text-sm text-muted-foreground">Gerencie o conteúdo dinâmico do site institucional</p>
        </div>
        <Button onClick={handleSave} disabled={saving} className="gap-2">
          {saving ? <Spinner size="sm" /> : <Save className="w-4 h-4" />}
          Salvar Alterações
        </Button>
      </div>

      <Tabs defaultValue="empresa" className="space-y-4">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="empresa" className="gap-1.5 text-xs">
            <Building2 className="w-3.5 h-3.5" /> Empresa
          </TabsTrigger>
          <TabsTrigger value="contato" className="gap-1.5 text-xs">
            <Phone className="w-3.5 h-3.5" /> Contato
          </TabsTrigger>
          <TabsTrigger value="hero" className="gap-1.5 text-xs">
            <Type className="w-3.5 h-3.5" /> Hero & CTA
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5 text-xs">
            <BarChart3 className="w-3.5 h-3.5" /> Estatísticas
          </TabsTrigger>
          <TabsTrigger value="cores" className="gap-1.5 text-xs">
            <Palette className="w-3.5 h-3.5" /> Cores
          </TabsTrigger>
        </TabsList>

        {/* Empresa */}
        <TabsContent value="empresa">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados da Empresa</CardTitle>
              <CardDescription>Informações institucionais exibidas no site</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nome da Empresa</Label>
                  <Input value={settings.nome_empresa || ""} onChange={(e) => update("nome_empresa", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Slogan</Label>
                  <Input value={settings.slogan || ""} onChange={(e) => update("slogan", e.target.value)} placeholder="Energia solar para todos" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Sobre a empresa (texto completo)</Label>
                <Textarea value={settings.texto_sobre || ""} onChange={(e) => update("texto_sobre", e.target.value)} rows={4} />
              </div>
              <div className="space-y-2">
                <Label>Sobre a empresa (segundo parágrafo)</Label>
                <Textarea value={settings.texto_sobre_resumido || ""} onChange={(e) => update("texto_sobre_resumido", e.target.value)} rows={3} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Meta Title (SEO)</Label>
                  <Input value={settings.meta_title || ""} onChange={(e) => update("meta_title", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Meta Description (SEO)</Label>
                  <Input value={settings.meta_description || ""} onChange={(e) => update("meta_description", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Contato */}
        <TabsContent value="contato">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Contato & Redes Sociais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={settings.telefone || ""} onChange={(e) => update("telefone", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>WhatsApp (só números)</Label>
                  <Input value={settings.whatsapp || ""} onChange={(e) => update("whatsapp", e.target.value)} placeholder="5532998437675" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>E-mail</Label>
                <Input value={settings.email || ""} onChange={(e) => update("email", e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Cidade</Label>
                  <Input value={settings.cidade || ""} onChange={(e) => update("cidade", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <Input value={settings.estado || ""} onChange={(e) => update("estado", e.target.value)} maxLength={2} />
                </div>
                <div className="space-y-2">
                  <Label>Horário de Atendimento</Label>
                  <Input value={settings.horario_atendimento || ""} onChange={(e) => update("horario_atendimento", e.target.value)} placeholder="Seg-Sex 8h-18h" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Endereço completo</Label>
                <Input value={settings.endereco_completo || ""} onChange={(e) => update("endereco_completo", e.target.value)} />
              </div>

              <h4 className="font-semibold text-sm pt-4 border-t">Redes Sociais</h4>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
                  <Input value={settings.instagram_url || ""} onChange={(e) => update("instagram_url", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Facebook className="w-3.5 h-3.5" /> Facebook</Label>
                  <Input value={settings.facebook_url || ""} onChange={(e) => update("facebook_url", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</Label>
                  <Input value={settings.linkedin_url || ""} onChange={(e) => update("linkedin_url", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5"><Youtube className="w-3.5 h-3.5" /> YouTube</Label>
                  <Input value={settings.youtube_url || ""} onChange={(e) => update("youtube_url", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Hero & CTA */}
        <TabsContent value="hero">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Banner Principal (Hero)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Título principal</Label>
                  <Input value={settings.hero_titulo || ""} onChange={(e) => update("hero_titulo", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Textarea value={settings.hero_subtitulo || ""} onChange={(e) => update("hero_subtitulo", e.target.value)} rows={2} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Badge (tag superior)</Label>
                    <Input value={settings.hero_badge_texto || ""} onChange={(e) => update("hero_badge_texto", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Texto do botão CTA</Label>
                    <Input value={settings.hero_cta_texto || ""} onChange={(e) => update("hero_cta_texto", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Texto do botão WhatsApp</Label>
                  <Input value={settings.hero_cta_whatsapp_texto || ""} onChange={(e) => update("hero_cta_whatsapp_texto", e.target.value)} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Seção Financiamento (CTA)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Título</Label>
                  <Input value={settings.cta_titulo || ""} onChange={(e) => update("cta_titulo", e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Subtítulo</Label>
                  <Textarea value={settings.cta_subtitulo || ""} onChange={(e) => update("cta_subtitulo", e.target.value)} rows={2} />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Estatísticas */}
        <TabsContent value="stats">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Estatísticas do Hero</CardTitle>
              <CardDescription>Números exibidos no banner principal</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Anos de experiência</Label>
                  <Input type="number" value={settings.stat_anos_experiencia ?? ""} onChange={(e) => update("stat_anos_experiencia", parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Projetos realizados</Label>
                  <Input type="number" value={settings.stat_projetos_realizados ?? ""} onChange={(e) => update("stat_projetos_realizados", parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Economia (%)</Label>
                  <Input type="number" value={settings.stat_economia_percentual ?? ""} onChange={(e) => update("stat_economia_percentual", parseInt(e.target.value) || 0)} />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Cores */}
        <TabsContent value="cores">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Extração de Cores
              </CardTitle>
              <CardDescription>
                Extraia cores automaticamente da logo da empresa usando Canvas API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {brandSettings?.logo_url && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
                  <img src={brandSettings.logo_url} alt="Logo" className="h-12 w-auto" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Logo atual</p>
                    <p className="text-xs text-muted-foreground">As cores serão extraídas desta imagem</p>
                  </div>
                </div>
              )}
              <Button onClick={handleExtractColors} disabled={extracting} variant="outline" className="gap-2">
                {extracting ? <Spinner size="sm" /> : <Palette className="w-4 h-4" />}
                Extrair Cores da Logo (Canvas)
              </Button>
              <p className="text-xs text-muted-foreground">
                Para refinar as cores manualmente, use a seção <strong>Identidade Visual</strong> no menu de configurações.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
