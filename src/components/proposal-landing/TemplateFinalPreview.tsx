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

  return (
    <div className="pl-landing" style={{ minHeight: "100%", background: "var(--fundo, #F8FAFC)" }}>
      <style>{themeCss}</style>

      <div
        style={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          background: "var(--nav-bg, #fff)",
          borderBottom: "1px solid var(--card-border, #e2e8f0)",
          boxShadow: "0 10px 30px rgba(15, 23, 42, 0.08)",
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            margin: "0 auto",
            padding: "14px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            {logoUrl ? (
              <img src={logoUrl} alt={companyName || "Logo da empresa"} style={{ height: 36, maxWidth: 180, objectFit: "contain" }} />
            ) : (
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--icon-circle-bg, #F07B24)",
                  color: "var(--icon-circle-text, #fff)",
                  fontSize: 20,
                }}
              >
                ☀️
              </div>
            )}

            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 11, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--nav-text, #64748B)", fontWeight: 700 }}>
                Preview Final
              </p>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "var(--body-text, #1e293b)" }}>
                {companyName || "Mais Energia Solar"}
              </p>
            </div>
          </div>

          {visibleSections.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {visibleSections.map((section, index) => (
                <Button
                  key={section.id}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 rounded-full text-xs"
                  style={{
                    background: "var(--hero-overlay, rgba(240,123,36,0.04))",
                    borderColor: "var(--hero-overlay-border, rgba(240,123,36,0.15))",
                    color: "var(--body-text, #1e293b)",
                  }}
                  onClick={() => {
                    document.getElementById(`${anchorPrefixRef.current}${section.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  {index === 0 ? "Início" : `Seção ${index + 1}`}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      <TemplateHtmlRenderer
        blocks={blocks}
        variables={variables}
        sectionAnchorPrefix={anchorPrefixRef.current}
      />

      <footer
        style={{
          padding: "24px 20px 32px",
          textAlign: "center",
          color: "var(--nav-text, #64748B)",
          fontSize: 12,
          background: "var(--fundo, #F8FAFC)",
        }}
      >
        <p style={{ margin: 0 }}>Visualização do template como página final da proposta web.</p>
      </footer>
    </div>
  );
}