import React, { useState } from "react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, AlertTriangle } from "lucide-react";
import type { TutorialData } from "@/services/integrations/types";

interface Props {
  tutorial: TutorialData | null | undefined;
  providerLabel?: string;
}

/**
 * Reusable tutorial section for integration pages.
 * Shows step-by-step instructions from the DB tutorial field.
 */
export function IntegrationTutorialSection({ tutorial, providerLabel }: Props) {
  if (!tutorial || (!tutorial.steps?.length && !tutorial.notes)) return null;

  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="tutorial" className="border border-border rounded-lg overflow-hidden">
        <AccordionTrigger className="px-4 py-3 text-sm hover:no-underline gap-2 bg-muted/30">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary shrink-0" />
            <span className="font-medium text-foreground">
              Como configurar {providerLabel || "esta integração"}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 pb-4 pt-2">
          <div className="space-y-4">
            {tutorial.steps && tutorial.steps.length > 0 && (
              <ol className="space-y-2.5">
                {tutorial.steps.map((step, i) => (
                  <li key={i} className="flex gap-3 items-start">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xs font-bold text-primary">{i + 1}</span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed pt-0.5">{step}</p>
                  </li>
                ))}
              </ol>
            )}

            {tutorial.notes && (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                    {tutorial.notes}
                  </p>
                </div>
              </div>
            )}
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}
