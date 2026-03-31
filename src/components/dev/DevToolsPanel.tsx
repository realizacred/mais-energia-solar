import { useDevToolsContext } from "@/contexts/DevToolsContext";
import { X } from "lucide-react";

interface DevToolsPanelProps {
  open: boolean;
  onClose: () => void;
}

export function DevToolsPanel({ open, onClose }: DevToolsPanelProps) {
  const { activeProposalVars, loadingHooks } = useDevToolsContext();

  if (!open) return null;

  const entries = Object.entries(activeProposalVars);

  return (
    <div
      className="fixed right-0 top-0 h-full w-80 border-l border-green-800 bg-gray-950 text-green-400 font-mono text-xs overflow-y-auto"
      style={{ zIndex: 9999 }}
    >
      <div className="flex items-center justify-between p-3 border-b border-green-800">
        <span className="text-green-300 font-bold text-sm">DevTools Panel</span>
        <button onClick={onClose} className="text-green-600 hover:text-green-400">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Proposal Variables */}
      <div className="p-3 border-b border-green-800/50">
        <p className="text-green-300 font-bold mb-2">Variáveis da Proposta Ativa</p>
        {entries.length === 0 ? (
          <p className="text-green-700 italic">Nenhuma variável registrada</p>
        ) : (
          <ul className="space-y-1">
            {entries.map(([key, val]) => {
              const isNull = val === null || val === undefined;
              const isEmpty = val === "";
              const color = isNull
                ? "text-red-400"
                : isEmpty
                  ? "text-yellow-400"
                  : "text-green-400";
              const icon = isNull ? "❌" : isEmpty ? "⚠️" : "✅";
              return (
                <li key={key} className={color}>
                  {icon} {key}: {isNull ? "null" : isEmpty ? '""' : String(val)}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Loading Hooks */}
      <div className="p-3">
        <p className="text-green-300 font-bold mb-2">Hooks Carregando</p>
        {loadingHooks.length === 0 ? (
          <p className="text-green-700 italic">Nenhum</p>
        ) : (
          <ul className="space-y-1">
            {loadingHooks.map((h) => (
              <li key={h} className="text-yellow-400 animate-pulse">⏳ {h}</li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
