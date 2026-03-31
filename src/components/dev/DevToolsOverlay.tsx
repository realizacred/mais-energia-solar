import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useDevToolsContext } from "@/contexts/DevToolsContext";
import { DevToolsPanel } from "./DevToolsPanel";

export function DevToolsOverlay() {
  const { enabled, isSuperAdmin, hoveredVar, hoveredComponent, hoveredHasVar, loadingHooks } =
    useDevToolsContext();
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const handler = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [enabled]);

  if (!enabled || !isSuperAdmin) return null;

  const showTooltip = hoveredVar !== null || hoveredComponent !== null;

  const tooltipBg = hoveredHasVar
    ? "bg-gray-900 border-green-600"
    : hoveredComponent
      ? "bg-yellow-900 border-yellow-500"
      : "bg-red-900 border-red-500";

  return createPortal(
    <>
      {/* Hover Tooltip */}
      {showTooltip && (
        <div
          className={`fixed pointer-events-none px-3 py-1.5 rounded-md border font-mono text-xs text-white shadow-lg ${tooltipBg}`}
          style={{
            zIndex: 9998,
            left: mousePos.x + 14,
            top: mousePos.y + 14,
            maxWidth: 360,
          }}
        >
          {hoveredHasVar ? (
            <span>
              <span className="text-green-400">{`{{${hoveredVar}}}`}</span>
              {hoveredComponent && (
                <span className="text-gray-400 ml-2">— {hoveredComponent}</span>
              )}
            </span>
          ) : hoveredComponent ? (
            <span className="text-yellow-300">
              componente: {hoveredComponent} — sem variável
            </span>
          ) : (
            <span className="text-red-300">Sem variável mapeada</span>
          )}
        </div>
      )}

      {/* DEV MODE Badge */}
      <div
        className="fixed top-2 right-2 flex items-center gap-2"
        style={{ zIndex: 9998 }}
      >
        {loadingHooks.length > 0 && (
          <div className="bg-yellow-600 text-yellow-100 text-[10px] font-mono px-2 py-1 rounded animate-pulse">
            ⏳ {loadingHooks.length} hook{loadingHooks.length > 1 ? "s" : ""} loading
          </div>
        )}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-mono font-bold px-2 py-1 rounded animate-pulse cursor-pointer"
        >
          DEV MODE
        </button>
      </div>

      {/* Side Panel */}
      <DevToolsPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>,
    document.body
  );
}
