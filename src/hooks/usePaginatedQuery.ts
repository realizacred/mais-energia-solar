import { useState, useCallback, useMemo, useEffect } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const PAGE_SIZE = 50;

export interface PaginationState {
  page: number;
  pageSize: number;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  isLoading: boolean;
  isFetching: boolean;
  error: Error | null;
  goToPage: (page: number) => void;
  nextPage: () => void;
  prevPage: () => void;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  refetch: () => void;
}

interface UsePaginatedQueryOptions {
  /** Unique query key prefix */
  queryKey: string;
  /** Supabase table name */
  table: string;
  /** Columns to select (default: "*") */
  select?: string;
  /** Page size (default: PAGE_SIZE) */
  pageSize?: number;
  /** Order by column (default: "created_at") */
  orderBy?: string;
  /** Order direction (default: "desc") */
  orderDirection?: "asc" | "desc";
  /** Secondary order column for stable sorting (default: "id") */
  secondaryOrderBy?: string;
  /** Additional eq filters to apply */
  filters?: Record<string, string | number | boolean>;
  /** Search term for text search */
  searchTerm?: string;
  /** Columns to search in */
  searchColumns?: string[];
  /** Whether the query is enabled */
  enabled?: boolean;
}

/**
 * Reusable server-side paginated query hook.
 * Uses offset-based pagination with stable ordering (orderBy + id).
 * Keeps previous data visible during page transitions.
 */
export function usePaginatedQuery<T = Record<string, unknown>>(
  options: UsePaginatedQueryOptions
): PaginatedResult<T> {
  const {
    queryKey,
    table,
    select = "*",
    pageSize = PAGE_SIZE,
    orderBy = "created_at",
    orderDirection = "desc",
    secondaryOrderBy = "id",
    filters = {},
    searchTerm = "",
    searchColumns = [],
    enabled = true,
  } = options;

  const [page, setPage] = useState(1);

  // Reset page when filters/search change
  const filterKey = useMemo(() => JSON.stringify({ filters, searchTerm }), [filters, searchTerm]);

  useEffect(() => {
    setPage(1);
  }, [filterKey]);

  const fetchPage = useCallback(async () => {
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    // Build query manually to avoid deep type instantiation
    let query = supabase
      .from(table as "leads")
      .select(select, { count: "exact" })
      .range(from, to);

    // Apply ordering
    query = query.order(orderBy as "created_at", { ascending: orderDirection === "asc" });
    if (secondaryOrderBy !== orderBy) {
      query = query.order(secondaryOrderBy as "id", { ascending: orderDirection === "asc" });
    }

    // Apply eq filters
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null && value !== "") {
        query = query.eq(key as "id", value as string);
      }
    }

    // Apply text search
    if (searchTerm && searchColumns.length > 0) {
      const searchFilter = searchColumns
        .map((col) => `${col}.ilike.%${searchTerm}%`)
        .join(",");
      query = query.or(searchFilter);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      data: (data || []) as T[],
      totalCount: count || 0,
    };
  }, [table, select, page, pageSize, orderBy, orderDirection, secondaryOrderBy, filters, searchTerm, searchColumns]);

  const {
    data: result,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: [queryKey, page, pageSize, filterKey],
    queryFn: fetchPage,
    placeholderData: keepPreviousData,
    enabled,
    staleTime: 30_000,
  });

  const totalPages = Math.ceil((result?.totalCount || 0) / pageSize);

  const goToPage = useCallback(
    (p: number) => {
      setPage(Math.max(1, Math.min(p, totalPages || 1)));
    },
    [totalPages]
  );

  const nextPage = useCallback(() => goToPage(page + 1), [page, goToPage]);
  const prevPage = useCallback(() => goToPage(page - 1), [page, goToPage]);

  return {
    data: result?.data || [],
    totalCount: result?.totalCount || 0,
    page,
    pageSize,
    totalPages,
    isLoading,
    isFetching,
    error: error as Error | null,
    goToPage,
    nextPage,
    prevPage,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
    refetch,
  };
}
