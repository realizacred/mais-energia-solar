import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CloudOff, Check, Trash2, Save } from "lucide-react";
import { useEffect, useState } from "react";

interface AutoSaveIndicatorProps {
  hasDraft: boolean;
  isOnline: boolean;
  onClear?: () => void;
}

export function AutoSaveIndicator({ hasDraft, isOnline, onClear }: AutoSaveIndicatorProps) {
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
          className="flex items-center gap-1.5 text-xs font-bold text-success"
        >
          <Check className="w-3 h-3" />
          <span>Rascunho salvo</span>
        </motion.div>
      ) : hasDraft ? (
        <motion.button
          key="has-draft"
          type="button"
          onClick={onClear}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex items-center gap-1.5 text-xs font-bold text-success bg-success/10 border border-success/30 rounded-full px-3 py-1.5 hover:bg-success/20 transition-colors cursor-pointer"
          title="Clique para limpar o rascunho"
        >
          <Save className="w-3 h-3 text-success" />
          <span>Rascunho salvo</span>
          <Trash2 className="w-3 h-3 ml-0.5 opacity-60" />
        </motion.button>
      ) : null}
    </AnimatePresence>
  );
}
