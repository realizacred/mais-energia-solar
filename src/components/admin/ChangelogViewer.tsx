import { CHANGELOG, type ChangelogEntry } from "@/data/changelog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { motion } from "framer-motion";

const TYPE_CONFIG: Record<
  ChangelogEntry["type"],
  { label: string; icon: React.ComponentType<{ className?: string }>; className: string }
> = {
  feature: { label: "Nova Feature", icon: Sparkles, className: "bg-primary/10 text-primary border-primary/20" },
  improvement: { label: "Melhoria", icon: Wrench, className: "bg-secondary/10 text-secondary border-secondary/20" },
  bugfix: { label: "Correção", icon: Bug, className: "bg-warning/10 text-warning border-warning/20" },
  security: { label: "Segurança", icon: Shield, className: "bg-destructive/10 text-destructive border-destructive/20" },
  infra: { label: "Infraestrutura", icon: Server, className: "bg-muted text-muted-foreground border-border" },
};

export function ChangelogViewer() {
  return (
    <motion.div
      className="p-4 md:p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
          <History className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Histórico de Atualizações</h1>
          <p className="text-sm text-muted-foreground">
            Todas as atualizações do sistema registradas por versão
          </p>
        </div>
      </div>

      {/* Timeline */}
      <Card className="bg-card border-border shadow-sm">
        <CardHeader className="border-b border-border pb-3">
          <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {CHANGELOG.length} versões registradas
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[19px] top-0 bottom-0 w-px bg-border" />

            <div className="space-y-6">
              {CHANGELOG.map((entry, idx) => {
                const config = TYPE_CONFIG[entry.type];
                const Icon = config.icon;
                return (
                  <motion.div
                    key={`${entry.version}-${idx}`}
                    className="relative pl-12"
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.35 }}
                  >
                    {/* Timeline dot */}
                    <div className="absolute left-2.5 top-1 w-[14px] h-[14px] rounded-full border-2 border-primary bg-background z-10" />

                    <div className="rounded-lg border border-border bg-card p-4 hover:shadow-sm transition-shadow">
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
                  </motion.div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
