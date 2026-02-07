import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CloudOff, Check } from "lucide-react";
import { useEffect, useState } from "react";

interface AutoSaveIndicatorProps {
  hasDraft: boolean;
  isOnline: boolean;
}

export function AutoSaveIndicator({ hasDraft, isOnline }: AutoSaveIndicatorProps) {
  const [showSaved, setShowSaved] = useState(false);
  const [prevHasDraft, setPrevHasDraft] = useState(hasDraft);

  useEffect(() => {
    if (hasDraft && !prevHasDraft) {
      setShowSaved(true);
      const timeout = setTimeout(() => setShowSaved(false), 2000);
      return () => clearTimeout(timeout);
    }
    setPrevHasDraft(hasDraft);
  }, [hasDraft, prevHasDraft]);

  return (
    <AnimatePresence mode="wait">
      {showSaved ? (
        <motion.div
          key="saved"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5 text-xs text-primary"
        >
          <Check className="w-3 h-3" />
          <span>Rascunho salvo</span>
        </motion.div>
      ) : hasDraft ? (
        <motion.div
          key="has-draft"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5 text-xs text-muted-foreground"
        >
          {isOnline ? (
            <Cloud className="w-3 h-3" />
          ) : (
            <CloudOff className="w-3 h-3" />
          )}
          <span>Rascunho disponível</span>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
