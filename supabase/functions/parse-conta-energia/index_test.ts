import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/parse-conta-energia`;

const ENERGISA_TEXT = `DANF3E - DOCUMENTO AUXILIAR DA NOTA FISCAL DE ENERGIA ELÉTRICA ELETRÔNICA
Av Manoel Inacio Peixoto, 1200 - Distrito Industrial
Cataguases / MG - CEP 36771-000
CNPJ 19.527.639/0001-58       Insc.Est. 153.056023-0000
ENERGISA MINAS RIO - DISTRIBUIDORA DE ENERGIA S.A.
23/03/202621/01/2026 3323/02/2026
BRUNO MARTINS PACHECO SOARES DE PAULA
LIGAÇÃO:BIFASICO
Classificação: MTC-CONVENCIONAL BAIXA TENSÃO / B1
RESIDENCIAL / RESIDENCIAL
Energia Atv Injetada GDI
LANÇAMENTOS E SERVIÇOS
Consumo em kWh
1,068450 -141,03
0,05
0,01
1,08
20,06
194,461,068450 0,817040
0,817040-25,39
0,00
35,00
-141,03
0,00
194,46
-7,80
0,00
10,76
27/02/2026
0001007628-9
Data de Apresentação:
Utilize o Código:
132,00
W7067612237 PontaEnergia ativa em kWh 1 18253185136
W7067612237 PontaEnergia injetada 1 13443330531961
06/03/2026 R$ 74,63Fevereiro / 2026
1/1007628-9 NOTA FISCAL Nº: 006.354.054 - Série: 002
Consumo kWh
PIS/
COFINS (R$)
0,53
2,43
9,61
1,2033
5,5427
18,00
TOTAL: 9,61
23/02/2026Leitura Atual:21/01/2026Leitura Anterior: Dias: 33
DIC
KWH
INJ
Ponta
Ponta
182,005.318,00
1.344,00
182,001,005.136,00
33.305,00 31.961,00 1,00 132,00
999,00 999,00
999,00 999,00
UC com Microgeração classificada como GD_I para faturamento, conforme Lei 14.300/22
Saldo Acumulado: 5.998 A expirar no próximo ciclo: 0
Serviço de distribuição 10,65 14,28 KWH Ponta 5.318,00 5.136,00 1,00 182,00 182,00
Compra de energia 19,19 25,71 INJ Ponta 33.305,00 31.961,00 1,00 1.344,00 132,00
Encargo de Uso do Sistema de Distribuição
(Ref 12/2025): R$ 11,87`;

function round(value: number | null | undefined, decimals = 6) {
  return value == null ? null : Number(value.toFixed(decimals));
}

Deno.test("parse-conta-energia extrai campos críticos da Energisa", async () => {
  const res = await fetch(FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
    body: JSON.stringify({ text: ENERGISA_TEXT }),
  });

  const body = await res.json();

  assertEquals(res.status, 200);
  assertEquals(body.success, true);
  assertEquals(body.data.parser_used, "energisa");
  assertEquals(body.data.consumo_kwh, 182);
  assertEquals(body.data.energia_injetada_kwh, 1344);
  assertEquals(body.data.energia_compensada_kwh, 132);
  assertEquals(body.data.saldo_gd_acumulado, 5998);
  assertEquals(body.data.data_leitura_anterior, "21/01/2026");
  assertEquals(body.data.data_leitura_atual, "23/02/2026");
  assertEquals(body.data.proxima_leitura_data, "23/03/2026");
  assertEquals(body.data.dias_leitura, 33);
  assertEquals(body.data.icms_percentual, 18);
  assertEquals(round(body.data.pis_valor, 2), 0.53);
  assertEquals(round(body.data.cofins_valor, 2), 2.43);
  assertEquals(round(body.data.tarifa_energia_kwh), 1.06845);
  assertEquals(round(body.data.tarifa_fio_b_kwh), 0.81704);
});