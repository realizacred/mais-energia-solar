/**
 * TemplateFinalPreview.tsx — Preview fiel do template de proposta web
 * 
 * Renderiza os blocos do editor visual com tema, nav e footer.
 * Página pública — exceção RB-02 documentada.
 */

import { useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { TemplateHtmlRenderer } from "@/components/proposal-landing/TemplateHtmlRenderer";
import { getLandingThemeCSS, type LandingTheme } from "@/components/proposal-landing/themes/landingThemes";
import type { TemplateBlock } from "@/components/admin/proposal-builder/types";

interface TemplateFinalPreviewProps {
  blocks: TemplateBlock[];
  variables: Record<string, string>;
  theme?: LandingTheme;
  logoUrl?: string | null;
  companyName?: string | null;
}

/**
 * Labels dinâmicas baseadas no número de seções visíveis.
 * Adapta automaticamente ao template (4 ou 5 seções).
 */
function getSectionLabels(count: number): string[] {
  if (count <= 4) return ["O Projeto", "Tecnologia", "Investimento", "Aceitar"];
  return ["O Projeto", "Benefícios", "Tecnologia", "Investimento", "Aceitar"];
}

export function TemplateFinalPreview({
  blocks,
  variables,
  theme = 2,
  logoUrl,
  companyName,
}: TemplateFinalPreviewProps) {
  const anchorPrefixRef = useRef(`preview-section-${Math.random().toString(36).slice(2, 8)}-`);

  const visibleSections = useMemo(
    () => blocks.filter((block) => block.type === "section" && block.parentId === null && block.isVisible !== false),
    [blocks]
  );

  const themeCss = useMemo(() => getLandingThemeCSS(theme), [theme]);
  const sectionLabels = useMemo(() => getSectionLabels(visibleSections.length), [visibleSections.length]);

  const extraCss = `
    .pl-landing-preview { font-family: var(--font-body, 'Inter', sans-serif); }
    .pl-landing-preview * { box-sizing: border-box; }
    .pl-nav-pill { transition: all 0.2s ease; }
    .pl-nav-pill:hover { background: var(--nav-active-bg, #F07B24) !important; color: var(--nav-active-text, #fff) !important; transform: translateY(-1px); }
    @keyframes pl-fade-in { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
    .pl-landing-preview > div:not(:first-child) { animation: pl-fade-in 0.5s ease both; }
  `;

  return (
    <div className="pl-landing pl-landing-preview" style={{ minHeight: "100%", background: "var(--fundo, #F8FAFC)" }}>
      <style>{themeCss}{extraCss}</style>

      {/* ── Sticky Nav ── */}
      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--nav-bg, #fff)",
          borderBottom: "1px solid var(--card-border, #e2e8f0)",
          boxShadow: "0 4px 20px rgba(15, 23, 42, 0.06)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "12px 24px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={companyName || "Logo da empresa"}
                style={{ height: 34, maxWidth: 160, objectFit: "contain" }}
              />
            ) : (
              <div
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 10,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--icon-circle-bg, #F07B24)",
                  color: "var(--icon-circle-text, #fff)",
                  fontSize: 18,
                  fontWeight: 800,
                }}
              >
                ☀️
              </div>
            )}
            <span
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: "var(--body-text, #1e293b)",
                fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
              }}
            >
              {companyName || variables.empresa_nome || "Mais Energia Solar"}
            </span>
          </div>

          {visibleSections.length > 0 && (
            <nav style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              {visibleSections.map((section, index) => (
                <Button
                  key={section.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="pl-nav-pill h-7 rounded-full text-xs font-semibold px-3"
                  style={{
                    background: "transparent",
                    color: "var(--nav-text, #64748B)",
                    border: "1px solid var(--card-border, #e2e8f0)",
                    fontSize: 11,
                    fontFamily: "var(--font-heading, 'Montserrat', sans-serif)",
                  }}
                  onClick={() => {
                    document.getElementById(`${anchorPrefixRef.current}${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {sectionLabels[index] ?? `Seção ${index + 1}`}
                </Button>
              ))}
            </nav>
          )}
        </div>
      </div>

      {/* ── Content ── */}
      <TemplateHtmlRenderer
        blocks={blocks}
        variables={variables}
        sectionAnchorPrefix={anchorPrefixRef.current}
        adaptToTheme
      />

      {/* ── Footer ── */}
      <footer
        style={{
          padding: "32px 24px 40px",
          textAlign: "center",
          background: "var(--footer-bg, #1e293b)",
          color: "var(--footer-text, rgba(255,255,255,0.5))",
          fontSize: 12,
          fontFamily: "var(--font-body, 'Inter', sans-serif)",
        }}
      >
        <p style={{ margin: "0 0 4px", fontWeight: 600, color: "var(--nav-text, rgba(255,255,255,0.6))" }}>
          {companyName || variables.empresa_nome || "Mais Energia Solar"}
        </p>
        <p style={{ margin: 0 }}>
          Proposta comercial personalizada · Visualização do template
        </p>
      </footer>
    </div>
  );
}
