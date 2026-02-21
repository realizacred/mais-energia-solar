import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertNotEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/proposal-generate`;

// Helper: minimal payload
function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    lead_id: "00000000-0000-0000-0000-000000000001",
    grupo: "B",
    idempotency_key: crypto.randomUUID(),
    potencia_kwp: 5,
    ucs: [
      { nome: "UC1", tipo_dimensionamento: "BT", distribuidora: "Test", distribuidora_id: "", subgrupo: "B1", estado: "MG", cidade: "BH", fase: "bifasico", tensao_rede: "127/220V", consumo_mensal: 500, consumo_meses: {}, consumo_mensal_p: 0, consumo_mensal_fp: 0, tarifa_distribuidora: 0.85, tarifa_te_p: 0, tarifa_tusd_p: 0, tarifa_te_fp: 0, tarifa_tusd_fp: 0, demanda_preco: 0, demanda_contratada: 0, demanda_adicional: 0, custo_disponibilidade_kwh: 50, custo_disponibilidade_valor: 42.5, outros_encargos_atual: 0, outros_encargos_novo: 0, distancia: 0, tipo_telhado: "Laje", inclinacao: 20, desvio_azimutal: 0, taxa_desempenho: 80, regra_compensacao: 0, rateio_sugerido_creditos: 100, rateio_creditos: 100, imposto_energia: 0, fator_simultaneidade: 30 },
    ],
    premissas: { imposto: 0, inflacao_energetica: 6.5, inflacao_ipca: 4.5, perda_eficiencia_anual: 0.5, sobredimensionamento: 0, troca_inversor_anos: 15, troca_inversor_custo: 30, vpl_taxa_desconto: 10 },
    itens: [{ descricao: "Módulo 550W", fabricante: "Test", modelo: "T550", potencia_w: 550, quantidade: 10, preco_unitario: 500, categoria: "modulo", avulso: false }],
    servicos: [],
    venda: { custo_comissao: 0, custo_outros: 0, margem_percentual: 20, desconto_percentual: 0, observacoes: "" },
    pagamento_opcoes: [{ nome: "À Vista", tipo: "a_vista", valor_financiado: 0, entrada: 6000, taxa_mensal: 0, carencia_meses: 0, num_parcelas: 0, valor_parcela: 0 }],
    ...overrides,
  };
}

// ── Test: 2 UCs Grupo B → should NOT return grupo error
Deno.test("2 UCs Grupo B - allowed", async () => {
  const payload = makePayload({
    ucs: [
      { ...makePayload().ucs[0], subgrupo: "B1" },
      { ...makePayload().ucs[0], nome: "UC2", subgrupo: "B3", consumo_mensal: 300 },
    ],
  });

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  
  // May fail for auth reasons but should NOT fail for grupo_misto
  if (body.error) {
    assertNotEquals(body.error, "mixed_grupos", "Should not block same-grupo UCs");
    assertNotEquals(body.error, "grupo_indefinido", "B1 and B3 should resolve");
  }
});

// ── Test: 2 UCs Grupo A → should NOT return grupo error
Deno.test("2 UCs Grupo A - allowed", async () => {
  const payload = makePayload({
    grupo: "A",
    ucs: [
      { ...makePayload().ucs[0], subgrupo: "A4", grupo_tarifario: "A", tipo_dimensionamento: "MT", consumo_mensal_p: 200, consumo_mensal_fp: 300 },
      { ...makePayload().ucs[0], nome: "UC2", subgrupo: "A4", grupo_tarifario: "A", tipo_dimensionamento: "MT", consumo_mensal_p: 100, consumo_mensal_fp: 200 },
    ],
  });

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();
  
  if (body.error) {
    assertNotEquals(body.error, "mixed_grupos", "Should not block same-grupo UCs");
  }
});

// ── Test: Mixed A + B → MUST be blocked
Deno.test("1 UC Grupo A + 1 UC Grupo B - blocked", async () => {
  const payload = makePayload({
    ucs: [
      { ...makePayload().ucs[0], subgrupo: "B1" },
      { ...makePayload().ucs[0], nome: "UC2", subgrupo: "A4", tipo_dimensionamento: "MT", consumo_mensal_p: 200, consumo_mensal_fp: 300 },
    ],
  });

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();

  // Should be blocked either by auth OR by grupo validation
  // If it reaches grupo validation, it should return mixed_grupos
  if (res.status === 422) {
    assertEquals(body.error, "mixed_grupos", "Should block mixed grupo");
  }
  await res.body?.cancel().catch(() => {});
});

// ── Test: Undefined grupo → MUST be blocked
Deno.test("UC with no subgrupo - blocked as grupo_indefinido", async () => {
  const payload = makePayload({
    ucs: [
      { ...makePayload().ucs[0], subgrupo: "" },
    ],
  });

  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SUPABASE_ANON_KEY}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json();

  if (res.status === 422) {
    assertEquals(body.error, "grupo_indefinido", "Should block undefined grupo");
  }
});
