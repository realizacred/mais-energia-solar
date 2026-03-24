/**
 * GdHelpCard — contextual help card for GD tab.
 * Shows relevant guidance based on UC role.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface Props {
  isGenerator: boolean;
  isBeneficiary: boolean;
  hasGroup: boolean;
}

export function GdHelpCard({ isGenerator, isBeneficiary, hasGroup }: Props) {
  let tips: string[];

  if (isGenerator && hasGroup) {
    tips = [
      "Adicione unidades beneficiárias para distribuir os créditos de geração.",
      "A soma das alocações não deve ultrapassar 100% — o saldo restante fica com a geradora.",
      "Clique em \"Abrir unidade\" para ver os detalhes de cada beneficiária.",
    ];
  } else if (isGenerator && !hasGroup) {
    tips = [
      "Crie um grupo GD para começar a distribuir créditos desta unidade geradora.",
      "Após criar o grupo, adicione beneficiárias e defina o percentual de cada uma.",
    ];
  } else if (isBeneficiary) {
    tips = [
      "Esta unidade recebe créditos de energia de uma UC geradora.",
      "Use os botões abaixo para navegar diretamente para a geradora ou o grupo.",
      "Você pode verificar as outras unidades do mesmo grupo a partir da UC geradora.",
    ];
  } else {
    tips = [
      "Esta UC não participa de Geração Distribuída.",
      "Para incluí-la, defina o papel GD no cadastro ou vincule-a a um grupo existente.",
    ];
  }

  return (
    <Card className="bg-muted/20 border-dashed">
      <CardContent className="p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Dicas</p>
          <ul className="space-y-1">
            {tips.map((tip, i) => (
              <li key={i} className="text-xs text-muted-foreground leading-relaxed">
                • {tip}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
