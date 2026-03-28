import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { HelpCircle, DollarSign, Users, MousePointerClick, TrendingUp, UserPlus, Lightbulb } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-1.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function Item({ icon: Icon, label, description }: { icon: any; label: string; description: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-primary mt-0.5 shrink-0" />
      <div>
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground"> — {description}</span>
      </div>
    </div>
  );
}

export function MetricsGuideSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <HelpCircle className="w-3.5 h-3.5" />
          Entenda as métricas
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[90vw] max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Guia de Métricas</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <Section title="💰 Métricas de Investimento">
            <Item icon={DollarSign} label="Investimento" description="Valor total gasto no período" />
            <Item icon={DollarSign} label="CPC (R$0,50–3,00)" description="Quanto paga por clique. Varia por nicho." />
            <Item icon={DollarSign} label="CPL" description="Custo por lead. Compare com ticket médio." />
          </Section>

          <Section title="👥 Métricas de Alcance">
            <Item icon={Users} label="Alcance" description="Pessoas únicas que viram os anúncios" />
            <Item icon={Users} label="Impressões" description="Total de exibições (uma pessoa pode ver várias vezes)" />
            <Item icon={Users} label="Frequência (ideal: 1–3)" description="Média de vezes por pessoa. Acima de 5 pode indicar saturação." />
          </Section>

          <Section title="👆 Métricas de Engajamento">
            <Item icon={MousePointerClick} label="Cliques" description="Interações nos anúncios" />
            <Item icon={TrendingUp} label="CTR (bom: acima de 1%)" description="% que clicou após ver" />
          </Section>

          <Section title="📊 Métricas de Conversão">
            <Item icon={UserPlus} label="Leads" description="Formulários preenchidos via Lead Ads" />
          </Section>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Dica</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Frequência alta? Expanda o público ou renove os criativos.
            </p>
          </div>

          <Section title="Como Interpretar">
            <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
              <li><strong>CTR baixo</strong> → revise criativo ou segmentação</li>
              <li><strong>CPC alto</strong> → melhore qualidade do anúncio</li>
              <li><strong>CPL alto</strong> → otimize a landing page</li>
              <li><strong>Frequência alta</strong> → expanda o público-alvo</li>
            </ul>
          </Section>
        </div>
      </SheetContent>
    </Sheet>
  );
}
