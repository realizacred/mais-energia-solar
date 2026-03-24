/**
 * clienteResolution — Canonical helpers for resolving client identity.
 *
 * ARCHITECTURE:
 * - Source of truth: units_consumidoras.cliente_id → clientes
 * - Usina (monitor_plants) herds client via UC: unit_plant_links → UC → cliente_id
 * - GD Group herds client via UC geradora: gd_groups.uc_geradora_id → UC → cliente_id
 * - Contact fallback: UC overrides (email_fatura, telefone_alertas) > clientes fields
 *
 * DEPRECATED (legacy, do NOT use as source of truth):
 * - monitor_plants.client_id — legacy, will be removed in future migration
 * - gd_groups.cliente_id — redundant, resolved via uc_geradora_id
 */
import { supabase } from "@/integrations/supabase/client";

export interface ResolvedContact {
  email: string | null;
  telefone: string | null;
  clienteNome: string | null;
  clienteId: string | null;
}

/**
 * Resolve the canonical client for a UC.
 * Returns cliente_id from units_consumidoras.
 */
export async function resolveClienteFromUC(ucId: string): Promise<string | null> {
  const { data } = await supabase
    .from("units_consumidoras")
    .select("cliente_id")
    .eq("id", ucId)
    .maybeSingle();
  return data?.cliente_id ?? null;
}

/**
 * Resolve the canonical client for a plant (usina).
 * Path: monitor_plants → unit_plant_links → units_consumidoras → cliente_id
 *
 * Falls back to monitor_plants.client_id (legacy) if no UC link exists.
 */
export async function resolveClienteFromPlant(plantId: string): Promise<{
  clienteId: string | null;
  clienteNome: string | null;
  source: "uc" | "legacy" | "none";
}> {
  // Try canonical path via unit_plant_links
  const { data: links } = await supabase
    .from("unit_plant_links" as any)
    .select("unit_id")
    .eq("plant_id", plantId)
    .limit(1);

  const linkList = (links as any[]) || [];
  if (linkList.length > 0) {
    const ucId = linkList[0].unit_id;
    const { data: uc } = await supabase
      .from("units_consumidoras")
      .select("cliente_id")
      .eq("id", ucId)
      .maybeSingle();

    if (uc?.cliente_id) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", uc.cliente_id)
        .maybeSingle();
      return { clienteId: uc.cliente_id, clienteNome: cliente?.nome ?? null, source: "uc" };
    }
  }

  // Legacy fallback: monitor_plants.client_id (deprecated)
  const { data: mp } = await supabase
    .from("monitor_plants" as any)
    .select("client_id")
    .eq("id", plantId)
    .maybeSingle();

  const legacyClientId = (mp as any)?.client_id ?? null;
  if (legacyClientId) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", legacyClientId)
      .maybeSingle();
    return { clienteId: legacyClientId, clienteNome: cliente?.nome ?? null, source: "legacy" };
  }

  return { clienteId: null, clienteNome: null, source: "none" };
}

/**
 * Resolve the canonical client for a GD group.
 * Path: gd_groups.uc_geradora_id → units_consumidoras.cliente_id
 *
 * Falls back to gd_groups.cliente_id (legacy) if UC has no client.
 */
export async function resolveClienteFromGdGroup(gdGroupId: string): Promise<{
  clienteId: string | null;
  clienteNome: string | null;
  source: "uc_geradora" | "legacy" | "none";
}> {
  const { data: group } = await supabase
    .from("gd_groups")
    .select("uc_geradora_id, cliente_id")
    .eq("id", gdGroupId)
    .maybeSingle();

  if (!group) return { clienteId: null, clienteNome: null, source: "none" };

  // Canonical: via UC geradora
  if (group.uc_geradora_id) {
    const clienteId = await resolveClienteFromUC(group.uc_geradora_id);
    if (clienteId) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", clienteId)
        .maybeSingle();
      return { clienteId, clienteNome: cliente?.nome ?? null, source: "uc_geradora" };
    }
  }

  // Legacy fallback
  if (group.cliente_id) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", group.cliente_id)
      .maybeSingle();
    return { clienteId: group.cliente_id, clienteNome: cliente?.nome ?? null, source: "legacy" };
  }

  return { clienteId: null, clienteNome: null, source: "none" };
}

/**
 * Resolve contact info for a UC with canonical fallback:
 * 1. UC.email_fatura → clientes.email
 * 2. UC.telefone_alertas → clientes.telefone
 */
export async function resolveContactFromUC(ucId: string): Promise<ResolvedContact> {
  const { data: uc } = await supabase
    .from("units_consumidoras")
    .select("email_fatura, telefone_alertas, cliente_id")
    .eq("id", ucId)
    .maybeSingle();

  if (!uc) return { email: null, telefone: null, clienteNome: null, clienteId: null };

  let clienteEmail: string | null = null;
  let clienteTelefone: string | null = null;
  let clienteNome: string | null = null;

  if (uc.cliente_id) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome, email, telefone")
      .eq("id", uc.cliente_id)
      .maybeSingle();
    if (cliente) {
      clienteEmail = cliente.email;
      clienteTelefone = cliente.telefone;
      clienteNome = cliente.nome;
    }
  }

  return {
    email: uc.email_fatura || clienteEmail || null,
    telefone: (uc as any).telefone_alertas || clienteTelefone || null,
    clienteNome,
    clienteId: uc.cliente_id ?? null,
  };
}
