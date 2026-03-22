/**
 * ExtractionAssistantTab — Guided assistant for understanding and configuring extraction.
 */
import { BookOpen, Cpu, RefreshCw, Zap, Shield, FileText, HelpCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface ConceptCardProps {
  icon: React.ElementType;
  title: string;
  description: string;
  details: string[];
  badgeLabel?: string;
  badgeColor?: string;
}

function ConceptCard({ icon: Icon, title, description, details, badgeLabel, badgeColor }: ConceptCardProps) {
  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              {badgeLabel && (
                <Badge variant="outline" className={`text-[10px] ${badgeColor || ""}`}>
                  {badgeLabel}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          </div>
        </div>
        <ul className="space-y-1.5 ml-12">
          {details.map((d, i) => (
            <li key={i} className="text-xs text-muted-foreground flex items-start gap-1.5">
              <span className="text-primary mt-1">•</span>
              <span>{d}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

export function ExtractionAssistantTab() {
  return (
    <div className="space-y-6">
      {/* Introduction */}
      <Card className="bg-muted/30 border-border">
        <CardContent className="p-5">
          <div className="flex items-start gap-3">
            <BookOpen className="w-5 h-5 text-primary mt-0.5 shrink-0" />
            <div className="space-y-2">
              <p className="text-sm font-semibold text-foreground">Como funciona a extração de faturas</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                O sistema lê automaticamente as contas de energia dos seus clientes e extrai todos os dados relevantes:
                consumo, valores, leituras de medidores, tarifas, tributos e créditos de geração distribuída.
                Cada concessionária possui um layout diferente, e o sistema se adapta automaticamente.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Strategy concepts */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Estratégias de Extração</h3>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ConceptCard
            icon={Cpu}
            title="Nativo"
            badgeLabel="Recomendado"
            badgeColor="bg-success/10 text-success border-success/20"
            description="O sistema usa seu mecanismo interno de leitura, otimizado para cada concessionária."
            details={[
              "Parser determinístico — sempre produz o mesmo resultado",
              "Não depende de serviços externos",
              "Mais rápido e confiável para concessionárias já suportadas",
              "Ideal para Energisa, Cemig, Light, Enel e outras grandes",
            ]}
          />
          <ConceptCard
            icon={Zap}
            title="Nativo com suporte avançado"
            description="Usa o mecanismo interno com recursos adicionais de recuperação para casos difíceis."
            details={[
              "Ativado quando o parser principal não consegue extrair todos os campos",
              "Utiliza estratégias complementares de forma transparente",
              "O resultado final é o mesmo: dados extraídos e validados",
              "Ideal para concessionárias com layouts variados",
            ]}
          />
          <ConceptCard
            icon={RefreshCw}
            title="Automático"
            description="O sistema escolhe automaticamente a melhor estratégia disponível."
            details={[
              "Tenta primeiro o parser nativo da concessionária",
              "Se não encontrar todos os campos, ativa recuperação",
              "Escolhe a rota com maior cobertura de campos",
              "Ideal para configurações genéricas e novos formatos",
            ]}
          />
        </div>
      </div>

      {/* Key concepts */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Conceitos Importantes</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConceptCard
            icon={RefreshCw}
            title="Recuperação Automática"
            description="Quando a leitura principal falha, o sistema tenta uma abordagem complementar."
            details={[
              "Ativada somente quando o parser principal retorna dados incompletos",
              "Funciona de forma transparente, sem ação manual",
              "O resultado é combinado com os dados já extraídos",
            ]}
          />
          <ConceptCard
            icon={FileText}
            title="Campos Obrigatórios"
            description="São os dados mínimos que precisam ser encontrados para considerar a extração válida."
            details={[
              "Exemplos: consumo (kWh), valor total, vencimento, número da UC",
              "Se algum campo obrigatório faltar, o status fica como 'Parcial'",
              "Campos opcionais complementam mas não invalidam a extração",
            ]}
          />
          <ConceptCard
            icon={Shield}
            title="Consistência GD"
            description="Verificações automáticas para garantir que os dados de geração distribuída estão coerentes."
            details={[
              "Compensado não pode exceder injetado no mesmo ciclo",
              "Saldo acumulado deve seguir a fórmula: anterior + injetado - compensado",
              "Valores negativos ou saltos absurdos geram alertas",
              "O saldo anterior é derivado automaticamente do histórico",
            ]}
          />
          <ConceptCard
            icon={HelpCircle}
            title="Teste de Extração"
            description="Simule a leitura antes de processar uma conta no fluxo operacional."
            details={[
              "Envie um PDF na aba 'Teste de Extração'",
              "Veja todos os campos extraídos, faltantes e alertas",
              "Útil para validar uma nova concessionária ou formato",
              "Não afeta dados reais do sistema",
            ]}
          />
        </div>
      </div>

      {/* How to configure */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3">Como configurar uma concessionária</h3>
        <Card className="border-border">
          <CardContent className="p-5">
            <ol className="space-y-3">
              {[
                { step: "1", text: "Acesse a aba 'Teste de Extração' e envie um PDF real da concessionária." },
                { step: "2", text: "Verifique quais campos foram extraídos e quais estão faltando." },
                { step: "3", text: "Na aba 'Configurações', clique em 'Nova Configuração'." },
                { step: "4", text: "Preencha o nome e código da concessionária (ex: 'Energisa', 'energisa')." },
                { step: "5", text: "Escolha a estratégia: 'Nativo' se o parser já cobre, 'Automático' para novos formatos." },
                { step: "6", text: "Defina os campos obrigatórios com base no que o teste encontrou." },
                { step: "7", text: "Ative a 'Recuperação Automática' se a extração pode ser instável." },
                { step: "8", text: "Salve e faça um novo teste para validar." },
              ].map(({ step, text }) => (
                <li key={step} className="flex items-start gap-3 text-xs text-muted-foreground">
                  <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 text-[10px] font-bold">
                    {step}
                  </span>
                  <span className="leading-relaxed">{text}</span>
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
