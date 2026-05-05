import { useEffect, useRef } from "react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

interface SidebarResizerProps {
  /** Largura mínima em px */
  min?: number;
  /** Largura máxima em px */
  max?: number;
}

/**
 * Handle de redimensionamento da sidebar do admin.
 * Atualiza a CSS var --sidebar-width no SidebarProvider e
 * persiste a preferência em localStorage.
 *
 * Renderiza-se apenas em desktop e quando a sidebar não está colapsada.
 */
export function SidebarResizer({ min = 220, max = 480 }: SidebarResizerProps) {
  const { state, isMobile } = useSidebar();
  const draggingRef = useRef(false);

  // Aplica largura salva ao montar
  useEffect(() => {
    if (isMobile) return;
    const saved = Number(localStorage.getItem("admin:sidebar-width"));
    if (saved && saved >= min && saved <= max) {
    const wrapper = document.querySelector<HTMLElement>(".group\\/sidebar-wrapper");
    wrapper?.style.setProperty("--sidebar-width", `${saved}px`);
    }
  }, [isMobile, min, max]);

  if (isMobile || state === "collapsed") return null;

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const wrapper = document.querySelector<HTMLElement>(".group\\/sidebar-wrapper");

    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return;
      const next = Math.min(max, Math.max(min, ev.clientX));
      wrapper?.style.setProperty("--sidebar-width", `${next}px`);
    };

    const onUp = () => {
      draggingRef.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const w = wrapper?.style.getPropertyValue("--sidebar-width");
      const px = Number((w || "").replace("px", ""));
      if (px) localStorage.setItem("admin:sidebar-width", String(Math.round(px)));
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Redimensionar menu"
      onPointerDown={onPointerDown}
      onDoubleClick={() => {
        const wrapper = document.querySelector<HTMLElement>("[data-sidebar-wrapper]");
        wrapper?.style.setProperty("--sidebar-width", "18rem");
        localStorage.removeItem("admin:sidebar-width");
      }}
      className={cn(
        "hidden md:block fixed top-0 bottom-0 z-40 w-1.5 -ml-0.5 cursor-col-resize",
        "bg-transparent hover:bg-primary/40 transition-colors",
        "left-[var(--sidebar-width)]"
      )}
      style={{ touchAction: "none" }}
    />
  );
}
