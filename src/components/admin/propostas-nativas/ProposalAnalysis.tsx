import React from "react";
import { formatBRL } from "@/lib/formatters";
import { formatKwp, formatKwhValue } from "@/lib/formatters/index";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Zap, DollarSign, TrendingUp, BarChart3, Clock,
} from "lucide-react";

interface ProposalAnalysisProps {
  potenciaKwp: number;
  geracaoMensal: number;
  totalFinal: number;
  wpPrice: string | null;
  custoKit: number;
  custoInstalacao: number;
  custoComissao: number;
  custoTotal: number;
  lucroTotal: number;
  margemPct: number;
  kitItems: any[];
  snapshot: any;
  paybackText: string;
  economiaMensal: number;
}

export function ProposalAnalysis({
  potenciaKwp, geracaoMensal, totalFinal, wpPrice,
  custoKit, custoInstalacao, custoComissao, custoTotal, lucroTotal, margemPct,
  kitItems, snapshot, paybackText, economiaMensal,
}: ProposalAnalysisProps) {
  return (
    <div>
      <h2 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
        <BarChart3 className="h-4 w-4 text-primary" />
        Análise da Proposta
      </h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="py-5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-primary mb-1">
              <Zap className="h-4 w-4" />
              <p className="text-sm font-medium">Potência</p>
            </div>
            <p className="text-xl font-bold">{formatKwp(potenciaKwp)}</p>
            <p className="text-xs text-muted-foreground">
              {geracaoMensal > 0 ? `${formatKwhValue(geracaoMensal)} kWh/mês` : "—"}
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="py-5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
              <DollarSign className="h-4 w-4" />
              <p className="text-sm font-medium">Preço de Venda</p>
            </div>
            <p className="text-xl font-bold">{formatBRL(totalFinal)}</p>
            <p className="text-xs text-muted-foreground">{wpPrice ? `${wpPrice} / Wp` : "—"}</p>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="py-5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-success mb-1">
              <TrendingUp className="h-4 w-4" />
              <p className="text-sm font-medium">Lucro</p>
            </div>
            <p className="text-xl font-bold">{formatBRL(lucroTotal)}</p>
            <p className="text-xs text-muted-foreground">Margem: {margemPct.toFixed(2)}%</p>
          </CardContent>
        </Card>
      </div>

      {/* Items table */}
      {(kitItems.length > 0 || custoInstalacao > 0 || custoComissao > 0) && (
        <Card className="border-border/50 mb-6">
          <CardContent className="py-0 px-0 overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="text-[10px] uppercase tracking-wider">
                  <TableHead>Categoria</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-center">QTD</TableHead>
                  <TableHead className="text-right">Custo Unitário</TableHead>
                  <TableHead className="text-right">Custo</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Venda</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {custoKit > 0 && (
                  <>
                    <TableRow className="bg-muted/30 font-medium">
                      <TableCell className="text-xs">KIT <Badge variant="outline" className="text-[9px] ml-1">Fechado</Badge></TableCell>
                      <TableCell className="text-xs">Kit</TableCell>
                      <TableCell className="text-center text-xs">1</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoKit)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoKit)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(0)}</TableCell>
                      <TableCell className="text-right text-xs">{formatBRL(custoKit)}</TableCell>
                    </TableRow>
                    {kitItems.map((item: any, idx: number) => (
                      <TableRow key={idx} className="text-muted-foreground">
                        <TableCell className="text-[11px] pl-6">
                          {item.categoria === "modulos" ? "☐ Módulo" : item.categoria === "inversores" ? "☐ Inversor" : `☐ ${item.categoria}`}
                        </TableCell>
                        <TableCell className="text-[11px]">{`${item.fabricante || ""} ${item.modelo || item.descricao || ""}`.trim()}</TableCell>
                        <TableCell className="text-center text-[11px]">{item.quantidade}</TableCell>
                        <TableCell className="text-right text-[11px]">{formatBRL(item.preco_unitario || 0)}</TableCell>
                        <TableCell className="text-right text-[11px]">{formatBRL(0)}</TableCell>
                        <TableCell className="text-right text-[11px]">{formatBRL(0)}</TableCell>
                        <TableCell className="text-right text-[11px]">{formatBRL(0)}</TableCell>
                      </TableRow>
                    ))}
                  </>
                )}
                {custoInstalacao > 0 && (
                  <TableRow>
                    <TableCell className="text-xs">Instalação</TableCell>
                    <TableCell className="text-xs">Instalação</TableCell>
                    <TableCell className="text-center text-xs">1</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(custoInstalacao)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(custoInstalacao)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(0)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(custoInstalacao)}</TableCell>
                  </TableRow>
                )}
                {custoComissao > 0 && (
                  <TableRow>
                    <TableCell className="text-xs">Comissão</TableCell>
                    <TableCell className="text-xs">Comissão</TableCell>
                    <TableCell className="text-center text-xs">1</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(custoComissao)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(custoComissao)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(0)}</TableCell>
                    <TableCell className="text-right text-xs">{formatBRL(custoComissao)}</TableCell>
                  </TableRow>
                )}
                <TableRow className="font-bold border-t-2">
                  <TableCell colSpan={4} />
                  <TableCell className="text-right text-xs">{formatBRL(custoTotal)}</TableCell>
                  <TableCell className="text-right text-xs">{formatBRL(lucroTotal)}</TableCell>
                  <TableCell className="text-right text-xs">{formatBRL(totalFinal)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Economia cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="border-border/50">
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
              <Zap className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Gasto com Energia</p>
            </div>
            <p className="text-sm font-bold">{formatBRL(snapshot.gastoEnergiaSem || 0)} | {formatBRL(snapshot.gastoEnergiaCom || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-info mb-1">
              <BarChart3 className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Gasto com Demanda</p>
            </div>
            <p className="text-sm font-bold">{formatBRL(snapshot.gastoDemandaSem || 0)} | {formatBRL(snapshot.gastoDemandaCom || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-destructive mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Outros Encargos</p>
            </div>
            <p className="text-sm font-bold">{formatBRL(snapshot.outrosEncargosSem || 0)} | {formatBRL(snapshot.outrosEncargosCom || 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="py-4 text-center">
            <div className="flex items-center justify-center gap-1.5 text-success mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              <p className="text-xs font-medium">Economia Mensal</p>
            </div>
            <p className="text-sm font-bold">{formatBRL(economiaMensal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* ROI metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="py-5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
              <TrendingUp className="h-4 w-4" />
              <p className="text-sm font-medium">Taxa Interna de Retorno</p>
            </div>
            <p className="text-2xl font-bold text-warning">{snapshot.tir ? `${(snapshot.tir * 100).toFixed(2)}%` : "—"}</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="py-5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
              <DollarSign className="h-4 w-4" />
              <p className="text-sm font-medium">Valor Presente Líquido</p>
            </div>
            <p className="text-2xl font-bold text-warning">{snapshot.vpl ? formatBRL(snapshot.vpl) : "—"}</p>
          </CardContent>
        </Card>
        <Card className="bg-warning/5 border-warning/20">
          <CardContent className="py-5 text-center">
            <div className="flex items-center justify-center gap-1.5 text-warning mb-1">
              <Clock className="h-4 w-4" />
              <p className="text-sm font-medium">Payback</p>
            </div>
            <p className="text-2xl font-bold text-warning">{paybackText}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
