/**
 * useDirtyForm — Reusable dirty state tracking for form sections.
 * Compares current form values against a persisted baseline using normalized comparison.
 * §20: SRP — single responsibility: dirty detection only.
 */
import { useState, useCallback, useMemo, useRef } from "react";

type FormValues = Record<string, unknown>;

/** Normalize a value for comparison: trim strings, coerce numbers, treat null/undefined/"" as equivalent */
function normalize(val: unknown): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "boolean") return val ? "1" : "0";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    const trimmed = val.trim();
    if (trimmed === "") return "";
    // Try to normalize numeric strings: "49,9" → "49.9", then parse
    const asNum = Number(trimmed.replace(",", "."));
    if (!isNaN(asNum) && trimmed.replace(",", ".") === String(asNum)) {
      return String(asNum);
    }
    return trimmed;
  }
  // For objects/arrays, use JSON
  return JSON.stringify(val);
}

function areEqual(a: FormValues, b: FormValues): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    if (normalize(a[key]) !== normalize(b[key])) return false;
  }
  return true;
}

interface UseDirtyFormReturn<T extends FormValues> {
  /** Current form state */
  form: T;
  /** Update form fields (partial) */
  setForm: (updater: Partial<T> | ((prev: T) => T)) => void;
  /** Whether current values differ from baseline */
  isDirty: boolean;
  /** Reset baseline to current form values (call after successful save) */
  commitBaseline: () => void;
  /** Reset baseline AND form to new persisted values (call when props change) */
  resetTo: (values: T) => void;
}

/**
 * Track dirty state for a form section by comparing against a persisted baseline.
 * @param initialValues — the persisted/saved values (baseline)
 */
export function useDirtyForm<T extends FormValues>(initialValues: T): UseDirtyFormReturn<T> {
  const [baseline, setBaseline] = useState<T>(initialValues);
  const [form, setFormRaw] = useState<T>(initialValues);
  const baselineRef = useRef(initialValues);

  const setForm = useCallback((updater: Partial<T> | ((prev: T) => T)) => {
    setFormRaw(prev => {
      if (typeof updater === "function") return updater(prev);
      return { ...prev, ...updater };
    });
  }, []);

  const isDirty = useMemo(() => !areEqual(form, baseline), [form, baseline]);

  const commitBaseline = useCallback(() => {
    setBaseline(prev => {
      // Use current form as new baseline
      setFormRaw(current => {
        baselineRef.current = current;
        return current;
      });
      return baselineRef.current;
    });
    // Simpler: just sync both
    setFormRaw(current => {
      setBaseline(current);
      baselineRef.current = current;
      return current;
    });
  }, []);

  const resetTo = useCallback((values: T) => {
    setBaseline(values);
    setFormRaw(values);
    baselineRef.current = values;
  }, []);

  return { form, setForm, isDirty, commitBaseline, resetTo };
}
