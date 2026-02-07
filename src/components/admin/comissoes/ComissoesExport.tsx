import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Comissao {
  id: string;
  vendedor_id: string;
  valor_comissao: number;
  valor_base: number;
  percentual_comissao: number;
  mes_referencia: number;
  ano_referencia: number;
  status: string;
  descricao: string;
  created_at: string;
  vendedores?: { nome: string };
  clientes?: { nome: string } | null;
  projetos?: { codigo: string } | null;
  pagamentos_comissao?: { valor_pago: number }[];
}

interface ComissoesExportProps {
  comissoes: Comissao[];
  filterMes: number;
  filterAno: number;
  formatCurrency: (value: number) => string;
}

const MESES_NOMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

export function ComissoesExport({
  comissoes,
  filterMes,
  filterAno,
  formatCurrency,
}: ComissoesExportProps) {
  const [exporting, setExporting] = useState(false);

  const calcularValorPago = (comissao: Comissao) => {
    return comissao.pagamentos_comissao?.reduce((acc, p) => acc + p.valor_pago, 0) || 0;
  };

  const exportToCSV = () => {
    setExporting(true);
    try {
      const headers = [
        "Vendedor",
        "Descrição",
        "Cliente",
        "Projeto",
        "Valor Base",
        "% Comissão",
        "Valor Comissão",
        "Valor Pago",
        "Saldo",
        "Status",
        "Mês/Ano",
        "Data Criação",
      ];

      const rows = comissoes.map((c) => {
        const pago = calcularValorPago(c);
        return [
          c.vendedores?.nome || "",
          c.descricao,
          c.clientes?.nome || "",
          c.projetos?.codigo || "",
          c.valor_base.toFixed(2),
          c.percentual_comissao.toFixed(1),
          c.valor_comissao.toFixed(2),
          pago.toFixed(2),
          Math.max(0, c.valor_comissao - pago).toFixed(2),
          c.status,
          `${c.mes_referencia}/${c.ano_referencia}`,
          format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR }),
        ];
      });

      const csvContent = [
        headers.join(";"),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(";")),
      ].join("\n");

      const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `comissoes_${MESES_NOMES[filterMes - 1]}_${filterAno}.csv`;
      link.click();

      toast({ title: "Arquivo CSV exportado com sucesso!" });
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Erro ao exportar arquivo", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  const exportToPDF = () => {
    setExporting(true);
    try {
      // Generate HTML content for printing
      const totalComissoes = comissoes.reduce((acc, c) => acc + c.valor_comissao, 0);
      const totalPago = comissoes.reduce((acc, c) => acc + calcularValorPago(c), 0);
      const totalPendente = totalComissoes - totalPago;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <title>Relatório de Comissões - ${MESES_NOMES[filterMes - 1]} ${filterAno}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; font-size: 12px; }
            h1 { text-align: center; margin-bottom: 20px; }
            .summary { display: flex; justify-content: space-between; margin-bottom: 20px; padding: 10px; background: #f5f5f5; }
            .summary div { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background: #f0f0f0; font-weight: bold; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .status-pendente { color: #dc2626; }
            .status-parcial { color: #f59e0b; }
            .status-pago { color: #16a34a; }
            @media print { body { print-color-adjust: exact; } }
          </style>
        </head>
        <body>
          <h1>Relatório de Comissões</h1>
          <p style="text-align: center; color: #666;">${MESES_NOMES[filterMes - 1]} de ${filterAno}</p>
          
          <div class="summary">
            <div>
              <strong>Total Comissões</strong><br>
              ${formatCurrency(totalComissoes)}
            </div>
            <div>
              <strong>Total Pago</strong><br>
              <span style="color: #16a34a">${formatCurrency(totalPago)}</span>
            </div>
            <div>
              <strong>Pendente</strong><br>
              <span style="color: #f59e0b">${formatCurrency(totalPendente)}</span>
            </div>
            <div>
              <strong>Registros</strong><br>
              ${comissoes.length}
            </div>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Descrição</th>
                <th class="text-right">Valor Comissão</th>
                <th class="text-right">Pago</th>
                <th class="text-right">Saldo</th>
                <th class="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              ${comissoes
                .map((c) => {
                  const pago = calcularValorPago(c);
                  const saldo = Math.max(0, c.valor_comissao - pago);
                  return `
                    <tr>
                      <td>${c.vendedores?.nome || ""}</td>
                      <td>${c.descricao}</td>
                      <td class="text-right">${formatCurrency(c.valor_comissao)}</td>
                      <td class="text-right" style="color: #16a34a">${formatCurrency(pago)}</td>
                      <td class="text-right" style="color: #f59e0b">${saldo > 0 ? formatCurrency(saldo) : "-"}</td>
                      <td class="text-center status-${c.status}">${c.status.charAt(0).toUpperCase() + c.status.slice(1)}</td>
                    </tr>
                  `;
                })
                .join("")}
            </tbody>
          </table>
          
          <p style="margin-top: 30px; text-align: center; color: #999; font-size: 10px;">
            Gerado em ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
          </p>
        </body>
        </html>
      `;

      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        printWindow.print();
      }

      toast({ title: "Relatório PDF gerado!" });
    } catch (error) {
      console.error("Export error:", error);
      toast({ title: "Erro ao gerar PDF", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2" disabled={exporting || comissoes.length === 0}>
          {exporting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar Excel (CSV)
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToPDF}>
          <FileText className="h-4 w-4 mr-2" />
          Exportar PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
