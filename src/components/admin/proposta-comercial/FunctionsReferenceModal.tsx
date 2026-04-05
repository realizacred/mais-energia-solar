/**
 * FunctionsReferenceModal — lists all supported expression engine functions with examples.
 */
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

const FUNCTION_GROUPS = [
  {
    group: "Lógicas",
    fns: [
      { name: "IF", syntax: "IF(condição, verdadeiro, falso)", example: 'IF([potencia_kwp]>5, "Grande", "Pequeno")' },
      { name: "SWITCH", syntax: "SWITCH(valor, caso1, res1, ..., default)", example: 'SWITCH([tipo_telhado], "cerâmico", 1.2, "metálico", 1.0, 1.1)' },
      { name: "AND", syntax: "AND(cond1, cond2, ...)", example: "AND([potencia_kwp]>3, [valor_total]>10000)" },
      { name: "OR", syntax: "OR(cond1, cond2, ...)", example: "OR([tipo_telhado]=\"cerâmico\", [tipo_telhado]=\"fibrocimento\")" },
      { name: "NOT", syntax: "NOT(condição)", example: "NOT([ativo]=0)" },
    ],
  },
  {
    group: "Matemáticas",
    fns: [
      { name: "MAX", syntax: "MAX(val1, val2, ...)", example: "MAX([economia_mensal], 100)" },
      { name: "MIN", syntax: "MIN(val1, val2, ...)", example: "MIN([valor_total], 50000)" },
      { name: "ABS", syntax: "ABS(valor)", example: "ABS([saldo])" },
      { name: "ROUND", syntax: "ROUND(valor, casas)", example: "ROUND([tarifa]*1.1, 2)" },
      { name: "ROUNDDOWN", syntax: "ROUNDDOWN(valor, casas)", example: "ROUNDDOWN(3.789, 2) → 3.78" },
      { name: "ROUNDUP", syntax: "ROUNDUP(valor, casas)", example: "ROUNDUP(3.781, 2) → 3.79" },
      { name: "FLOOR", syntax: "FLOOR(valor)", example: "FLOOR(3.7) → 3" },
      { name: "CEILING", syntax: "CEILING(valor)", example: "CEILING(3.2) → 4" },
      { name: "SQRT", syntax: "SQRT(valor)", example: "SQRT(144) → 12" },
      { name: "MOD", syntax: "MOD(valor, divisor)", example: "MOD(10, 3) → 1" },
      { name: "LOG", syntax: "LOG(valor)", example: "LOG(2.718) → 1" },
      { name: "^", syntax: "base ^ expoente", example: "[valor]*(1+0.07)^25" },
    ],
  },
  {
    group: "Texto",
    fns: [
      { name: "CONCAT", syntax: "CONCAT(str1, str2, ...)", example: 'CONCAT([cliente_nome], " - ", [cidade])' },
      { name: "UPPER", syntax: "UPPER(str)", example: 'UPPER([estado]) → "SP"' },
      { name: "LOWER", syntax: "LOWER(str)", example: 'LOWER([nome]) → "joão"' },
      { name: "LEN", syntax: "LEN(str)", example: "LEN([cliente_nome]) → 12" },
      { name: "TRIM", syntax: "TRIM(str)", example: 'TRIM("  texto  ") → "texto"' },
      { name: "CHAR", syntax: "CHAR(código)", example: 'CHAR(10) → quebra de linha' },
    ],
  },
  {
    group: "Data",
    fns: [
      { name: "TODAY", syntax: "TODAY()", example: 'TODAY() → "05/04/2026"' },
      { name: "YEAR", syntax: "YEAR(data)", example: 'YEAR("05/04/2026") → 2026' },
      { name: "MONTH", syntax: "MONTH(data)", example: 'MONTH("05/04/2026") → 4' },
      { name: "DAY", syntax: "DAY(data)", example: 'DAY("05/04/2026") → 5' },
    ],
  },
  {
    group: "Operadores",
    fns: [
      { name: "+", syntax: "a + b", example: "[valor_total] + [frete]" },
      { name: "-", syntax: "a - b", example: "[receita] - [custo]" },
      { name: "*", syntax: "a * b", example: "[potencia_kwp] * 1000" },
      { name: "/", syntax: "a / b", example: "[valor_total] / [potencia_kwp]" },
      { name: "=", syntax: 'a = "texto"', example: '[tipo] = "residencial"' },
      { name: "!=", syntax: "a != b", example: "[status] != 0" },
      { name: "<  >  <=  >=", syntax: "a < b", example: "[potencia_kwp] >= 10" },
    ],
  },
];

interface FunctionsReferenceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FunctionsReferenceModal({ open, onOpenChange }: FunctionsReferenceModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="p-5 pb-4 border-b border-border shrink-0">
          <DialogTitle className="text-base font-semibold text-foreground">
            Funções Disponíveis no Motor de Expressões
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            Use estas funções nas fórmulas das variáveis custom. Separadores: vírgula (,) ou ponto-e-vírgula (;).
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-5 space-y-6">
            {FUNCTION_GROUPS.map((g) => (
              <div key={g.group}>
                <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] px-2 py-0 h-5 bg-primary/10 text-primary border-primary/20">{g.group}</Badge>
                </h3>
                <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 font-semibold text-foreground w-[100px]">Função</th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground">Sintaxe</th>
                        <th className="text-left px-3 py-2 font-semibold text-foreground">Exemplo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {g.fns.map((fn) => (
                        <tr key={fn.name} className="border-t border-border hover:bg-muted/30">
                          <td className="px-3 py-2 font-mono font-semibold text-primary">{fn.name}</td>
                          <td className="px-3 py-2 font-mono text-muted-foreground">{fn.syntax}</td>
                          <td className="px-3 py-2 font-mono text-foreground">{fn.example}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="rounded-lg border border-info/20 bg-info/5 p-3">
              <p className="text-xs text-foreground">
                <strong>Variáveis:</strong> use <code className="bg-muted px-1 rounded">[nome_da_variavel]</code> para referenciar outras variáveis.
                Exemplo: <code className="bg-muted px-1 rounded">[valor_total] * (1 + [taxa]) / [prazo]</code>
              </p>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
