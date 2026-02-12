import { cn } from "@/lib/utils";

interface WhatsAppPreviewProps {
  message: string;
  className?: string;
}

const SAMPLE_VARS: Record<string, string> = {
  "{nome}": "João Silva",
  "{cidade}": "Belo Horizonte",
  "{estado}": "MG",
  "{consumo}": "450",
  "{vendedor}": "Maria Souza",
};

function renderPreviewMessage(msg: string): string {
  let result = msg;
  for (const [key, value] of Object.entries(SAMPLE_VARS)) {
    result = result.split(key).join(value);
  }
  // Bold: *text* → <b>text</b>
  result = result.replace(/\*([^*]+)\*/g, "<b>$1</b>");
  // Italic: _text_ → <i>text</i>
  result = result.replace(/_([^_]+)_/g, "<i>$1</i>");
  // Line breaks
  result = result.replace(/\n/g, "<br/>");
  return result;
}

export function WhatsAppPreview({ message, className }: WhatsAppPreviewProps) {
  if (!message) {
    return (
      <div className={cn("rounded-lg bg-muted/50 p-4 text-center text-sm text-muted-foreground", className)}>
        Digite uma mensagem para ver o preview
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl overflow-hidden", className)}>
      {/* WA Header */}
      <div className="bg-[#075e54] px-4 py-2.5 flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white text-xs font-bold">
          JS
        </div>
        <div>
          <p className="text-white text-sm font-medium">João Silva</p>
          <p className="text-white/70 text-[11px]">online</p>
        </div>
      </div>
      {/* WA Chat area */}
      <div
        className="p-3 min-h-[120px]"
        style={{
          backgroundColor: "#e5ddd5",
          backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      >
        {/* Outgoing bubble */}
        <div className="flex justify-end">
          <div className="bg-[#dcf8c6] rounded-lg px-3 py-2 max-w-[85%] shadow-sm relative">
            <p
              className="text-[13px] text-[#303030] leading-relaxed whitespace-pre-wrap"
              dangerouslySetInnerHTML={{ __html: renderPreviewMessage(message) }}
            />
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[10px] text-[#7d7d7d]">14:32</span>
              <svg width="16" height="11" viewBox="0 0 16 11" className="text-[#53bdeb]">
                <path fill="currentColor" d="M11.07 0L5.96 5.09 4.07 3.2 3.12 4.15l2.84 2.84 6.06-6.06L11.07 0zM7.96 5.09L7.01 6.04l-2.84-2.84-.95.95 3.79 3.79 6.06-6.06-.95-.95-5.16 5.16z" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export { SAMPLE_VARS };
