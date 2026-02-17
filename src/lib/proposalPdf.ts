import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface ProposalData {
  // Cliente
  clienteNome: string;
  clienteTelefone: string;
  clienteCidade: string;
  clienteEstado: string;
  clienteBairro?: string;
  clienteEndereco?: string;
  
  // Técnico
  consumoMedio: number;
  tipoTelhado: string;
  redeAtendimento: string;
  area: string;
  
  // Calculado
  potenciaKwp: number;
  numeroPlacas: number;
  geracaoMensal: number;
  economiaMensal: number;
  economiaAnual: number;
  economia25Anos: number;
  co2Evitado: number;
  
  // Financeiro
  investimentoEstimado: number;
  paybackAnos: number;
  
  // Financiamento (opcional)
  financiamento?: {
    banco: string;
    parcelas: number;
    valorParcela: number;
    taxaMensal: number;
  };
  
  // Consultor
  consultorNome?: string;
  consultorCodigo?: string;
  
  // Empresa
  empresaNome?: string;
  empresaTelefone?: string;
  logoUrl?: string;
}

const COLORS = {
  primary: [0, 60, 80], // Dark blue
  secondary: [230, 126, 34], // Orange
  text: [33, 33, 33],
  lightGray: [245, 245, 245],
  white: [255, 255, 255],
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

async function loadImageAsBase64(url: string): Promise<string | null> {
  try {
    const img = new Image();
    img.crossOrigin = "anonymous";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Failed to load image"));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return null;
  }
}

export async function generateProposalPdf(data: ProposalData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  let y = margin;

  // Load logo if available
  let logoBase64: string | null = null;
  if (data.logoUrl) {
    logoBase64 = await loadImageAsBase64(data.logoUrl);
  }

  // Header with gradient effect
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.rect(0, 0, pageWidth, 45, "F");

  // Logo or company name
  let textStartX = margin;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "PNG", margin, 8, 30, 30);
      textStartX = margin + 35;
    } catch {
      // fallback to text
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(data.empresaNome || "MAIS ENERGIA SOLAR", textStartX, 25);
  
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.empresaTelefone || "(00) 00000-0000", textStartX, 35);

  // Proposal title
  doc.setFontSize(12);
  doc.text("PROPOSTA COMERCIAL", pageWidth - margin, 25, { align: "right" });
  
  const today = new Date().toLocaleDateString("pt-BR");
  doc.setFontSize(9);
  doc.text(`Data: ${today}`, pageWidth - margin, 35, { align: "right" });

  y = 55;

  // Cliente section
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("DADOS DO CLIENTE", margin, y);
  
  y += 8;
  
  doc.setFillColor(COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]);
  doc.roundedRect(margin, y - 4, pageWidth - margin * 2, 28, 3, 3, "F");

  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Nome:", margin + 5, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(data.clienteNome, margin + 25, y + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Telefone:", margin + 5, y + 12);
  doc.setFont("helvetica", "normal");
  doc.text(data.clienteTelefone, margin + 30, y + 12);

  doc.setFont("helvetica", "bold");
  doc.text("Localização:", margin + 5, y + 20);
  doc.setFont("helvetica", "normal");
  const location = data.clienteBairro 
    ? `${data.clienteBairro}, ${data.clienteCidade} - ${data.clienteEstado}`
    : `${data.clienteCidade} - ${data.clienteEstado}`;
  doc.text(location, margin + 35, y + 20);

  y += 38;

  // Sistema proposto
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("SISTEMA PROPOSTO", margin, y);

  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Especificação", "Valor"]],
    body: [
      ["Potência do Sistema", `${formatNumber(data.potenciaKwp)} kWp`],
      ["Quantidade de Módulos", `${data.numeroPlacas} placas`],
      ["Tipo de Telhado", data.tipoTelhado],
      ["Tipo de Rede", data.redeAtendimento],
      ["Consumo Médio Atual", `${formatNumber(data.consumoMedio)} kWh/mês`],
      ["Geração Estimada", `${formatNumber(data.geracaoMensal)} kWh/mês`],
    ],
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]],
    },
  });

  // Use type assertion to access autoTable's lastAutoTable
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Economia e benefícios
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("ECONOMIA E BENEFÍCIOS", margin, y);

  y += 5;

  autoTable(doc, {
    startY: y,
    margin: { left: margin, right: margin },
    head: [["Benefício", "Valor"]],
    body: [
      ["Economia Mensal Estimada", formatCurrency(data.economiaMensal)],
      ["Economia Anual Estimada", formatCurrency(data.economiaAnual)],
      ["Economia em 25 Anos", formatCurrency(data.economia25Anos)],
      ["CO₂ Evitado por Ano", `${formatNumber(data.co2Evitado)} kg`],
      ["Retorno do Investimento", `${formatNumber(data.paybackAnos)} anos`],
    ],
    styles: {
      fontSize: 10,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: [COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]],
      textColor: [255, 255, 255],
      fontStyle: "bold",
    },
    alternateRowStyles: {
      fillColor: [COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]],
    },
  });

  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // Check if need new page
  if (y > pageHeight - 80) {
    doc.addPage();
    y = margin;
  }

  // Investimento
  doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("INVESTIMENTO", margin, y);

  y += 8;

  // Investment box
  doc.setFillColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
  doc.roundedRect(margin, y - 3, pageWidth - margin * 2, 20, 3, 3, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Investimento Estimado:", margin + 10, y + 8);

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text(formatCurrency(data.investimentoEstimado), pageWidth - margin - 10, y + 9, { align: "right" });

  y += 28;

  // Financiamento (se disponível)
  if (data.financiamento) {
    doc.setTextColor(COLORS.primary[0], COLORS.primary[1], COLORS.primary[2]);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("OPÇÃO DE FINANCIAMENTO", margin, y);

    y += 5;

    autoTable(doc, {
      startY: y,
      margin: { left: margin, right: margin },
      head: [["Condição", "Valor"]],
      body: [
        ["Banco", data.financiamento.banco],
        ["Parcelas", `${data.financiamento.parcelas}x`],
        ["Taxa Mensal", `${data.financiamento.taxaMensal}% a.m.`],
        ["Valor da Parcela", formatCurrency(data.financiamento.valorParcela)],
      ],
      styles: {
        fontSize: 10,
        cellPadding: 4,
      },
      headStyles: {
        fillColor: [COLORS.secondary[0], COLORS.secondary[1], COLORS.secondary[2]],
        textColor: [255, 255, 255],
        fontStyle: "bold",
      },
      alternateRowStyles: {
        fillColor: [COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]],
      },
    });

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  }

  // Footer
  const footerY = pageHeight - 20;
  
  doc.setFillColor(COLORS.lightGray[0], COLORS.lightGray[1], COLORS.lightGray[2]);
  doc.rect(0, footerY - 10, pageWidth, 30, "F");

  doc.setTextColor(COLORS.text[0], COLORS.text[1], COLORS.text[2]);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  
  const validadeText = "Proposta válida por 15 dias. Valores sujeitos a alteração sem aviso prévio.";
  doc.text(validadeText, pageWidth / 2, footerY, { align: "center" });

  if (data.consultorNome) {
    doc.setFontSize(8);
    doc.text(`Consultor: ${data.consultorNome}`, pageWidth / 2, footerY + 6, { align: "center" });
  }

  // Return as blob
  return doc.output("blob");
}

export function downloadProposalPdf(blob: Blob, clienteNome: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  
  // Sanitize filename
  const safeName = clienteNome.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 30);
  const date = new Date().toISOString().split("T")[0];
  link.download = `Proposta_${safeName}_${date}.pdf`;
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
