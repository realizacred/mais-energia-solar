import { CHANGELOG, type ChangelogEntry } from "@/data/changelog";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Wrench,
  Bug,
  Shield,
  Server,
  History,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_CONFIG: Record<
  ChangelogEntry["type"],
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  feature: { label: "Nova Feature", icon: Sparkles, className: "bg-primary/10 text-primary border-primary/20" },
  improvement: { label: "Melhoria", icon: Wrench, className: "bg-info/10 text-info border-info/20" },
  bugfix: { label: "Correção", icon: Bug, className: "bg-warning/10 text-warning border-warning/20" },
  security: { label: "Segurança", icon: Shield, className: "bg-destructive/10 text-destructive border-destructive/20" },
  infra: { label: "Infraestrutura", icon: Server, className: "bg-muted text-muted-foreground border-border" },
};

export function ChangelogViewer() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Histórico de Atualizações
          </CardTitle>
          <CardDescription>
            Todas as atualizações do sistema são registradas automaticamente aqui.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-6">
              {CHANGELOG.map((entry, idx) => {
                const config = TYPE_CONFIG[entry.type];
                const Icon = config.icon;
                return (
                  <div key={`${entry.version}-${idx}`} className="relative pl-12">
                    {/* Timeline dot */}
                    <div className="absolute left-2.5 top-1 w-[14px] h-[14px] rounded-full border-2 border-primary bg-background z-10" />

                    <div className="rounded-xl border bg-card p-4 hover:shadow-sm transition-shadow">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="font-mono font-bold text-sm text-foreground">
                          {entry.version}
                        </span>
                        <Badge variant="outline" className={config.className}>
                          <Icon className="h-3 w-3 mr-1" />
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {format(parseISO(entry.date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                        </span>
                      </div>

                      <h4 className="text-sm font-semibold text-foreground mb-1">
                        {entry.title}
                      </h4>
                      <p className="text-sm text-muted-foreground">
                        {entry.description}
                      </p>

                      {entry.details && entry.details.length > 0 && (
                        <ul className="mt-3 space-y-1">
                          {entry.details.map((detail, i) => (
                            <li
                              key={i}
                              className="text-xs text-muted-foreground flex items-start gap-2"
                            >
                              <span className="mt-1.5 w-1 h-1 rounded-full bg-primary shrink-0" />
                              {detail}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
