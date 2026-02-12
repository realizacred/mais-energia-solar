import { useMemo } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { SidebarSection, MenuItem } from "@/components/admin/sidebar/sidebarConfig";

/**
 * Menu access rules based on existing role system.
 *
 * - "all"        → any authenticated user
 * - "admin_only" → admin, gerente, financeiro (is_admin)
 *
 * Items not listed default to "all".
 * This is a preparatory layer: when RBAC/capabilities are added,
 * only this map needs to change.
 */
const ITEM_ACCESS: Record<string, "all" | "admin_only"> = {
  // ── Financeiro ──
  recebimentos: "admin_only",
  inadimplencia: "admin_only",
  comissoes: "admin_only",

  // ── Cadastros (parâmetros técnicos) ──
  config: "admin_only",
  engenharia: "admin_only",
  financiamento: "admin_only",
  equipamentos: "admin_only",
  modulos: "admin_only",
  "inversores-cadastro": "admin_only",
  baterias: "admin_only",
  concessionarias: "admin_only",

  // ── Administração ──
  usuarios: "admin_only",
  vendedores: "admin_only",
  aprovacao: "admin_only",
  "wa-instances": "admin_only",
  whatsapp: "admin_only",
  instagram: "admin_only",
  solarmarket: "admin_only",
  webhooks: "admin_only",
  n8n: "admin_only",
  "site-config": "admin_only",
  "site-servicos": "admin_only",
  obras: "admin_only",
  "links-instalacao": "admin_only",
  auditoria: "admin_only",
  release: "admin_only",
  "data-reset": "admin_only",

  // ── Operação (itens de configuração) ──
  "lead-status": "admin_only",
  "motivos-perda": "admin_only",
  distribuicao: "admin_only",
  "sla-breaches": "admin_only",
  gamificacao: "admin_only",

  // ── Conversas (config) ──
  "followup-wa": "admin_only",
  "wa-etiquetas": "admin_only",
  "respostas-rapidas": "admin_only",

  // ── Pós-Venda (config) ──
  instaladores: "admin_only",
  validacao: "admin_only",
};

function canAccess(itemId: string, isAdmin: boolean): boolean {
  const rule = ITEM_ACCESS[itemId] ?? "all";
  if (rule === "all") return true;
  return isAdmin;
}

/**
 * Filters sidebar sections based on user role.
 * Returns only sections that have at least one accessible item.
 */
export function useMenuAccess(sections: SidebarSection[]): SidebarSection[] {
  const { isAdmin, loading } = useUserPermissions();

  return useMemo(() => {
    // While loading, show nothing restricted (safe default)
    if (loading) {
      return sections.map((s) => ({
        ...s,
        items: s.items.filter((item) => (ITEM_ACCESS[item.id] ?? "all") === "all"),
      })).filter((s) => s.items.length > 0);
    }

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canAccess(item.id, isAdmin)),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, isAdmin, loading]);
}

/**
 * Check if a single item is accessible.
 * Useful for favorites filtering.
 */
export function useCanAccessItem() {
  const { isAdmin } = useUserPermissions();
  return (itemId: string) => canAccess(itemId, isAdmin);
}
