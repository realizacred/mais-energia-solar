import { useState, useCallback, useEffect } from "react";

export type OrcamentoSortOption =
  | "recent"
  | "oldest"
  | "name_asc"
  | "name_desc"
  | "orc_desc"
  | "orc_asc"
  | "cli_desc"
  | "cli_asc";

export interface OrcamentoSortConfig {
  value: OrcamentoSortOption;
  label: string;
}

export const ORCAMENTO_SORT_OPTIONS: OrcamentoSortConfig[] = [
  { value: "recent", label: "Mais recentes" },
  { value: "oldest", label: "Mais antigos" },
  { value: "name_asc", label: "Nome (A→Z)" },
  { value: "name_desc", label: "Nome (Z→A)" },
  { value: "orc_desc", label: "ORC (maior→menor)" },
  { value: "orc_asc", label: "ORC (menor→maior)" },
  { value: "cli_desc", label: "CLI (maior→menor)" },
  { value: "cli_asc", label: "CLI (menor→maior)" },
];

const STORAGE_KEY_PREFIX = "orcamento_sort_";

export function useOrcamentoSort(routeKey: string) {
  const storageKey = STORAGE_KEY_PREFIX + routeKey;

  const [sortOption, setSortOption] = useState<OrcamentoSortOption>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved && ORCAMENTO_SORT_OPTIONS.some((o) => o.value === saved)) {
        return saved as OrcamentoSortOption;
      }
    } catch {}
    return "recent";
  });

  const updateSort = useCallback(
    (option: OrcamentoSortOption) => {
      setSortOption(option);
      try {
        localStorage.setItem(storageKey, option);
      } catch {}
    },
    [storageKey]
  );

  return { sortOption, updateSort };
}
