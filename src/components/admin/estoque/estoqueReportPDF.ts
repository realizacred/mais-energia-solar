// jsPDF + autoTable loaded via dynamic import to reduce initial bundle
import type { EstoqueSaldo, EstoqueMovimento } from "@/hooks/useEstoque";
import { formatBRL } from "@/lib/formatters";

function formatCurrency(value: number) {
  return formatBRL(value);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

export async function generateEstoqueItemsPDF(saldos: EstoqueSaldo[], title = "Relatório de Estoque — Itens") {
  const { default: jsPDF } = await import(/* webpackChunkName: "pdf-libs" */ "jspdf");
  const { default: autoTable } = await import(/* webpackChunkName: "pdf-libs" */ "jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, 14, 22);

  autoTable(doc, {
    startY: 28,
    head: [["Item", "SKU", "Categoria", "Unidade", "Estoque", "Mínimo", "Reservado", "Disponível", "Custo Médio", "Valor Total"]],
    body: saldos.map((s) => [
      s.nome,
      s.sku || "—",
      s.categoria,
      s.unidade,
      String(s.estoque_atual),
      String(s.estoque_minimo),
      String(s.reservado),
      String(s.disponivel),
      formatCurrency(s.custo_medio),
      formatCurrency(s.estoque_atual * s.custo_medio),
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [41, 128, 185] },
    foot: [[
      "TOTAL", "", "", "",
      String(saldos.reduce((a, s) => a + s.estoque_atual, 0)),
      "", String(saldos.reduce((a, s) => a + s.reservado, 0)),
      String(saldos.reduce((a, s) => a + s.disponivel, 0)),
      "",
      formatCurrency(saldos.reduce((a, s) => a + s.estoque_atual * s.custo_medio, 0)),
    ]],
  });

  doc.save(`estoque_itens_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function generateEstoqueMovimentosPDF(movimentos: EstoqueMovimento[], title = "Relatório de Movimentações") {
  const { default: jsPDF } = await import(/* webpackChunkName: "pdf-libs" */ "jspdf");
  const { default: autoTable } = await import(/* webpackChunkName: "pdf-libs" */ "jspdf-autotable");
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFontSize(9);
  doc.text(`Gerado em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" })}`, 14, 22);

  const tipoLabels: Record<string, string> = { entrada: "Entrada", saida: "Saída", ajuste: "Ajuste", transferencia: "Transferência" };

  autoTable(doc, {
    startY: 28,
    head: [["Data", "Item", "Tipo", "Quantidade", "Custo Unit.", "Depósito", "Origem", "Observação"]],
    body: movimentos.map((m) => [
      formatDate(m.created_at),
      m.item_nome || "—",
      tipoLabels[m.tipo] || m.tipo,
      `${m.ajuste_sinal > 0 ? "+" : ""}${m.quantidade * m.ajuste_sinal}`,
      m.custo_unitario ? formatCurrency(m.custo_unitario) : "—",
      m.local_nome || "—",
      m.origem,
      m.observacao || "",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [46, 125, 50] },
  });

  doc.save(`estoque_movimentos_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export async function generateEstoqueBaixoPDF(saldos: EstoqueSaldo[]) {
  const lowStock = saldos.filter((s) => s.estoque_atual <= s.estoque_minimo && s.estoque_minimo > 0);
  await generateEstoqueItemsPDF(lowStock, "Relatório de Itens com Estoque Baixo");
}
