/**
 * TemplateHtmlRenderer.tsx
 *
 * Renderiza TemplateBlock[] (JSON do Editor Visual) como HTML estático,
 * substituindo {{variáveis}} pelos dados reais do snapshot.
 *
 * Supports both:
 * - Raw "editor" blocks (dangerouslySetInnerHTML) — legacy/custom content
 * - Semantic "proposal_*" blocks — proper React components via SemanticBlockRenderer
 *
 * Página pública — exceção RB-02 documentada.
 */

import { useMemo } from "react";
import type { TemplateBlock, TreeNode, BlockStyle } from "@/components/admin/proposal-builder/types";
import { buildTree } from "@/components/admin/proposal-builder/treeUtils";
import { SEMANTIC_RENDERERS } from "./SemanticBlockRenderer";

interface TemplateHtmlRendererProps {
  blocks: TemplateBlock[];
  variables: Record<string, string>;
  sectionAnchorPrefix?: string;
  adaptToTheme?: boolean;
}

const DARK_SURFACE_REGEX = /#000(?:000)?|#111(?:111)?|#0a0a0f|#121212|#171717|rgb\(\s*(?:0|10|17|18|23)\s*,\s*(?:0|10|17|18|23)\s*,\s*(?:0|10|15|17|18|23)\s*\)/i;
const LIGHT_TEXT_REGEX = /#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)|rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(?:0?\.\d+|1(?:\.0+)?)\s*\)/i;
const LIGHT_BORDER_RGBA_REGEX = /rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.\d+\s*\)/i;

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

function isDarkSurfaceColor(value?: string): boolean {
  if (!value) return false;
  return DARK_SURFACE_REGEX.test(value.trim().toLowerCase());
}

function isLightTextColor(value?: string): boolean {
  if (!value) return false;
  return LIGHT_TEXT_REGEX.test(value.trim().toLowerCase());
}

function isLightBorderColor(value?: string): boolean {
  if (!value) return false;
  return LIGHT_BORDER_RGBA_REGEX.test(value.trim().toLowerCase()) || isLightTextColor(value);
}

function normalizePreviewHtml(content: string): string {
  if (!content) return content;

  const hasDarkSurface =
    /background(?:-color)?\s*:\s*[^;]*(#000(?:000)?|#111(?:111)?|#0a0a0f|#121212|#171717)/i.test(content) ||
    /linear-gradient\([^)]*(#000(?:000)?|#111(?:111)?|#0a0a0f|#121212|#171717)[^)]*\)/i.test(content);

  if (!hasDarkSurface) return content;

  return content
    .replace(
      /linear-gradient\([^)]*(#000(?:000)?|#111(?:111)?|#0a0a0f|#121212|#171717)[^)]*\)/gi,
      "linear-gradient(135deg, var(--card-bg, #ffffff), var(--fundo, #F8FAFC))"
    )
    .replace(
      /background(?:-color)?\s*:\s*(#000(?:000)?|#111(?:111)?|#0a0a0f|#121212|#171717|rgb\(\s*(?:0|10|17|18|23)\s*,\s*(?:0|10|17|18|23)\s*,\s*(?:0|10|15|17|18|23)\s*\))/gi,
      "background:var(--card-bg, #ffffff)"
    )
    .replace(
      /border\s*:\s*1px\s+solid\s+rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.\d+\s*\)/gi,
      "border:1px solid var(--card-border, #e2e8f0)"
    )
    .replace(
      /border-color\s*:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*0?\.\d+\s*\)/gi,
      "border-color:var(--card-border, #e2e8f0)"
    )
    .replace(
      /color\s*:\s*rgba\(\s*255\s*,\s*255\s*,\s*255\s*,\s*(0?\.\d+)\s*\)/gi,
      (_match, opacity: string) =>
        Number(opacity) >= 0.75
          ? "color:var(--body-text, #1e293b)"
          : "color:var(--nav-text, #64748B)"
    )
    .replace(
      /color\s*:\s*(#fff(?:fff)?|white|rgb\(\s*255\s*,\s*255\s*,\s*255\s*\))/gi,
      "color:var(--body-text, #1e293b)"
    );
}

function computeBlockStyle(style: BlockStyle, adaptToTheme = false): React.CSSProperties {
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
    css.background = adaptToTheme && isDarkSurfaceColor(style.gradientStart) && isDarkSurfaceColor(style.gradientEnd)
      ? "linear-gradient(135deg, var(--card-bg, #ffffff), var(--fundo, #F8FAFC))"
      : `linear-gradient(${angle}deg, ${style.gradientStart}, ${style.gradientEnd})`;
  } else if (style.backgroundColor && style.backgroundColor !== "transparent") {
    css.backgroundColor = adaptToTheme && isDarkSurfaceColor(style.backgroundColor)
      ? "var(--card-bg, #ffffff)"
      : style.backgroundColor;
  }

  if (adaptToTheme && isLightTextColor(style.color)) {
    css.color = "var(--body-text, #1e293b)";
  }

  if (adaptToTheme && isLightBorderColor(style.borderColor)) {
    css.borderColor = "var(--card-border, #e2e8f0)";
  }

  return css;
}

function RenderNode({
  node,
  variables,
  sectionAnchorPrefix,
  adaptToTheme,
}: {
  node: TreeNode;
  variables: Record<string, string>;
  sectionAnchorPrefix?: string;
  adaptToTheme?: boolean;
}) {
  const { block, children } = node;

  if (!block.isVisible) return null;

  const style = computeBlockStyle(block.style, adaptToTheme);
  const content = replaceVariables(block.content, variables);
  const renderedContent = adaptToTheme && block.type === "editor" ? normalizePreviewHtml(content) : content;
  const isContainer = ["section", "column", "inner_section"].includes(block.type);

  const renderChildren = () =>
    children.map((child) => (
      <RenderNode
        key={child.block.id}
        node={child}
        variables={variables}
        sectionAnchorPrefix={sectionAnchorPrefix}
        adaptToTheme={adaptToTheme}
      />
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
      return <div style={style} dangerouslySetInnerHTML={{ __html: renderedContent }} />;

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
              backgroundColor: adaptToTheme && isDarkSurfaceColor(block.style.backgroundColor)
                ? "var(--accent-box-bg, linear-gradient(135deg, #F07B24, #E06010))"
                : block.style.backgroundColor || "#F07B24",
              color: adaptToTheme && isLightTextColor(block.style.color)
                ? "#fff"
                : block.style.color || "#fff",
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

export function TemplateHtmlRenderer({ blocks, variables, sectionAnchorPrefix, adaptToTheme = false }: TemplateHtmlRendererProps) {
  const tree = useMemo(() => buildTree(blocks.filter((b) => b.isVisible !== false)), [blocks]);

  return (
    <div style={{ minHeight: "100vh" }}>
      {tree.map((node) => (
        <RenderNode
          key={node.block.id}
          node={node}
          variables={variables}
          sectionAnchorPrefix={sectionAnchorPrefix}
          adaptToTheme={adaptToTheme}
        />
      ))}
    </div>
  );
}
