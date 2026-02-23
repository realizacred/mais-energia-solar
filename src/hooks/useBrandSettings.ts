import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
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

// ── CSS Variable Maps ─────────────────────────────────

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

// ── Apply Settings to DOM ─────────────────────────────

function applySettings(settings: BrandSettings) {
  const root = document.documentElement;

  Object.entries(LIGHT_COLOR_MAP).forEach(([cssVar, field]) => {
    const value = settings[field] as string;
    if (value) root.style.setProperty(cssVar, value);
  });

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

  if (settings.font_body) {
    root.style.setProperty("--font-body", settings.font_body);
    loadGoogleFont(settings.font_body);
  }
  if (settings.font_heading) {
    root.style.setProperty("--font-heading", settings.font_heading);
    loadGoogleFont(settings.font_heading);
  }

  if (settings.border_radius) {
    root.style.setProperty("--radius", settings.border_radius);
  }

  if (settings.favicon_url) {
    const link = document.querySelector("link[rel='icon']") as HTMLLinkElement;
    if (link) link.href = settings.favicon_url;
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

// ── localStorage Cache ────────────────────────────────

const CACHE_KEY = "brand-settings-cache";

function getCachedSettings(): BrandSettings | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BrandSettings;
  } catch {
    return null;
  }
}

function setCachedSettings(s: BrandSettings) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(s));
  } catch {
    // localStorage full — ignore
  }
}

// ── Apply cached settings IMMEDIATELY on module load ──
// This ensures brand colors/logo are visible before React renders
const _cachedOnLoad = getCachedSettings();
if (_cachedOnLoad) {
  applySettings(_cachedOnLoad);
}

// ── Hook ──────────────────────────────────────────────

export function useBrandSettings() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const appliedRef = useRef(false);

  // Apply cached settings on first render if not already applied at module level
  const cached = _cachedOnLoad;

  const { data: settings, isLoading } = useQuery({
    queryKey: ["brand-settings", user?.id],
    queryFn: async () => {
      let query = supabase.from("brand_settings" as any).select("id, tenant_id, logo_url, logo_small_url, logo_white_url, favicon_url, login_image_url, color_primary, color_primary_foreground, color_secondary, color_secondary_foreground, color_accent, color_accent_foreground, color_background, color_foreground, color_card, color_card_foreground, color_muted, color_muted_foreground, color_border, color_destructive, color_success, color_warning, color_info, dark_color_primary, dark_color_background, dark_color_foreground, dark_color_card, dark_color_muted, dark_color_muted_foreground, dark_color_border, font_heading, font_body, font_size_base, font_weight_heading, border_radius, default_theme, allow_theme_switch, created_at, updated_at");

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("tenant_id")
          .eq("user_id", user.id)
          .maybeSingle();

        if (profile?.tenant_id) {
          query = query.eq("tenant_id", profile.tenant_id);
        }
      } else {
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
        return null;
      }

      if (data) {
        const s = data as unknown as BrandSettings;
        setCachedSettings(s);
        applySettings(s);
        return s;
      }

      return null;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Use fetched settings, then cached fallback
  const effectiveSettings = settings ?? cached ?? null;

  const updateSettings = useCallback(
    async (updates: Partial<BrandSettings>) => {
      if (!effectiveSettings) return { error: "No settings loaded" };

      const { error } = await supabase
        .from("brand_settings" as any)
        .update(updates as any)
        .eq("id", effectiveSettings.id);

      if (error) return { error: error.message };

      const newSettings = { ...effectiveSettings, ...updates } as BrandSettings;
      applySettings(newSettings);
      setCachedSettings(newSettings);
      queryClient.setQueryData(["brand-settings", user?.id], newSettings);
      return { error: null };
    },
    [effectiveSettings, queryClient, user?.id]
  );

  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["brand-settings"] });
  }, [queryClient]);

  return {
    settings: effectiveSettings,
    loading: isLoading && !effectiveSettings,
    updateSettings,
    refetch,
  };
}
