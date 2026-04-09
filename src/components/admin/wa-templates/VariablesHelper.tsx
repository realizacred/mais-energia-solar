import { Badge } from "@/components/ui/badge";
import { WA_AUTOMATION_VARIABLES, WA_SAMPLE_VARS } from "@/lib/variablesCatalog";

interface VariablesHelperProps {
  onInsert: (variable: string) => void;
}

export function VariablesHelper({ onInsert }: VariablesHelperProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Variáveis disponíveis (clique para inserir):</p>
      <div className="flex flex-wrap gap-1.5">
        {WA_AUTOMATION_VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onInsert(v.key)}
            className="group"
            title={`${v.label} — Exemplo: ${v.example}`}
          >
            <Badge
              variant="outline"
              className="cursor-pointer text-xs transition-colors group-hover:bg-primary group-hover:text-primary-foreground"
            >
              {v.key}
            </Badge>
          </button>
        ))}
      </div>
      <p className="text-[11px] text-muted-foreground/70">Passe o mouse sobre uma variável para ver o exemplo</p>
    </div>
  );
}
