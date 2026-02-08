import { useState, useEffect } from "react";
import {
  Save, Globe, Phone, Building2, Type, BarChart3, Palette,
  Loader2, Sparkles, Instagram, Facebook, Linkedin, Youtube,
  Image as ImageIcon, Moon, Paintbrush, RotateCcw, Eye, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { extractColorsFromImage } from "@/lib/colorExtractor";
import { useBrandSettings, type BrandSettings } from "@/hooks/useBrandSettings";
import { BrandLogoUpload } from "./BrandLogoUpload";
import { SiteBannersManager } from "./SiteBannersManager";
import type { Database } from "@/integrations/supabase/types";

type SiteSettings = Database["public"]["Tables"]["site_settings"]["Row"];

// ─── HSL ↔ Hex helpers ──────────────────────────────────────
function hslToHex(hslStr: string): string {
  try {
    const parts = hslStr.trim().split(/\s+/);
    const h = parseFloat(parts[0]) || 0;
    const s = (parseFloat(parts[1]) || 0) / 100;
    const l = (parseFloat(parts[2]) || 0) / 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color).toString(16).padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch { return "#ff6b00"; }
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "25 100% 50%";
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function ColorField({ label, hslValue, onChange }: { label: string; hslValue: string; onChange: (hsl: string) => void }) {
  const hex = hslToHex(hslValue);
  return (
    <div className="flex items-center gap-3">
      <input
        type="color"
        value={hex}
        onChange={(e) => onChange(hexToHsl(e.target.value))}
        className="w-10 h-10 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0.5"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground font-mono">{hslValue}</p>
      </div>
    </div>
  );
}

const GOOGLE_FONTS = [
  "Inter", "Plus Jakarta Sans", "Montserrat", "Open Sans", "Roboto", "Poppins",
  "Lato", "Raleway", "Nunito", "DM Sans", "Manrope", "Space Grotesk",
  "Outfit", "Figtree", "Sora", "Geist", "Work Sans", "Source Sans 3",
  "IBM Plex Sans", "Barlow",
];

export function SiteSettingsUnified() {
  // ─── Site settings state ──────────────────────────────────
  const [siteSettings, setSiteSettings] = useState<SiteSettings | null>(null);
  const [loadingSite, setLoadingSite] = useState(true);
  const [savingSite, setSavingSite] = useState(false);

  // ─── Brand settings state ─────────────────────────────────
  const { settings: brandSettings, loading: loadingBrand, updateSettings: updateBrandSettings } = useBrandSettings();
  const [brandDraft, setBrandDraft] = useState<Partial<BrandSettings>>({});
  const [brandHasChanges, setBrandHasChanges] = useState(false);
  const [savingBrand, setSavingBrand] = useState(false);
  const [extracting, setExtracting] = useState(false);

  // Fetch site settings
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("site_settings")
        .select("*")
        .limit(1)
        .single();
      if (!error && data) setSiteSettings(data);
      setLoadingSite(false);
    })();
  }, []);

  // Sync brand draft
  useEffect(() => {
    if (brandSettings) setBrandDraft({ ...brandSettings });
  }, [brandSettings]);

  // ─── Handlers ─────────────────────────────────────────────
  const updateSite = (field: keyof SiteSettings, value: any) => {
    if (!siteSettings) return;
    setSiteSettings({ ...siteSettings, [field]: value });
  };

  const saveSite = async () => {
    if (!siteSettings) return;
    setSavingSite(true);
    const { id, created_at, updated_at, tenant_id, ...updates } = siteSettings;
    const { error } = await supabase.from("site_settings").update(updates).eq("id", siteSettings.id);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Configurações salvas!" });
    }
    setSavingSite(false);
  };

  const handleBrandChange = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => {
    setBrandDraft((prev) => ({ ...prev, [key]: value }));
    setBrandHasChanges(true);
  };

  const saveBrand = async () => {
    setSavingBrand(true);
    const result = await updateBrandSettings(brandDraft);
    setSavingBrand(false);
    if (result.error) {
      toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" });
    } else {
      setBrandHasChanges(false);
      toast({ title: "Identidade visual atualizada!" });
    }
  };

  const resetBrand = () => {
    if (brandSettings) { setBrandDraft({ ...brandSettings }); setBrandHasChanges(false); }
  };

  const handleExtractColors = async () => {
    const logoUrl = brandDraft.logo_url || brandSettings?.logo_url;
    if (!logoUrl) {
      toast({ title: "Logo não encontrada", description: "Faça upload de uma logo na aba Logos primeiro.", variant: "destructive" });
      return;
    }
    setExtracting(true);
    try {
      const palette = await extractColorsFromImage(logoUrl);
      const updates = {
        color_primary: palette.primary,
        color_primary_foreground: palette.primaryForeground,
        color_secondary: palette.secondary,
        color_secondary_foreground: palette.secondaryForeground,
        color_accent: palette.accent,
      };
      await updateBrandSettings(updates);
      setBrandDraft((prev) => ({ ...prev, ...updates }));
      toast({ title: "Cores extraídas!", description: "Paleta aplicada com base na logo." });
    } catch (err) {
      console.error("Color extraction error:", err);
      toast({ title: "Erro na extração", description: "Não foi possível extrair cores da logo. Verifique se a imagem é acessível.", variant: "destructive" });
    }
    setExtracting(false);
  };

  // ─── Loading ──────────────────────────────────────────────
  if (loadingSite || loadingBrand) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Paintbrush className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Configurações do Site</h2>
            <p className="text-sm text-muted-foreground">Conteúdo, visual, banners e identidade da marca</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {brandHasChanges && (
            <Badge variant="outline" className="gap-1 text-warning border-warning/30">
              <Eye className="h-3 w-3" /> Alterações visuais pendentes
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={resetBrand} disabled={!brandHasChanges}>
            <RotateCcw className="h-4 w-4 mr-1.5" /> Desfazer Visual
          </Button>
          <Button size="sm" onClick={saveBrand} disabled={savingBrand || !brandHasChanges} className="gap-1.5">
            {savingBrand ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Visual
          </Button>
          <Button size="sm" onClick={saveSite} disabled={savingSite} className="gap-1.5" variant="secondary">
            {savingSite ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar Conteúdo
          </Button>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="empresa" className="space-y-4">
        <TabsList className="flex flex-wrap h-auto gap-1 bg-muted/50 p-1.5 rounded-xl">
          <TabsTrigger value="empresa" className="gap-1.5 text-xs rounded-lg">
            <Building2 className="w-3.5 h-3.5" /> Empresa
          </TabsTrigger>
          <TabsTrigger value="contato" className="gap-1.5 text-xs rounded-lg">
            <Phone className="w-3.5 h-3.5" /> Contato
          </TabsTrigger>
          <TabsTrigger value="hero" className="gap-1.5 text-xs rounded-lg">
            <Type className="w-3.5 h-3.5" /> Hero & CTA
          </TabsTrigger>
          <TabsTrigger value="banners" className="gap-1.5 text-xs rounded-lg">
            <ImageIcon className="w-3.5 h-3.5" /> Banners
          </TabsTrigger>
          <TabsTrigger value="cores" className="gap-1.5 text-xs rounded-lg">
            <Palette className="w-3.5 h-3.5" /> Cores
          </TabsTrigger>
          <TabsTrigger value="fontes" className="gap-1.5 text-xs rounded-lg">
            <Type className="w-3.5 h-3.5" /> Fontes
          </TabsTrigger>
          <TabsTrigger value="logos" className="gap-1.5 text-xs rounded-lg">
            <ImageIcon className="w-3.5 h-3.5" /> Logos
          </TabsTrigger>
          <TabsTrigger value="tema" className="gap-1.5 text-xs rounded-lg">
            <Moon className="w-3.5 h-3.5" /> Tema
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-1.5 text-xs rounded-lg">
            <BarChart3 className="w-3.5 h-3.5" /> Estatísticas
          </TabsTrigger>
        </TabsList>

        {/* ═══ EMPRESA ═══ */}
        <TabsContent value="empresa">
          {siteSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Dados da Empresa</CardTitle>
                <CardDescription>Informações institucionais exibidas no site</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome da Empresa</Label>
                    <Input value={siteSettings.nome_empresa || ""} onChange={(e) => updateSite("nome_empresa", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Slogan</Label>
                    <Input value={siteSettings.slogan || ""} onChange={(e) => updateSite("slogan", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Sobre a empresa (texto completo)</Label>
                  <Textarea value={siteSettings.texto_sobre || ""} onChange={(e) => updateSite("texto_sobre", e.target.value)} rows={4} />
                </div>
                <div className="space-y-2">
                  <Label>Sobre a empresa (segundo parágrafo)</Label>
                  <Textarea value={siteSettings.texto_sobre_resumido || ""} onChange={(e) => updateSite("texto_sobre_resumido", e.target.value)} rows={3} />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Meta Title (SEO)</Label>
                    <Input value={siteSettings.meta_title || ""} onChange={(e) => updateSite("meta_title", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Meta Description (SEO)</Label>
                    <Input value={siteSettings.meta_description || ""} onChange={(e) => updateSite("meta_description", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ CONTATO ═══ */}
        <TabsContent value="contato">
          {siteSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Contato & Redes Sociais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input value={siteSettings.telefone || ""} onChange={(e) => updateSite("telefone", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>WhatsApp (só números)</Label>
                    <Input value={siteSettings.whatsapp || ""} onChange={(e) => updateSite("whatsapp", e.target.value)} placeholder="5532998437675" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={siteSettings.email || ""} onChange={(e) => updateSite("email", e.target.value)} />
                </div>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Cidade</Label>
                    <Input value={siteSettings.cidade || ""} onChange={(e) => updateSite("cidade", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Estado</Label>
                    <Input value={siteSettings.estado || ""} onChange={(e) => updateSite("estado", e.target.value)} maxLength={2} />
                  </div>
                  <div className="space-y-2">
                    <Label>Horário de Atendimento</Label>
                    <Input value={siteSettings.horario_atendimento || ""} onChange={(e) => updateSite("horario_atendimento", e.target.value)} placeholder="Seg-Sex 8h-18h" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Endereço completo</Label>
                  <Input value={siteSettings.endereco_completo || ""} onChange={(e) => updateSite("endereco_completo", e.target.value)} />
                </div>
                <h4 className="font-semibold text-sm pt-4 border-t">Redes Sociais</h4>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Instagram className="w-3.5 h-3.5" /> Instagram</Label>
                    <Input value={siteSettings.instagram_url || ""} onChange={(e) => updateSite("instagram_url", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Facebook className="w-3.5 h-3.5" /> Facebook</Label>
                    <Input value={siteSettings.facebook_url || ""} onChange={(e) => updateSite("facebook_url", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Linkedin className="w-3.5 h-3.5" /> LinkedIn</Label>
                    <Input value={siteSettings.linkedin_url || ""} onChange={(e) => updateSite("linkedin_url", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="flex items-center gap-1.5"><Youtube className="w-3.5 h-3.5" /> YouTube</Label>
                    <Input value={siteSettings.youtube_url || ""} onChange={(e) => updateSite("youtube_url", e.target.value)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══ HERO & CTA ═══ */}
        <TabsContent value="hero">
          {siteSettings && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Banner Principal (Hero)</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>Título principal</Label>
                    <Input value={siteSettings.hero_titulo || ""} onChange={(e) => updateSite("hero_titulo", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Textarea value={siteSettings.hero_subtitulo || ""} onChange={(e) => updateSite("hero_subtitulo", e.target.value)} rows={2} />
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Badge (tag superior)</Label>
                      <Input value={siteSettings.hero_badge_texto || ""} onChange={(e) => updateSite("hero_badge_texto", e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Texto do botão CTA</Label>
                      <Input value={siteSettings.hero_cta_texto || ""} onChange={(e) => updateSite("hero_cta_texto", e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Texto do botão WhatsApp</Label>
                    <Input value={siteSettings.hero_cta_whatsapp_texto || ""} onChange={(e) => updateSite("hero_cta_whatsapp_texto", e.target.value)} />
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
                    <Input value={siteSettings.cta_titulo || ""} onChange={(e) => updateSite("cta_titulo", e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Subtítulo</Label>
                    <Textarea value={siteSettings.cta_subtitulo || ""} onChange={(e) => updateSite("cta_subtitulo", e.target.value)} rows={2} />
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* ═══ BANNERS ═══ */}
        <TabsContent value="banners">
          <SiteBannersManager />
        </TabsContent>

        {/* ═══ CORES ═══ */}
        <TabsContent value="cores" className="space-y-6">
          {/* Color extraction */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" /> Extração Automática
              </CardTitle>
              <CardDescription>Extraia as cores automaticamente da logo da empresa</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {brandDraft.logo_url && (
                <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/50 border">
                  <img src={brandDraft.logo_url} alt="Logo" className="h-12 w-auto" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Logo atual</p>
                    <p className="text-xs text-muted-foreground">As cores serão extraídas desta imagem</p>
                  </div>
                </div>
              )}
              <Button onClick={handleExtractColors} disabled={extracting} variant="outline" className="gap-2">
                {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Palette className="w-4 h-4" />}
                Extrair Cores da Logo
              </Button>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Cores Principais</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField label="Primária" hslValue={brandDraft.color_primary || ""} onChange={(v) => handleBrandChange("color_primary", v)} />
                <ColorField label="Primária (texto)" hslValue={brandDraft.color_primary_foreground || ""} onChange={(v) => handleBrandChange("color_primary_foreground", v)} />
                <ColorField label="Secundária" hslValue={brandDraft.color_secondary || ""} onChange={(v) => handleBrandChange("color_secondary", v)} />
                <ColorField label="Secundária (texto)" hslValue={brandDraft.color_secondary_foreground || ""} onChange={(v) => handleBrandChange("color_secondary_foreground", v)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Interface</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField label="Background" hslValue={brandDraft.color_background || ""} onChange={(v) => handleBrandChange("color_background", v)} />
                <ColorField label="Texto" hslValue={brandDraft.color_foreground || ""} onChange={(v) => handleBrandChange("color_foreground", v)} />
                <ColorField label="Cards" hslValue={brandDraft.color_card || ""} onChange={(v) => handleBrandChange("color_card", v)} />
                <ColorField label="Bordas" hslValue={brandDraft.color_border || ""} onChange={(v) => handleBrandChange("color_border", v)} />
                <ColorField label="Muted" hslValue={brandDraft.color_muted || ""} onChange={(v) => handleBrandChange("color_muted", v)} />
                <ColorField label="Muted (texto)" hslValue={brandDraft.color_muted_foreground || ""} onChange={(v) => handleBrandChange("color_muted_foreground", v)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField label="Sucesso" hslValue={brandDraft.color_success || ""} onChange={(v) => handleBrandChange("color_success", v)} />
                <ColorField label="Alerta" hslValue={brandDraft.color_warning || ""} onChange={(v) => handleBrandChange("color_warning", v)} />
                <ColorField label="Erro" hslValue={brandDraft.color_destructive || ""} onChange={(v) => handleBrandChange("color_destructive", v)} />
                <ColorField label="Info" hslValue={brandDraft.color_info || ""} onChange={(v) => handleBrandChange("color_info", v)} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2"><Moon className="h-4 w-4" /> Modo Escuro</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField label="Primária" hslValue={brandDraft.dark_color_primary || ""} onChange={(v) => handleBrandChange("dark_color_primary", v)} />
                <ColorField label="Background" hslValue={brandDraft.dark_color_background || ""} onChange={(v) => handleBrandChange("dark_color_background", v)} />
                <ColorField label="Texto" hslValue={brandDraft.dark_color_foreground || ""} onChange={(v) => handleBrandChange("dark_color_foreground", v)} />
                <ColorField label="Cards" hslValue={brandDraft.dark_color_card || ""} onChange={(v) => handleBrandChange("dark_color_card", v)} />
                <ColorField label="Bordas" hslValue={brandDraft.dark_color_border || ""} onChange={(v) => handleBrandChange("dark_color_border", v)} />
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2"><Eye className="h-4 w-4" /> Preview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button>Primário</Button>
                <Button variant="secondary">Secundário</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="destructive">Destrutivo</Button>
                <Badge>Badge</Badge>
                <Badge variant="secondary">Secondary</Badge>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { label: "Sucesso", color: brandDraft.color_success },
                  { label: "Alerta", color: brandDraft.color_warning },
                  { label: "Erro", color: brandDraft.color_destructive },
                  { label: "Info", color: brandDraft.color_info },
                ].map((item) => (
                  <div key={item.label} className="rounded-lg p-3 text-center text-xs font-medium text-white" style={{ backgroundColor: `hsl(${item.color})` }}>
                    {item.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══ FONTES ═══ */}
        <TabsContent value="fontes" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Tipografia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Fonte para títulos</Label>
                  <Select value={brandDraft.font_heading || "Plus Jakarta Sans"} onValueChange={(v) => handleBrandChange("font_heading", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{GOOGLE_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Fonte para corpo</Label>
                  <Select value={brandDraft.font_body || "Inter"} onValueChange={(v) => handleBrandChange("font_body", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{GOOGLE_FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Peso dos títulos</Label>
                  <Select value={brandDraft.font_weight_heading || "700"} onValueChange={(v) => handleBrandChange("font_weight_heading", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="500">Medium (500)</SelectItem>
                      <SelectItem value="600">Semi-Bold (600)</SelectItem>
                      <SelectItem value="700">Bold (700)</SelectItem>
                      <SelectItem value="800">Extra-Bold (800)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tamanho base</Label>
                  <Select value={brandDraft.font_size_base || "16px"} onValueChange={(v) => handleBrandChange("font_size_base", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="14px">14px (Compacto)</SelectItem>
                      <SelectItem value="15px">15px</SelectItem>
                      <SelectItem value="16px">16px (Padrão)</SelectItem>
                      <SelectItem value="17px">17px</SelectItem>
                      <SelectItem value="18px">18px (Grande)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Preview de Tipografia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div style={{ fontFamily: `"${brandDraft.font_heading}", sans-serif`, fontWeight: parseInt(brandDraft.font_weight_heading || "700") }}>
                  <p className="text-3xl mb-1">Título Principal</p>
                  <p className="text-xl mb-1">Subtítulo da Seção</p>
                  <p className="text-lg">Card Title</p>
                </div>
                <hr className="border-border" />
                <div style={{ fontFamily: `"${brandDraft.font_body}", sans-serif` }}>
                  <p className="text-base mb-2">Este é um exemplo de texto usando a fonte selecionada.</p>
                  <p className="text-sm text-muted-foreground">Texto secundário com cor reduzida.</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ LOGOS ═══ */}
        <TabsContent value="logos" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Logos</CardTitle>
                <CardDescription>Upload ou cole uma URL externa</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <BrandLogoUpload label="Logo Principal" description="PNG/SVG com fundo transparente, pelo menos 200px" value={brandDraft.logo_url || null} onChange={(url) => handleBrandChange("logo_url", url)} folder="logo" previewHeight="h-12" />
                <BrandLogoUpload label="Logo Reduzida (ícone)" description="Versão compacta quadrada, 48px+" value={brandDraft.logo_small_url || null} onChange={(url) => handleBrandChange("logo_small_url", url)} folder="logo-small" previewHeight="h-10" />
                <BrandLogoUpload label="Logo Branca (fundos escuros)" description="Versão branca para footer e áreas escuras" value={brandDraft.logo_white_url || null} onChange={(url) => handleBrandChange("logo_white_url", url)} folder="logo-white" previewHeight="h-12" />
                <BrandLogoUpload label="Favicon" description="PNG ou ICO, 32x32 ou 64x64" value={brandDraft.favicon_url || null} onChange={(url) => handleBrandChange("favicon_url", url)} folder="favicon" accept="image/png,image/x-icon,image/svg+xml" previewHeight="h-8" />
                <BrandLogoUpload label="Imagem do Login" description="Imagem decorativa exibida na tela de login" value={brandDraft.login_image_url || null} onChange={(url) => handleBrandChange("login_image_url", url)} folder="login" previewHeight="h-16" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" /> Onde aparecem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {["Sidebar do Admin", "Header do site", "Footer (logo branca)", "Tela de Login", "Portal do Vendedor", "Portal do Instalador", "Propostas e PDFs (futuro)"].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {item}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ TEMA ═══ */}
        <TabsContent value="tema" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Preferências de Tema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Tema padrão</Label>
                  <Select value={brandDraft.default_theme || "light"} onValueChange={(v) => handleBrandChange("default_theme", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Escuro</SelectItem>
                      <SelectItem value="system">Automático</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label className="text-base">Permitir troca de tema</Label>
                    <p className="text-sm text-muted-foreground mt-0.5">Usuários podem alternar entre claro e escuro</p>
                  </div>
                  <Switch checked={brandDraft.allow_theme_switch ?? true} onCheckedChange={(v) => handleBrandChange("allow_theme_switch", v)} />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Aparência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Arredondamento (border-radius)</Label>
                  <Select value={brandDraft.border_radius || "0.625rem"} onValueChange={(v) => handleBrandChange("border_radius", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Reto (0)</SelectItem>
                      <SelectItem value="0.25rem">Leve</SelectItem>
                      <SelectItem value="0.375rem">Sutil</SelectItem>
                      <SelectItem value="0.5rem">Médio</SelectItem>
                      <SelectItem value="0.625rem">Padrão</SelectItem>
                      <SelectItem value="0.75rem">Grande</SelectItem>
                      <SelectItem value="1rem">Extra</SelectItem>
                      <SelectItem value="1.5rem">Pill</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {["Card", "Botão", "Input"].map((label) => (
                    <div key={label} className="h-20 bg-primary/10 border border-primary/20 flex items-center justify-center text-xs text-primary font-medium" style={{ borderRadius: brandDraft.border_radius }}>
                      {label}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ═══ ESTATÍSTICAS ═══ */}
        <TabsContent value="stats">
          {siteSettings && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Estatísticas do Hero</CardTitle>
                <CardDescription>Números exibidos no banner principal</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Anos de experiência</Label>
                    <Input type="number" value={siteSettings.stat_anos_experiencia ?? ""} onChange={(e) => updateSite("stat_anos_experiencia", parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Projetos realizados</Label>
                    <Input type="number" value={siteSettings.stat_projetos_realizados ?? ""} onChange={(e) => updateSite("stat_projetos_realizados", parseInt(e.target.value) || 0)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Economia (%)</Label>
                    <Input type="number" value={siteSettings.stat_economia_percentual ?? ""} onChange={(e) => updateSite("stat_economia_percentual", parseInt(e.target.value) || 0)} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
