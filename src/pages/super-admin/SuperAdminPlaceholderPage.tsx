/**
 * SuperAdminPlaceholderPage — placeholder genérico para módulos do PR-2/3/4.
 */
import { LucideIcon, Construction } from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import { Card, CardContent } from "@/components/ui/card";

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
      <Card>
        <CardContent className="py-10 flex flex-col items-center text-center gap-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
            <Construction className="w-6 h-6 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-base font-semibold">{phase} — em construção</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Esta área será habilitada na próxima fase do roadmap.
            </p>
          </div>
          <div className="text-left max-w-md w-full">
            <p className="text-sm font-medium mb-2">Escopo:</p>
            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
              {scope.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
