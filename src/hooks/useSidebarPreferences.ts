import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "admin-sidebar-prefs";

interface SidebarPrefs {
  favorites: string[];
  sectionOrder: Record<string, string[]>;
}

function loadPrefs(): SidebarPrefs {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
        sectionOrder: parsed.sectionOrder && typeof parsed.sectionOrder === "object"
          ? parsed.sectionOrder
          : {},
      };
    }
  } catch {
    // ignore
  }
  return { favorites: [], sectionOrder: {} };
}

function savePrefs(prefs: SidebarPrefs) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function useSidebarPreferences() {
  const [prefs, setPrefs] = useState<SidebarPrefs>(loadPrefs);

  // Persist on change
  useEffect(() => {
    savePrefs(prefs);
  }, [prefs]);

  const toggleFavorite = useCallback((itemId: string) => {
    setPrefs((prev) => {
      const isFav = prev.favorites.includes(itemId);
      return {
        ...prev,
        favorites: isFav
          ? prev.favorites.filter((id) => id !== itemId)
          : [...prev.favorites, itemId],
      };
    });
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
    (sectionLabel: string): string[] | undefined =>
      prefs.sectionOrder[sectionLabel],
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
