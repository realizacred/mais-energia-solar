/**
 * SettingsHelpCard — contextual help for Settings tab blocks.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Lightbulb } from "lucide-react";

interface Props {
  tips: string[];
  className?: string;
}

export function SettingsHelpCard({ tips, className }: Props) {
  if (!tips.length) return null;

  return (
    <Card className={`bg-muted/20 border-dashed ${className ?? ""}`}>
      <CardContent className="p-4 flex gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
          <Lightbulb className="w-4 h-4 text-primary" />
        </div>
        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-foreground">Como funciona</p>
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
