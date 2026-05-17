import React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Info, Target, MousePointer, DollarSign, Activity } from "lucide-react";

interface MarketingGuideModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MarketingGuideModal({ open, onOpenChange }: MarketingGuideModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Info className="h-5 w-5 text-primary" />
            Guia de Marketing & Ads
          </DialogTitle>
          <DialogDescription>
            Entenda como funciona a estrutura de anúncios e quais métricas importam para o seu negócio.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <section className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-1">1. Estrutura do Facebook Ads</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="font-bold text-primary mb-1">Campanha</p>
                <p className="text-muted-foreground text-xs">Onde você define o objetivo (ex: Gerar Leads).</p>
              </div>
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="font-bold text-primary mb-1">Conjunto de Anúncios</p>
                <p className="text-muted-foreground text-xs">Onde define o público, orçamento e locais.</p>
              </div>
              <div className="p-3 rounded-lg bg-muted border border-border">
                <p className="font-bold text-primary mb-1">Anúncio</p>
                <p className="text-muted-foreground text-xs">O criativo (imagem/vídeo) que o cliente vê.</p>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-1">2. Métricas Principais</h3>
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Activity className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">CTR (Click-Through Rate)</p>
                  <p className="text-xs text-muted-foreground">
                    Taxa de cliques em relação às impressões. Indica o quão atrativo é o seu anúncio. 
                    <span className="text-success font-medium"> Acima de 1% é considerado bom.</span>
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MousePointer className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">CPC (Custo por Clique)</p>
                  <p className="text-xs text-muted-foreground">
                    Quanto você paga, em média, por cada clique no seu anúncio.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Target className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">CPL (Custo por Lead)</p>
                  <p className="text-xs text-muted-foreground">
                    A métrica mais importante: quanto custou cada novo contato interessado gerado.
                  </p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-sm">ROAS (Retorno sobre Gasto com Anúncios)</p>
                  <p className="text-xs text-muted-foreground">
                    Relação entre o valor vendido e o valor investido.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-3">
            <h3 className="font-semibold text-lg border-b pb-1">3. Status dos Anúncios</h3>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1 pl-2">
              <li><span className="font-bold text-success">Ativo:</span> Anúncio sendo exibido normalmente.</li>
              <li><span className="font-bold text-warning">Em aprendizado:</span> O algoritmo está testando as melhores variações.</li>
              <li><span className="font-bold text-destructive">Reprovado:</span> Violaram alguma política (texto, imagem ou link).</li>
              <li><span className="font-bold">Pausado:</span> Interrompido manualmente pelo usuário.</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
