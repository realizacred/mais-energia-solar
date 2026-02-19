/**
 * Block Renderer — Renders blocks recursively based on type
 */

import { useMemo } from "react";
import type { TreeNode, DevicePreview, EditorMode, BlockStyle } from "./types";
import { cn } from "@/lib/utils";

interface BlockRendererProps {
  node: TreeNode;
  device: DevicePreview;
  mode: EditorMode;
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  onDrop: (e: React.DragEvent, parentId: string) => void;
}

function computeStyle(style: BlockStyle, mobileStyle?: Partial<BlockStyle>, device?: DevicePreview): React.CSSProperties {
  const s = device !== "desktop" && mobileStyle ? { ...style, ...mobileStyle } : style;
  
  const css: React.CSSProperties = {
    marginTop: s.marginTop ? `${s.marginTop}px` : undefined,
    marginRight: s.marginRight ? `${s.marginRight}px` : undefined,
    marginBottom: s.marginBottom ? `${s.marginBottom}px` : undefined,
    marginLeft: s.marginLeft ? `${s.marginLeft}px` : undefined,
    paddingTop: s.paddingTop ? `${s.paddingTop}px` : undefined,
    paddingRight: s.paddingRight ? `${s.paddingRight}px` : undefined,
    paddingBottom: s.paddingBottom ? `${s.paddingBottom}px` : undefined,
    paddingLeft: s.paddingLeft ? `${s.paddingLeft}px` : undefined,
    borderWidth: s.borderWidth && s.borderWidth !== "0" ? `${s.borderWidth}px` : undefined,
    borderColor: s.borderColor,
    borderRadius: s.borderRadius && s.borderRadius !== "0" ? `${s.borderRadius}px` : undefined,
    borderStyle: s.borderWidth && s.borderWidth !== "0" ? "solid" : undefined,
    boxShadow: s.boxShadow !== "none" ? s.boxShadow : undefined,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize ? `${s.fontSize}px` : undefined,
    fontWeight: s.fontWeight ? Number(s.fontWeight) : undefined,
    textAlign: s.textAlign as React.CSSProperties["textAlign"],
    color: s.color,
  };

  // Background
  if (s.useGradient && s.gradientStart && s.gradientEnd) {
    const angle = s.staticGradientAngle ?? s.gradientAngle ?? 180;
    css.background = `linear-gradient(${angle}deg, ${s.gradientStart}, ${s.gradientEnd})`;
  } else if (s.backgroundColor && s.backgroundColor !== "transparent") {
    css.backgroundColor = s.backgroundColor;
  }

  return css;
}

function BlockTypeLabel({ type }: { type: string }) {
  const labels: Record<string, string> = {
    section: "Seção",
    column: "Coluna",
    inner_section: "Seção Interna",
    editor: "Texto",
    image: "Imagem",
    video: "Vídeo",
    button: "Botão",
    divider: "Divisor",
    carousel: "Carrossel",
    gallery: "Galeria",
    accordion: "Sanfona",
    tabs: "Abas",
  };
  return <span className="text-[9px] uppercase font-bold tracking-wider opacity-60">{labels[type] || type}</span>;
}

export function BlockRenderer({ node, device, mode, selectedId, hoveredId, onSelect, onHover, onDrop }: BlockRendererProps) {
  const { block, children } = node;
  const style = useMemo(() => computeStyle(block.style, block.mobileStyle, device), [block.style, block.mobileStyle, device]);
  
  if (!block.isVisible && mode === "preview") return null;

  const isSelected = selectedId === block.id;
  const isHovered = hoveredId === block.id;
  const isContainer = ["section", "column", "inner_section"].includes(block.type);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (mode === "edit") onSelect(block.id);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isContainer || mode === "preview") return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isContainer || mode === "preview") return;
    e.preventDefault();
    e.stopPropagation();
    onDrop(e, block.id);
  };

  const content = device !== "desktop" && block.mobileContent ? block.mobileContent : block.content;

  const renderContent = () => {
    switch (block.type) {
      case "section":
        return (
          <div style={{ maxWidth: block.style.contentWidth === "boxed" ? "1200px" : "100%", margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: style.justifyContent as string }}>
            {children.map(child => (
              <BlockRenderer key={child.block.id} node={child} device={device} mode={mode} selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} onDrop={onDrop} />
            ))}
          </div>
        );

      case "column":
        return (
          <div style={{ width: block.style.width ? `${block.style.width}%` : "100%", display: "flex", flexDirection: "column" }}>
            {children.map(child => (
              <BlockRenderer key={child.block.id} node={child} device={device} mode={mode} selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} onDrop={onDrop} />
            ))}
          </div>
        );

      case "inner_section":
        return (
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: style.alignItems as string, justifyContent: style.justifyContent as string }}>
            {children.map(child => (
              <BlockRenderer key={child.block.id} node={child} device={device} mode={mode} selectedId={selectedId} hoveredId={hoveredId} onSelect={onSelect} onHover={onHover} onDrop={onDrop} />
            ))}
          </div>
        );

      case "editor":
        return <div dangerouslySetInnerHTML={{ __html: content }} />;

      case "image":
        if (!content) return <div className="h-32 bg-muted/30 flex items-center justify-center text-xs text-muted-foreground rounded">Clique para adicionar imagem</div>;
        return <img src={content} alt="" className="max-w-full h-auto" />;

      case "divider":
        return <hr className="border-t border-border/60 w-full" />;

      case "button":
        return (
          <div style={{ textAlign: style.textAlign as React.CSSProperties["textAlign"] }}>
            <button className="px-6 py-2.5 rounded-lg text-sm font-medium" style={{ backgroundColor: block.style.backgroundColor, color: block.style.color, borderRadius: block.style.borderRadius ? `${block.style.borderRadius}px` : undefined }}>
              {content || "Botão"}
            </button>
          </div>
        );

      case "video":
        return <div className="h-48 bg-muted/20 flex items-center justify-center text-xs text-muted-foreground rounded border border-dashed border-border">🎬 Vídeo</div>;

      default:
        return <div className="p-4 bg-muted/20 rounded text-xs text-muted-foreground">{block.type}: {content || "(vazio)"}</div>;
    }
  };

  return (
    <div
      onClick={handleClick}
      onMouseEnter={(e) => { e.stopPropagation(); if (mode === "edit") onHover(block.id); }}
      onMouseLeave={(e) => { e.stopPropagation(); if (mode === "edit") onHover(null); }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      style={isContainer ? {} : style}
      className={cn(
        "relative transition-all",
        mode === "edit" && "cursor-pointer",
        mode === "edit" && isHovered && !isSelected && "outline outline-1 outline-dashed outline-blue-400/40",
        mode === "edit" && isSelected && "outline outline-2 outline-primary ring-2 ring-primary/20",
        !block.isVisible && mode === "edit" && "opacity-40",
      )}
    >
      {/* Type label in edit mode */}
      {mode === "edit" && (isSelected || isHovered) && (
        <div className="absolute -top-4 left-1 z-10 bg-primary text-primary-foreground px-1.5 py-0.5 rounded-t text-[8px] font-semibold uppercase">
          {block.type}
        </div>
      )}

      {isContainer ? (
        <div style={style}>
          {renderContent()}
          {/* Drop zone indicator for empty containers */}
          {children.length === 0 && mode === "edit" && (
            <div className="min-h-[60px] border-2 border-dashed border-border/40 rounded-lg flex items-center justify-center text-xs text-muted-foreground/60 m-2">
              Arraste widgets aqui
            </div>
          )}
        </div>
      ) : (
        renderContent()
      )}
    </div>
  );
}
