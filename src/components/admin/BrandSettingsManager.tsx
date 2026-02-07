import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Palette,
  Type,
  Image,
  Moon,
  Save,
  Loader2,
  RotateCcw,
  Eye,
  Paintbrush,
  CheckCircle2,
} from "lucide-react";
import { BrandLogoUpload } from "./BrandLogoUpload";
import { useBrandSettings, type BrandSettings } from "@/hooks/useBrandSettings";
import { toast } from "@/hooks/use-toast";

// ─── Color picker helper ────────────────────────────────────
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
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, "0");
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  } catch {
    return "#ff6b00";
  }
}

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "25 100% 50%";

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0,
    s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ─── Color swatch component ────────────────────────────────
function ColorField({
  label,
  hslValue,
  onChange,
}: {
  label: string;
  hslValue: string;
  onChange: (hsl: string) => void;
}) {
  const hex = hslToHex(hslValue);

  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(hexToHsl(e.target.value))}
          className="w-10 h-10 rounded-lg border border-border cursor-pointer appearance-none bg-transparent [&::-webkit-color-swatch]:rounded-md [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch-wrapper]:p-0.5"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{label}</p>
        <p className="text-xs text-muted-foreground font-mono">{hslValue}</p>
      </div>
    </div>
  );
}

// ─── Google Fonts list (popular choices) ────────────────────
const GOOGLE_FONTS = [
  "Inter",
  "Plus Jakarta Sans",
  "Montserrat",
  "Open Sans",
  "Roboto",
  "Poppins",
  "Lato",
  "Raleway",
  "Nunito",
  "DM Sans",
  "Manrope",
  "Space Grotesk",
  "Outfit",
  "Figtree",
  "Sora",
  "Geist",
  "Work Sans",
  "Source Sans 3",
  "IBM Plex Sans",
  "Barlow",
];

// ─── Main component ────────────────────────────────────────
export function BrandSettingsManager() {
  const { settings, loading, updateSettings } = useBrandSettings();
  const [draft, setDraft] = useState<Partial<BrandSettings>>({});
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (settings) {
      setDraft({ ...settings });
    }
  }, [settings]);

  const handleChange = <K extends keyof BrandSettings>(key: K, value: BrandSettings[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const result = await updateSettings(draft);
    setSaving(false);

    if (result.error) {
      toast({ title: "Erro ao salvar", description: result.error, variant: "destructive" });
    } else {
      setHasChanges(false);
      toast({ title: "Identidade visual atualizada!", description: "As alterações foram aplicadas em todo o sistema." });
    }
  };

  const handleReset = () => {
    if (settings) {
      setDraft({ ...settings });
      setHasChanges(false);
    }
  };

  if (loading || !draft.id) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10">
            <Paintbrush className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Centro de Identidade Visual</h2>
            <p className="text-sm text-muted-foreground">
              Configure cores, fontes, logos e temas do sistema
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasChanges && (
            <Badge variant="outline" className="gap-1 text-warning border-warning/30">
              <Eye className="h-3 w-3" />
              Alterações pendentes
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={handleReset} disabled={!hasChanges}>
            <RotateCcw className="h-4 w-4 mr-1.5" />
            Desfazer
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving || !hasChanges} className="gap-1.5">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="colors" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="colors" className="gap-1.5">
            <Palette className="h-4 w-4" />
            Cores
          </TabsTrigger>
          <TabsTrigger value="fonts" className="gap-1.5">
            <Type className="h-4 w-4" />
            Fontes
          </TabsTrigger>
          <TabsTrigger value="logos" className="gap-1.5">
            <Image className="h-4 w-4" />
            Logos
          </TabsTrigger>
          <TabsTrigger value="theme" className="gap-1.5">
            <Moon className="h-4 w-4" />
            Tema
          </TabsTrigger>
        </TabsList>

        {/* ─── Colors Tab ──────────────────────────────────── */}
        <TabsContent value="colors" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Brand Colors */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Cores Principais</CardTitle>
                <CardDescription>Definem a identidade da marca</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField
                  label="Primária (botões, links, destaques)"
                  hslValue={draft.color_primary || ""}
                  onChange={(v) => handleChange("color_primary", v)}
                />
                <ColorField
                  label="Primária (texto sobre primária)"
                  hslValue={draft.color_primary_foreground || ""}
                  onChange={(v) => handleChange("color_primary_foreground", v)}
                />
                <ColorField
                  label="Secundária"
                  hslValue={draft.color_secondary || ""}
                  onChange={(v) => handleChange("color_secondary", v)}
                />
                <ColorField
                  label="Secundária (texto)"
                  hslValue={draft.color_secondary_foreground || ""}
                  onChange={(v) => handleChange("color_secondary_foreground", v)}
                />
              </CardContent>
            </Card>

            {/* UI Colors */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Cores da Interface</CardTitle>
                <CardDescription>Background, cards e bordas</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField
                  label="Background"
                  hslValue={draft.color_background || ""}
                  onChange={(v) => handleChange("color_background", v)}
                />
                <ColorField
                  label="Texto principal"
                  hslValue={draft.color_foreground || ""}
                  onChange={(v) => handleChange("color_foreground", v)}
                />
                <ColorField
                  label="Cards"
                  hslValue={draft.color_card || ""}
                  onChange={(v) => handleChange("color_card", v)}
                />
                <ColorField
                  label="Bordas"
                  hslValue={draft.color_border || ""}
                  onChange={(v) => handleChange("color_border", v)}
                />
                <ColorField
                  label="Muted (backgrounds sutis)"
                  hslValue={draft.color_muted || ""}
                  onChange={(v) => handleChange("color_muted", v)}
                />
                <ColorField
                  label="Muted (texto)"
                  hslValue={draft.color_muted_foreground || ""}
                  onChange={(v) => handleChange("color_muted_foreground", v)}
                />
              </CardContent>
            </Card>

            {/* Status Colors */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Cores de Status</CardTitle>
                <CardDescription>Feedback visual do sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField
                  label="Sucesso"
                  hslValue={draft.color_success || ""}
                  onChange={(v) => handleChange("color_success", v)}
                />
                <ColorField
                  label="Alerta"
                  hslValue={draft.color_warning || ""}
                  onChange={(v) => handleChange("color_warning", v)}
                />
                <ColorField
                  label="Erro / Destrutivo"
                  hslValue={draft.color_destructive || ""}
                  onChange={(v) => handleChange("color_destructive", v)}
                />
                <ColorField
                  label="Informação"
                  hslValue={draft.color_info || ""}
                  onChange={(v) => handleChange("color_info", v)}
                />
              </CardContent>
            </Card>

            {/* Dark Mode Colors */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <Moon className="h-4 w-4" />
                  Cores do Modo Escuro
                </CardTitle>
                <CardDescription>Overrides para o tema escuro</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ColorField
                  label="Primária (escuro)"
                  hslValue={draft.dark_color_primary || ""}
                  onChange={(v) => handleChange("dark_color_primary", v)}
                />
                <ColorField
                  label="Background (escuro)"
                  hslValue={draft.dark_color_background || ""}
                  onChange={(v) => handleChange("dark_color_background", v)}
                />
                <ColorField
                  label="Texto (escuro)"
                  hslValue={draft.dark_color_foreground || ""}
                  onChange={(v) => handleChange("dark_color_foreground", v)}
                />
                <ColorField
                  label="Cards (escuro)"
                  hslValue={draft.dark_color_card || ""}
                  onChange={(v) => handleChange("dark_color_card", v)}
                />
                <ColorField
                  label="Bordas (escuro)"
                  hslValue={draft.dark_color_border || ""}
                  onChange={(v) => handleChange("dark_color_border", v)}
                />
              </CardContent>
            </Card>
          </div>

          {/* Preview */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Preview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                <Button>Botão Primário</Button>
                <Button variant="secondary">Secundário</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="destructive">Destrutivo</Button>
                <Badge>Badge</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
              </div>
              <div className="mt-4 grid grid-cols-4 gap-2">
                {[
                  { label: "Sucesso", color: draft.color_success },
                  { label: "Alerta", color: draft.color_warning },
                  { label: "Erro", color: draft.color_destructive },
                  { label: "Info", color: draft.color_info },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-lg p-3 text-center text-xs font-medium text-white"
                    style={{ backgroundColor: `hsl(${item.color})` }}
                  >
                    {item.label}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Fonts Tab ──────────────────────────────────── */}
        <TabsContent value="fonts" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Tipografia</CardTitle>
                <CardDescription>Escolha as fontes do sistema</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Fonte para títulos</Label>
                  <Select
                    value={draft.font_heading || "Plus Jakarta Sans"}
                    onValueChange={(v) => handleChange("font_heading", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOOGLE_FONTS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Fonte para corpo</Label>
                  <Select
                    value={draft.font_body || "Inter"}
                    onValueChange={(v) => handleChange("font_body", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GOOGLE_FONTS.map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Peso da fonte dos títulos</Label>
                  <Select
                    value={draft.font_weight_heading || "700"}
                    onValueChange={(v) => handleChange("font_weight_heading", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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
                  <Select
                    value={draft.font_size_base || "16px"}
                    onValueChange={(v) => handleChange("font_size_base", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
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

            {/* Font Preview */}
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Preview de Tipografia</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div
                  style={{
                    fontFamily: `"${draft.font_heading}", sans-serif`,
                    fontWeight: parseInt(draft.font_weight_heading || "700"),
                  }}
                >
                  <p className="text-3xl mb-1">Título Principal</p>
                  <p className="text-xl mb-1">Subtítulo da Seção</p>
                  <p className="text-lg">Card Title</p>
                </div>
                <hr className="border-border" />
                <div style={{ fontFamily: `"${draft.font_body}", sans-serif` }}>
                  <p className="text-base mb-2">
                    Este é um exemplo de texto do corpo usando a fonte selecionada. A tipografia
                    consistente é essencial para uma experiência premium.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Texto secundário menor com cor reduzida para hierarquia visual.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Logos Tab ──────────────────────────────────── */}
        <TabsContent value="logos" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Logos</CardTitle>
                <CardDescription>
                  Faça upload das imagens ou cole uma URL externa
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <BrandLogoUpload
                  label="Logo Principal (sidebar, header)"
                  description="Recomendado: PNG ou SVG com fundo transparente, pelo menos 200px de largura"
                  value={draft.logo_url || null}
                  onChange={(url) => handleChange("logo_url", url)}
                  folder="logo"
                  previewHeight="h-12"
                />

                <BrandLogoUpload
                  label="Logo Reduzida (ícone)"
                  description="Versão compacta para sidebar colapsada. Quadrada, pelo menos 48px"
                  value={draft.logo_small_url || null}
                  onChange={(url) => handleChange("logo_small_url", url)}
                  folder="logo-small"
                  previewHeight="h-10"
                />

                <BrandLogoUpload
                  label="Favicon"
                  description="Ícone do navegador. PNG ou ICO, 32x32 ou 64x64"
                  value={draft.favicon_url || null}
                  onChange={(url) => handleChange("favicon_url", url)}
                  folder="favicon"
                  accept="image/png,image/x-icon,image/svg+xml"
                  previewHeight="h-8"
                />

                <BrandLogoUpload
                  label="Imagem da tela de Login"
                  description="Imagem decorativa exibida ao lado do formulário de login"
                  value={draft.login_image_url || null}
                  onChange={(url) => handleChange("login_image_url", url)}
                  folder="login"
                  previewHeight="h-16"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  Onde as logos aparecem
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Sidebar do Admin
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Header do site institucional
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Tela de Login
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Portal do Vendedor
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Portal do Instalador
                  </li>
                  <li className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    Propostas e PDFs (futuro)
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ─── Theme Tab ──────────────────────────────────── */}
        <TabsContent value="theme" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Preferências de Tema</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Tema padrão</Label>
                  <Select
                    value={draft.default_theme || "light"}
                    onValueChange={(v) => handleChange("default_theme", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Claro</SelectItem>
                      <SelectItem value="dark">Escuro</SelectItem>
                      <SelectItem value="system">Automático (sistema)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg border">
                  <div>
                    <Label className="text-base">Permitir troca de tema</Label>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      Usuários podem alternar entre claro e escuro
                    </p>
                  </div>
                  <Switch
                    checked={draft.allow_theme_switch ?? true}
                    onCheckedChange={(v) => handleChange("allow_theme_switch", v)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="text-base">Aparência</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <Label>Arredondamento dos cantos (border-radius)</Label>
                  <Select
                    value={draft.border_radius || "0.625rem"}
                    onValueChange={(v) => handleChange("border_radius", v)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Reto (0)</SelectItem>
                      <SelectItem value="0.25rem">Leve (0.25rem)</SelectItem>
                      <SelectItem value="0.375rem">Sutil (0.375rem)</SelectItem>
                      <SelectItem value="0.5rem">Médio (0.5rem)</SelectItem>
                      <SelectItem value="0.625rem">Padrão (0.625rem)</SelectItem>
                      <SelectItem value="0.75rem">Grande (0.75rem)</SelectItem>
                      <SelectItem value="1rem">Extra (1rem)</SelectItem>
                      <SelectItem value="1.5rem">Pill (1.5rem)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Preview of border radius */}
                <div className="grid grid-cols-3 gap-3">
                  <div
                    className="h-20 bg-primary/10 border border-primary/20 flex items-center justify-center text-xs text-primary font-medium"
                    style={{ borderRadius: draft.border_radius }}
                  >
                    Card
                  </div>
                  <div
                    className="h-20 bg-muted border flex items-center justify-center"
                    style={{ borderRadius: draft.border_radius }}
                  >
                    <Button size="sm" style={{ borderRadius: `calc(${draft.border_radius} - 2px)` }}>
                      Botão
                    </Button>
                  </div>
                  <div
                    className="h-20 bg-muted border flex items-center justify-center"
                    style={{ borderRadius: draft.border_radius }}
                  >
                    <Input placeholder="Input" className="w-20" style={{ borderRadius: `calc(${draft.border_radius} - 4px)` }} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
