import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, Printer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Servico, Instalador, tipoOptions, statusConfig } from "./types";

interface ExportActionsProps {
  servicos: Servico[];
  instaladores: Instalador[];
}

export function ExportActions({ servicos, instaladores }: ExportActionsProps) {
  const getInstaladorNome = (id: string) => {
    return instaladores.find((i) => i.id === id)?.nome || "—";
  };

  const exportToCSV = () => {
    const headers = ["Data", "Horário", "Tipo", "Cliente", "Telefone", "Instalador", "Bairro", "Cidade", "Status", "Validado"];
    
    const rows = servicos.map((s) => [
      format(parseISO(s.data_agendada), "dd/MM/yyyy"),
      s.hora_inicio?.slice(0, 5) || "",
      tipoOptions.find((t) => t.value === s.tipo)?.label || s.tipo,
      s.cliente?.nome || "",
      s.cliente?.telefone || "",
      getInstaladorNome(s.instalador_id),
      s.bairro || "",
      s.cidade || "",
      statusConfig[s.status]?.label || s.status,
      s.status === "concluido" ? (s.validado ? "Sim" : "Não") : "—",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `servicos_${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const printList = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Serviços Agendados</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h1 { text-align: center; margin-bottom: 20px; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; font-weight: bold; }
            .header-info { text-align: center; margin-bottom: 10px; color: #666; }
            @media print {
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <h1>Serviços Agendados</h1>
          <p class="header-info">Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
          <table>
            <thead>
              <tr>
                <th>Data</th>
                <th>Horário</th>
                <th>Tipo</th>
                <th>Cliente</th>
                <th>Instalador</th>
                <th>Local</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${servicos.map((s) => `
                <tr>
                  <td>${format(parseISO(s.data_agendada), "dd/MM/yyyy")}</td>
                  <td>${s.hora_inicio?.slice(0, 5) || "—"}</td>
                  <td>${tipoOptions.find((t) => t.value === s.tipo)?.label || s.tipo}</td>
                  <td>${s.cliente?.nome || "—"}</td>
                  <td>${getInstaladorNome(s.instalador_id)}</td>
                  <td>${[s.bairro, s.cidade].filter(Boolean).join(", ") || "—"}</td>
                  <td>${statusConfig[s.status]?.label || s.status}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
          <br/>
          <button onclick="window.print()">Imprimir</button>
        </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToCSV}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Exportar CSV
        </DropdownMenuItem>
        <DropdownMenuItem onClick={printList}>
          <Printer className="h-4 w-4 mr-2" />
          Imprimir Lista
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
