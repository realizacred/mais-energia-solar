import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface BrandSettings {
  id: string;
  // Light mode colors
  color_primary: string;
  color_primary_foreground: string;
  color_secondary: string;
  color_secondary_foreground: string;
  color_accent: string;
  color_accent_foreground: string;
  color_background: string;
  color_foreground: string;
  color_card: string;
  color_card_foreground: string;
  color_border: string;
  color_destructive: string;
  color_success: string;
  color_warning: string;
  color_info: string;
  color_muted: string;
  color_muted_foreground: string;
  // Dark mode
  dark_color_primary: string;
  dark_color_background: string;
  dark_color_foreground: string;
  dark_color_card: string;
  dark_color_border: string;
  dark_color_muted: string;
  dark_color_muted_foreground: string;
  // Fonts
  font_heading: string;
  font_body: string;
  font_size_base: string;
  font_weight_heading: string;
  // Logos
  logo_url: string | null;
  logo_small_url: string | null;
  logo_white_url: string | null;
  favicon_url: string | null;
  login_image_url: string | null;
  // Theme
  default_theme: string;
  allow_theme_switch: boolean;
  // Border
  border_radius: string;
}

// Map of CSS variable name -> settings field for light mode
const LIGHT_COLOR_MAP: Record<string, keyof BrandSettings> = {
  "--primary": "color_primary",
  "--primary-foreground": "color_primary_foreground",
  "--secondary": "color_secondary",
  "--secondary-foreground": "color_secondary_foreground",
  "--accent": "color_accent",
  "--accent-foreground": "color_accent_foreground",
  "--background": "color_background",
  "--foreground": "color_foreground",
  "--card": "color_card",
  "--card-foreground": "color_card_foreground",
  "--popover": "color_card",
  "--popover-foreground": "color_card_foreground",
  "--border": "color_border",
  "--input": "color_border",
  "--ring": "color_primary",
  "--destructive": "color_destructive",
  "--success": "color_success",
  "--warning": "color_warning",
  "--info": "color_info",
  "--muted": "color_muted",
  "--muted-foreground": "color_muted_foreground",
  "--brand-orange": "color_primary",
  "--brand-blue": "color_secondary",
  "--sidebar-primary": "color_primary",
  "--sidebar-ring": "color_primary",
};

const DARK_COLOR_MAP: Record<string, keyof BrandSettings> = {
  "--primary": "dark_color_primary",
  "--background": "dark_color_background",
  "--foreground": "dark_color_foreground",
  "--card": "dark_color_card",
  "--popover": "dark_color_card",
  "--card-foreground": "dark_color_foreground",
  "--popover-foreground": "dark_color_foreground",
  "--border": "dark_color_border",
  "--input": "dark_color_border",
  "--ring": "dark_color_primary",
  "--muted": "dark_color_muted",
  "--muted-foreground": "dark_color_muted_foreground",
  "--sidebar-primary": "dark_color_primary",
  "--sidebar-ring": "dark_color_primary",
};

function applySettings(settings: BrandSettings) {
  const root = document.documentElement;

  // Apply light mode colors to :root
  Object.entries(LIGHT_COLOR_MAP).forEach(([cssVar, field]) => {
    const value = settings[field] as string;
    if (value) {
      root.style.setProperty(cssVar, value);
    }
  });

  // Apply dark mode colors via a style element
  let darkStyle = document.getElementById("brand-dark-overrides");
  if (!darkStyle) {
    darkStyle = document.createElement("style");
    darkStyle.id = "brand-dark-overrides";
    document.head.appendChild(darkStyle);
  }

  const darkVars = Object.entries(DARK_COLOR_MAP)
    .map(([cssVar, field]) => {
      const value = settings[field] as string;
      return value ? `  ${cssVar}: ${value};` : "";
    })
    .filter(Boolean)
    .join("\n");

  darkStyle.textContent = `.dark {\n${darkVars}\n}`;

  // Apply fonts
  if (settings.font_body) {
    root.style.setProperty("--font-body", settings.font_body);
    // Load Google Font dynamically
    loadGoogleFont(settings.font_body);
  }
  if (settings.font_heading) {
    root.style.setProperty("--font-heading", settings.font_heading);
    loadGoogleFont(settings.font_heading);
  }

  // Apply border radius
  if (settings.border_radius) {
    root.style.setProperty("--radius", settings.border_radius);
  }

  // Apply favicon
  if (settings.favicon_url) {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) {
      link.href = settings.favicon_url;
    }
  }
}

function loadGoogleFont(fontName: string) {
  const id = `gfont-${fontName.replace(/\s+/g, "-").toLowerCase()}`;
  if (document.getElementById(id)) return;

  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

export function useBrandSettings() {
  const [settings, setSettings] = useState<BrandSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const fetchSettings = useCallback(async () => {
    try {
      // Build query with tenant filter when user is authenticated
      let query = supabase
        .from("brand_settings" as any)
        .select("*");

      if (user) {
        // Authenticated: RLS filters by tenant, but we also need to handle
        // the public SELECT policy that returns all rows
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.tenant_id) {
          query = query.eq("tenant_id", profile.tenant_id);
        }
      } else {
        // Public: get the active tenant's brand settings
        // Filter to only active tenants by joining logic
        const { data: activeTenant } = await supabase
          .from("tenants" as any)
          .select("id")
          .eq("ativo", true)
          .limit(1)
          .maybeSingle() as { data: { id: string } | null };

        if (activeTenant?.id) {
          query = query.eq("tenant_id", activeTenant.id);
        }
      }

      const { data, error } = await query.limit(1).maybeSingle();

      if (error) {
        console.warn("Could not load brand settings:", error.message);
        return;
      }

      if (data) {
        const s = data as unknown as BrandSettings;
        setSettings(s);
        applySettings(s);
      }
    } catch (err) {
      console.warn("Brand settings fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const updateSettings = useCallback(
    async (updates: Partial<BrandSettings>) => {
      if (!settings) return { error: "No settings loaded" };

      const { error } = await supabase
        .from("brand_settings" as any)
        .update(updates as any)
        .eq("id", settings.id);

      if (error) return { error: error.message };

      const newSettings = { ...settings, ...updates } as BrandSettings;
      setSettings(newSettings);
      applySettings(newSettings);
      return { error: null };
    },
    [settings]
  );

  return { settings, loading, updateSettings, refetch: fetchSettings };
}
