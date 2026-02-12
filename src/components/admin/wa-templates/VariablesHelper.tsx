import { Badge } from "@/components/ui/badge";
import { SAMPLE_VARS } from "./WhatsAppPreview";

interface VariablesHelperProps {
  onInsert: (variable: string) => void;
}

const VARIABLES = [
  { key: "{nome}", desc: "Nome do lead/cliente" },
  { key: "{cidade}", desc: "Cidade do lead" },
  { key: "{estado}", desc: "Estado (UF) do lead" },
  { key: "{consumo}", desc: "Consumo mensal (kWh)" },
  { key: "{vendedor}", desc: "Nome do consultor" },
];

export function VariablesHelper({ onInsert }: VariablesHelperProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Variáveis disponíveis (clique para inserir):</p>
      <div className="flex flex-wrap gap-1.5">
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            type="button"
            onClick={() => onInsert(v.key)}
            className="group"
            title={`${v.desc} — Exemplo: ${SAMPLE_VARS[v.key]}`}
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
