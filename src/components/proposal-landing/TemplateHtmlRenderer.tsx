/**
 * TemplateHtmlRenderer.tsx
 *
 * Renderiza TemplateBlock[] (JSON do Editor Visual) como HTML estático,
 * substituindo {{variáveis}} pelos dados reais do snapshot.
 *
 * Página pública — exceção RB-02 documentada.
 * RB-17: sem console.log ativo.
 */

import { useMemo } from "react";
import type { TemplateBlock, TreeNode, BlockStyle } from "@/components/admin/proposal-builder/types";
import { buildTree } from "@/components/admin/proposal-builder/treeUtils";

interface TemplateHtmlRendererProps {
  blocks: TemplateBlock[];
  variables: Record<string, string>;
  sectionAnchorPrefix?: string;
}

/** Substitui {{grupo.campo}} e {{campo}} pelos valores reais */
function replaceVariables(content: string, vars: Record<string, string>): string {
  if (!content) return content;
  return content.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmed = key.trim();
    // Try exact match first, then dot-notation variations
    if (vars[trimmed] !== undefined) return vars[trimmed];
    // Try without grupo prefix (e.g. "cliente.nome" → "cliente_nome")
    const underscored = trimmed.replace(/\./g, "_");
    if (vars[underscored] !== undefined) return vars[underscored];
    // Try just the field part after the dot
    const afterDot = trimmed.split(".").pop() || "";
    if (vars[afterDot] !== undefined) return vars[afterDot];
    return match; // keep original if no match
  });
}

function computeBlockStyle(style: BlockStyle): React.CSSProperties {
  const css: React.CSSProperties = {
    marginTop: style.marginTop ? `${style.marginTop}px` : undefined,
    marginRight: style.marginRight ? `${style.marginRight}px` : undefined,
    marginBottom: style.marginBottom ? `${style.marginBottom}px` : undefined,
    marginLeft: style.marginLeft ? `${style.marginLeft}px` : undefined,
    paddingTop: style.paddingTop ? `${style.paddingTop}px` : undefined,
    paddingRight: style.paddingRight ? `${style.paddingRight}px` : undefined,
    paddingBottom: style.paddingBottom ? `${style.paddingBottom}px` : undefined,
    paddingLeft: style.paddingLeft ? `${style.paddingLeft}px` : undefined,
    borderWidth: style.borderWidth && style.borderWidth !== "0" ? `${style.borderWidth}px` : undefined,
    borderColor: style.borderColor,
    borderRadius: style.borderRadius && style.borderRadius !== "0" ? `${style.borderRadius}px` : undefined,
    borderStyle: style.borderWidth && style.borderWidth !== "0" ? "solid" : undefined,
    boxShadow: style.boxShadow !== "none" ? style.boxShadow : undefined,
    fontFamily: style.fontFamily,
    fontSize: style.fontSize ? `${style.fontSize}px` : undefined,
    fontWeight: style.fontWeight ? Number(style.fontWeight) : undefined,
    textAlign: style.textAlign as React.CSSProperties["textAlign"],
    color: style.color,
  };

  if (style.useGradient && style.gradientStart && style.gradientEnd) {
    const angle = style.staticGradientAngle ?? style.gradientAngle ?? 180;
    css.background = `linear-gradient(${angle}deg, ${style.gradientStart}, ${style.gradientEnd})`;
  } else if (style.backgroundColor && style.backgroundColor !== "transparent") {
    css.backgroundColor = style.backgroundColor;
  }

  return css;
}

function RenderNode({ node, variables, sectionAnchorPrefix }: { node: TreeNode; variables: Record<string, string>; sectionAnchorPrefix?: string }) {
  const { block, children } = node;

  if (!block.isVisible) return null;

  const style = computeBlockStyle(block.style);
  const content = replaceVariables(block.content, variables);
  const isContainer = ["section", "column", "inner_section"].includes(block.type);

  const renderChildren = () =>
    children.map((child) => (
      <RenderNode key={child.block.id} node={child} variables={variables} sectionAnchorPrefix={sectionAnchorPrefix} />
    ));

  switch (block.type) {
    case "section":
      return (
        <div id={`${sectionAnchorPrefix || "section-"}${block.id}`} style={style}>
          <div style={{ maxWidth: block.style.contentWidth === "boxed" ? "1200px" : "100%", margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: style.justifyContent as string }}>
            {renderChildren()}
          </div>
        </div>
      );

    case "column":
      return (
        <div style={{ ...style, width: block.style.width ? `${block.style.width}%` : "100%", display: "flex", flexDirection: "column" }}>
          {renderChildren()}
        </div>
      );

    case "inner_section":
      return (
        <div style={{ ...style, display: "flex", flexWrap: "wrap", alignItems: style.alignItems as string, justifyContent: style.justifyContent as string }}>
          {renderChildren()}
        </div>
      );

    case "editor":
      return <div style={style} dangerouslySetInnerHTML={{ __html: content }} />;

    case "image":
      if (!content) return null;
      return (
        <div style={style}>
          <img src={content} alt="" style={{ maxWidth: "100%", height: "auto" }} />
        </div>
      );

    case "divider":
      return (
        <hr style={{ border: "none", borderTop: "1px solid #e2e8f0", width: "100%", ...style }} />
      );

    case "button":
      return (
        <div style={{ textAlign: style.textAlign as React.CSSProperties["textAlign"] }}>
          <button
            style={{
              padding: "10px 24px",
              borderRadius: block.style.borderRadius ? `${block.style.borderRadius}px` : "8px",
              backgroundColor: block.style.backgroundColor || "#F07B24",
              color: block.style.color || "#fff",
              border: "none",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.95rem",
            }}
          >
            {content || "Botão"}
          </button>
        </div>
      );

    case "video":
      if (!content) return null;
      return (
        <div style={style}>
          <iframe
            src={content}
            style={{ width: "100%", height: "315px", border: "none", borderRadius: "8px" }}
            allowFullScreen
          />
        </div>
      );

    default:
      if (isContainer) {
        return <div style={style}>{renderChildren()}</div>;
      }
      return <div style={style}>{content}</div>;
  }
}

export function TemplateHtmlRenderer({ blocks, variables, sectionAnchorPrefix }: TemplateHtmlRendererProps) {
  const tree = useMemo(() => buildTree(blocks.filter((b) => b.isVisible !== false)), [blocks]);

  return (
    <div style={{ minHeight: "100vh" }}>
      {tree.map((node) => (
        <RenderNode key={node.block.id} node={node} variables={variables} sectionAnchorPrefix={sectionAnchorPrefix} />
      ))}
    </div>
  );
}
