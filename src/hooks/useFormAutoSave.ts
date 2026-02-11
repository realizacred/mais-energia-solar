import { useEffect, useCallback, useRef, useState } from "react";
import { UseFormReturn, FieldValues, Path } from "react-hook-form";

const STORAGE_PREFIX = "lead_form_draft_";
const DEBOUNCE_MS = 1000;

interface AutoSaveOptions {
  key: string;
  debounceMs?: number;
}

export function useFormAutoSave<T extends FieldValues>(
  form: UseFormReturn<T>,
  options: AutoSaveOptions
) {
  const { key, debounceMs = DEBOUNCE_MS } = options;
  const storageKey = `${STORAGE_PREFIX}${key}`;
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const suppressSaveRef = useRef(false);
  const [hasDraftValue, setHasDraftValue] = useState(false);

  // Check localStorage for existing draft
  const checkHasDraft = useCallback(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed._savedAt && Date.now() - parsed._savedAt < 24 * 60 * 60 * 1000) {
          // Check if draft has any meaningful data
          const data = { ...parsed };
          delete data._savedAt;
          const hasData = Object.values(data).some(
            (v) => v !== undefined && v !== null && v !== "" && v !== 0
          );
          return hasData;
        }
      }
    } catch {
      // ignore
    }
    return false;
  }, [storageKey]);

  // Load saved draft on mount
  useEffect(() => {
    if (isInitializedRef.current) return;
    
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const savedAt = parsed._savedAt;
        const data = { ...parsed };
        delete data._savedAt;
        
        // Only restore if saved within last 24 hours
        if (savedAt && Date.now() - savedAt < 24 * 60 * 60 * 1000) {
          Object.keys(data).forEach((fieldKey) => {
            const value = data[fieldKey];
            if (value !== undefined && value !== null && value !== "") {
              form.setValue(fieldKey as Path<T>, value, { shouldValidate: false });
            }
          });
          console.log("[AutoSave] Draft restored from localStorage");
        } else {
          // Clear expired draft
          localStorage.removeItem(storageKey);
        }
      }
    } catch (error) {
      console.error("[AutoSave] Error loading draft:", error);
    }
    
    isInitializedRef.current = true;
    setHasDraftValue(checkHasDraft());
  }, [form, storageKey, checkHasDraft]);

  // Save draft with debounce
  const saveDraft = useCallback(
    (data: Partial<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        // Skip save if suppressed (after clearDraft)
        if (suppressSaveRef.current) {
          suppressSaveRef.current = false;
          return;
        }

        // Don't save empty drafts
        const hasData = Object.entries(data).some(
          ([k, v]) => k !== "_savedAt" && v !== undefined && v !== null && v !== "" && v !== 0
        );
        if (!hasData) {
          setHasDraftValue(false);
          return;
        }

        try {
          const toSave = {
            ...data,
            _savedAt: Date.now(),
          };
          localStorage.setItem(storageKey, JSON.stringify(toSave));
          console.log("[AutoSave] Draft saved");
          setHasDraftValue(true);
        } catch (error) {
          console.error("[AutoSave] Error saving draft:", error);
        }
      }, debounceMs);
    },
    [storageKey, debounceMs]
  );

  // Watch for changes and auto-save
  useEffect(() => {
    const subscription = form.watch((data) => {
      if (isInitializedRef.current) {
        saveDraft(data as Partial<T>);
      }
    });

    return () => subscription.unsubscribe();
  }, [form, saveDraft]);

  // Clear draft
  const clearDraft = useCallback(() => {
    // Cancel any pending save
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Suppress the next auto-save triggered by form.reset()
    suppressSaveRef.current = true;
    localStorage.removeItem(storageKey);
    setHasDraftValue(false);
    console.log("[AutoSave] Draft cleared");
  }, [storageKey]);

  return { clearDraft, hasDraft: hasDraftValue };
}
