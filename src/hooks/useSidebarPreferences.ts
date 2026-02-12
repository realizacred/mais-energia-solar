import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STORAGE_KEY = "admin-sidebar-prefs";

interface SidebarPrefs {
  favorites: string[];
  sectionOrder: Record<string, string[]>;
  collapsedSections?: string[];
}

const EMPTY_PREFS: SidebarPrefs = { favorites: [], sectionOrder: {}, collapsedSections: [] };

/* ── localStorage helpers (offline fallback) ── */
function loadLocal(): SidebarPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        sectionOrder: parsed.sectionOrder && typeof parsed.sectionOrder === "object" ? parsed.sectionOrder : {},
        collapsedSections: Array.isArray(parsed.collapsedSections) ? parsed.collapsedSections : [],
      };
    }
  } catch { /* ignore */ }
  return EMPTY_PREFS;
}

function saveLocal(prefs: SidebarPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch { /* ignore */ }
}

/* ── DB helpers ── */
async function loadFromDB(userId: string): Promise<SidebarPrefs | null> {
  try {
    const { data } = await supabase
      .from("profiles")
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle();

    if (data?.settings && typeof data.settings === "object") {
      const s = (data.settings as Record<string, unknown>).sidebar as SidebarPrefs | undefined;
      if (s) return {
        favorites: Array.isArray(s.favorites) ? s.favorites : [],
        sectionOrder: s.sectionOrder && typeof s.sectionOrder === "object" ? s.sectionOrder : {},
        collapsedSections: Array.isArray(s.collapsedSections) ? s.collapsedSections : [],
      };
    }
  } catch { /* ignore */ }
  return null;
}

async function saveToDB(userId: string, prefs: SidebarPrefs) {
  try {
    // Read current settings first to avoid overwriting other keys
    const { data: current } = await supabase
      .from("profiles")
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle();

    const existingSettings = (current?.settings && typeof current.settings === "object")
      ? current.settings as Record<string, unknown>
      : {};

    const newSettings = { ...existingSettings, sidebar: prefs } as unknown as Record<string, unknown>;

    await supabase
      .from("profiles")
      .update({ settings: newSettings as any })
      .eq("user_id", userId);
  } catch { /* ignore - offline fallback still works */ }
}

export function useSidebarPreferences() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<SidebarPrefs>(loadLocal);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initializedRef = useRef(false);

  // Load from DB on mount (merge: DB wins)
  useEffect(() => {
    if (!user?.id || initializedRef.current) return;
    initializedRef.current = true;

    loadFromDB(user.id).then((dbPrefs) => {
      if (dbPrefs && (dbPrefs.favorites.length > 0 || Object.keys(dbPrefs.sectionOrder).length > 0)) {
        setPrefs(dbPrefs);
        saveLocal(dbPrefs);
      }
    });
  }, [user?.id]);

  // Persist on change — localStorage immediately, DB debounced
  useEffect(() => {
    saveLocal(prefs);

    if (!user?.id) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      saveToDB(user.id, prefs);
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [prefs, user?.id]);

  const toggleFavorite = useCallback((itemId: string) => {
    setPrefs((prev) => ({
      ...prev,
      favorites: prev.favorites.includes(itemId)
        ? prev.favorites.filter((id) => id !== itemId)
        : [...prev.favorites, itemId],
    }));
  }, []);

  const isFavorite = useCallback(
    (itemId: string) => prefs.favorites.includes(itemId),
    [prefs.favorites]
  );

  const setSectionOrder = useCallback(
    (sectionLabel: string, orderedIds: string[]) => {
      setPrefs((prev) => ({
        ...prev,
        sectionOrder: { ...prev.sectionOrder, [sectionLabel]: orderedIds },
      }));
    },
    []
  );

  const getSectionOrder = useCallback(
    (sectionLabel: string): string[] | undefined => prefs.sectionOrder[sectionLabel],
    [prefs.sectionOrder]
  );

  return {
    favorites: prefs.favorites,
    toggleFavorite,
    isFavorite,
    setSectionOrder,
    getSectionOrder,
  };
}
