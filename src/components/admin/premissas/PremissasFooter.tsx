import { Button } from "@/components/ui/button";
import { Save, Loader2, X } from "lucide-react";

interface Props {
  isDirty: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function PremissasFooter({ isDirty, saving, onSave, onCancel }: Props) {
  return (
    <div className="flex justify-end gap-3 pt-2">
      <Button variant="ghost" onClick={onCancel} disabled={!isDirty || saving} className="gap-1.5">
        <X className="h-4 w-4" />
        Cancelar
      </Button>
      <Button onClick={onSave} disabled={!isDirty || saving} className="gap-1.5">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar
      </Button>
    </div>
  );
}
