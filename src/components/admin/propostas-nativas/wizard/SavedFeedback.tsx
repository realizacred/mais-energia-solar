import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SavedFeedbackProps {
  className?: string;
}

/**
 * Calm micro-interaction that shows "Salvo" feedback.
 * Call the trigger() method via the hook to display it briefly.
 */
export function useSavedFeedback() {
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const trigger = useCallback(() => {
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setVisible(false), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { visible, trigger };
}

export function SavedFeedback({ className }: SavedFeedbackProps & { visible: boolean }) {
  return null; // use SavedFeedbackInline instead
}

/**
 * Inline "Salvo" pill — place it wherever you need feedback.
 */
export function SavedFeedbackInline({
  visible,
  label = "Salvo",
  className,
}: {
  visible: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -2 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full",
            "bg-success/10 text-success text-[10px] font-semibold",
            className
          )}
        >
          <Check className="h-3 w-3" />
          {label}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
