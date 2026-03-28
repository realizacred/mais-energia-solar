import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { BookOpen, Lightbulb } from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      <div className="space-y-1.5 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

export function CampaignsGuideSheet() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <BookOpen className="w-3.5 h-3.5" />
          Guia para Iniciantes
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[90vw] max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Guia — Facebook Ads</SheetTitle>
        </SheetHeader>
        <div className="space-y-6 mt-6">
          <Section title="📢 Estrutura do Facebook Ads">
            <p>Todo anúncio faz parte de uma hierarquia:</p>
            <ul className="space-y-1.5 list-none">
              <li>📢 <strong>Campanha</strong> — Define o OBJETIVO (Vendas, Leads, Tráfego...)</li>
              <li>👥 <strong>Conjunto de Anúncios</strong> — Define o PÚBLICO e ORÇAMENTO</li>
              <li>🖼 <strong>Anúncio</strong> — Define o CRIATIVO (imagem, vídeo, texto)</li>
            </ul>
          </Section>

          <Section title="📍 Onde Seus Anúncios Aparecem">
            <ul className="space-y-1 list-none">
              <li>📘 <strong>Facebook</strong> — Feed, Stories, Reels, Marketplace</li>
              <li>📸 <strong>Instagram</strong> — Feed, Stories, Reels, Explorar</li>
              <li>💬 <strong>Messenger</strong> — Caixa de entrada</li>
              <li>🌐 <strong>Audience Network</strong> — Apps e sites parceiros</li>
            </ul>
          </Section>

          <Section title="📊 Métricas que Importam">
            <ul className="space-y-1 list-none">
              <li>💰 <strong>Gasto</strong> — Quanto investiu</li>
              <li>👥 <strong>Alcance</strong> — Pessoas que viram</li>
              <li>👆 <strong>Cliques</strong> — Interações</li>
              <li>📊 <strong>CTR (bom: acima de 1%)</strong> — % que clicou</li>
              <li>💵 <strong>CPC</strong> — Custo por clique</li>
            </ul>
          </Section>

          <Section title="🔵 Status dos Anúncios">
            <ul className="space-y-1 list-none">
              <li>🟢 <strong>Ativo</strong> — Rodando normalmente</li>
              <li>⏸ <strong>Pausado</strong> — Pausado por você</li>
              <li>🗄 <strong>Arquivado</strong> — Não aparece mais</li>
            </ul>
          </Section>

          <div className="rounded-lg bg-primary/5 border border-primary/20 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Dica</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Nesta tela você acompanha o desempenho. Para criar/editar anúncios, use o Facebook Ads Manager diretamente.
            </p>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
