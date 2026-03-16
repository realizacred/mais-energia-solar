import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDERS = [
  { placeholder: "grafico_consumo_mensal", name: "Consumo Mensal", desc: "Gráfico de barras com consumo em kWh por mês" },
  { placeholder: "grafico_geracao_mensal", name: "Geração Mensal", desc: "Gráfico de barras com geração estimada em kWh por mês" },
  { placeholder: "grafico_economia_mensal", name: "Economia Mensal", desc: "Gráfico de barras com economia em R$ por mês" },
  { placeholder: "vc_grafico_de_comparacao", name: "Comparação de Custos", desc: "Comparação de custos antes e depois da energia solar" },
  { placeholder: "s_fluxo_caixa_acumulado_anual", name: "Fluxo de Caixa Acumulado", desc: "Retorno do investimento ao longo dos anos" },
];

export function ProposalChartsTutorial({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Como Usar Gráficos na Proposta
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Guia rápido para inserir gráficos em templates DOCX
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 flex-1 min-h-0 overflow-y-auto space-y-6">
          {/* Passo a passo */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Passo a Passo
            </p>
            <div className="space-y-3">
              <Step n={1} text="Abra o template DOCX no Microsoft Word ou LibreOffice" />
              <Step n={2} text="Escolha o local onde deseja inserir o gráfico" />
              <Step n={3} text='Digite o placeholder entre colchetes, ex: [grafico_geracao_mensal]' />
              <Step n={4} text="O placeholder deve ficar sozinho na linha, sem texto ao redor" />
              <Step n={5} text="Salve o template e faça upload normalmente" />
              <Step n={6} text="Ao gerar a proposta, o gráfico será inserido automaticamente" />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Placeholders disponíveis */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Placeholders Disponíveis
            </p>
            <div className="space-y-2">
              {PLACEHOLDERS.map((p) => (
                <div key={p.placeholder} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                  <code className="text-xs bg-muted px-2 py-1 rounded font-mono shrink-0 mt-0.5">
                    [{p.placeholder}]
                  </code>
                  <div>
                    <p className="text-sm font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Exemplos corretos */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-success" /> Exemplos Corretos
            </p>
            <div className="space-y-2">
              <ExampleBlock
                correct
                title="Placeholder sozinho na linha"
                content={`GERAÇÃO DO SISTEMA\n\n[grafico_geracao_mensal]\n\nComo mostrado acima...`}
              />
              <ExampleBlock
                correct
                title="Dentro de célula de tabela (sozinho)"
                content={`| Gráfico |\n| [grafico_economia_mensal] |`}
              />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Exemplos incorretos */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <XCircle className="w-4 h-4 text-destructive" /> Exemplos Incorretos
            </p>
            <div className="space-y-2">
              <ExampleBlock
                correct={false}
                title="Placeholder misturado com texto"
                content={`Veja o gráfico [grafico_geracao_mensal] abaixo`}
              />
              <ExampleBlock
                correct={false}
                title="Placeholder em header/footer do documento"
                content={`Cabeçalho: [grafico_geracao_mensal]`}
              />
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Limitações */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Limitações Desta Fase
            </p>
            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
              <li>Apenas motor <Badge variant="outline" className="text-xs mx-1">rendered_image</Badge> (PNG) é suportado</li>
              <li>Placeholders em headers e footers do DOCX não são suportados</li>
              <li>Placeholders misturados com texto são ignorados por segurança</li>
              <li>Se o gráfico falhar, a proposta continua sem o gráfico (não bloqueia)</li>
              <li>Dimensão padrão: 1600×900px</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Step({ n, text }: { n: number; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-xs font-bold">
        {n}
      </div>
      <p className="text-sm text-foreground">{text}</p>
    </div>
  );
}

function ExampleBlock({ correct, title, content }: { correct: boolean; title: string; content: string }) {
  return (
    <div className={`rounded-lg border p-3 ${correct ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"}`}>
      <p className="text-xs font-medium text-foreground mb-2">{title}</p>
      <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap bg-muted/50 rounded p-2">
        {content}
      </pre>
    </div>
  );
}
