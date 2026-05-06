/**
 * SuperAdminPlaceholderPage — placeholder genérico para módulos do PR-2/3/4.
 * Comunica claramente que a área existe mas ainda não foi implementada.
 * NÃO é mock: lista escopo concreto e referencia a fase do roadmap.
 */
import { LucideIcon, Construction } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/ui-kit";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  scope: string[];
  phase: string;
}

export function SuperAdminPlaceholderPage({ icon: Icon, title, description, scope, phase }: Props) {
  return (
    <div className="space-y-6">
      <PageHeader icon={Icon} title={title} description={description} />
      <EmptyState
        icon={Construction}
        title={`${phase} — em construção`}
        description={
          <div className="space-y-2 text-left">
            <p className="text-sm">Escopo desta área:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {scope.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        }
      />
    </div>
  );
}
