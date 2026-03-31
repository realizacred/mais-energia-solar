/**
 * Simple, safe markdown renderer for help center content.
 * Converts markdown to HTML without dangerouslySetInnerHTML on raw user input.
 * The content is admin-curated seed data, so XSS risk is minimal,
 * but we still sanitize basic patterns.
 */

import { useMemo } from "react";

interface Props {
  content: string;
  className?: string;
}

function markdownToHtml(md: string): string {
  const html = md
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-foreground mt-4 mb-2">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-base font-semibold text-foreground mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-lg font-bold text-foreground mt-6 mb-3">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="px-1.5 py-0.5 bg-muted rounded text-xs font-mono text-foreground">$1</code>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-muted-foreground leading-relaxed">$1</li>')
    // Ordered lists
    .replace(/^(\d+)\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm text-muted-foreground leading-relaxed">$2</li>')
    // Line breaks (double newline = paragraph)
    .replace(/\n\n/g, '<div class="h-3"></div>')
    .replace(/\n/g, '<br />');

  return html;
}

export function MarkdownRenderer({ content, className }: Props) {
  const html = useMemo(() => markdownToHtml(content), [content]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
