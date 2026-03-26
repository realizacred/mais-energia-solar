import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Trash2, CheckCircle, AlertTriangle } from "lucide-react";

interface DatasheetUrlFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export function DatasheetUrlField({ value, onChange }: DatasheetUrlFieldProps) {
  const hasUrl = !!value?.trim();
  const isSupabaseUrl = hasUrl && value.includes("supabase");

  return (
    <div className="space-y-2">
      <Label className="text-xs">URL do Datasheet (opcional)</Label>
      <Input
        placeholder="https://fabricante.com/datasheet-modelo.pdf"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {hasUrl && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1 h-7 text-xs"
            asChild
          >
            <a href={value} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3 h-3" /> Testar URL
            </a>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-1 h-7 text-xs text-muted-foreground"
            onClick={() => onChange("")}
          >
            <Trash2 className="w-3 h-3" /> Limpar URL
          </Button>
          {isSupabaseUrl ? (
            <Badge variant="outline" className="gap-1 text-xs bg-success/10 text-success border-success/20">
              <CheckCircle className="w-3 h-3" /> Salvo no sistema
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-xs bg-warning/10 text-warning border-warning/20">
              <AlertTriangle className="w-3 h-3" /> Link externo
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
