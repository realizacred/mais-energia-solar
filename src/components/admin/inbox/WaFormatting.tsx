import React from "react";

/** Render WhatsApp formatted text with clickable links */
export function renderFormattedText(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const urlParts = text.split(urlRegex);

  return (
    <>
      {urlParts.map((part, i) => {
        if (urlRegex.test(part)) {
          urlRegex.lastIndex = 0;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{applyWhatsAppFormatting(part)}</span>;
      })}
    </>
  );
}

function applyWhatsAppFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { regex: /\*([^*]+)\*/, tag: "strong" },
    { regex: /_([^_]+)_/, tag: "em" },
    { regex: /~([^~]+)~/, tag: "s" },
  ];

  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; content: string; tag: string } | null = null;

    for (const { regex, tag } of patterns) {
      const match = remaining.match(regex);
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            content: match[1],
            tag,
          };
        }
      }
    }

    if (earliestMatch) {
      if (earliestMatch.index > 0) {
        parts.push(remaining.substring(0, earliestMatch.index));
      }
      const Tag = earliestMatch.tag as any;
      parts.push(<Tag key={key++}>{earliestMatch.content}</Tag>);
      remaining = remaining.substring(earliestMatch.index + earliestMatch.length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return <>{parts}</>;
}
