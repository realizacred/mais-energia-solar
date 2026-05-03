/**
 * SimpleContentEditor — Editor de texto formatado para usuários leigos.
 * Substitui o textarea de HTML cru. Permite negrito/itálico/link e inserção de variáveis
 * via toolbar. Modo avançado (HTML) continua disponível como fallback.
 */
import { useEffect, useRef, useState } from "react";
import { Bold, Italic, Underline, Link as LinkIcon, Code2, Variable, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { ImagePicker } from "./ImagePicker";

interface Props {
  value: string;
  onChange: (next: string) => void;
}

const QUICK_VARIABLES: Array<{ key: string; label: string }> = [
  { key: "cliente_nome", label: "Nome do cliente" },
  { key: "cliente_cidade", label: "Cidade do cliente" },
  { key: "cliente_estado", label: "Estado" },
  { key: "empresa_nome", label: "Nome da empresa" },
  { key: "empresa_logo_url", label: "Logo da empresa" },
  { key: "consultor_nome", label: "Nome do consultor" },
  { key: "consultor_telefone", label: "Telefone do consultor" },
  { key: "potencia_kwp", label: "Potência (kWp)" },
  { key: "modulo_quantidade", label: "Quantidade de painéis" },
  { key: "modulo_fabricante", label: "Fabricante do módulo" },
  { key: "modulo_modelo", label: "Modelo do módulo" },
  { key: "inversor_fabricante", label: "Fabricante do inversor" },
  { key: "inversor_modelo", label: "Modelo do inversor" },
  { key: "valor_total", label: "Valor total da proposta" },
  { key: "economia_mensal", label: "Economia mensal (R$)" },
  { key: "economia_anual", label: "Economia anual (R$)" },
  { key: "economia_25_anos", label: "Economia em 25 anos" },
  { key: "payback", label: "Payback (anos)" },
  { key: "geracao_mensal", label: "Geração média mensal" },
];

export function SimpleContentEditor({ value, onChange }: Props) {
  const [advanced, setAdvanced] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const lastValueRef = useRef<string>(value);

  // Sync from outside without losing caret
  useEffect(() => {
    if (advanced) return;
    if (ref.current && value !== lastValueRef.current && value !== ref.current.innerHTML) {
      ref.current.innerHTML = value || "";
      lastValueRef.current = value || "";
    }
  }, [value, advanced]);

  const exec = (cmd: string, arg?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, arg);
    handleInput();
  };

  const handleInput = () => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    lastValueRef.current = html;
    onChange(html);
  };

  const insertVariable = (key: string) => {
    ref.current?.focus();
    const token = `{{${key}}}`;
    if (!document.execCommand("insertText", false, token)) {
      // fallback
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        range.deleteContents();
        range.insertNode(document.createTextNode(token));
      }
    }
    handleInput();
  };

  const insertLink = () => {
    const url = prompt("Cole o link (URL):");
    if (url) exec("createLink", url);
  };

  const insertImage = (url: string) => {
    ref.current?.focus();
    const html = `<img src="${url}" alt="" style="max-width:100%;height:auto;border-radius:6px;margin:8px 0;" />`;
    if (!document.execCommand("insertHTML", false, html)) {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const div = document.createElement("div");
        div.innerHTML = html;
        const node = div.firstChild;
        if (node) range.insertNode(node);
      }
    }
    handleInput();
  };

  if (advanced) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            Modo avançado (HTML)
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-[11px]"
            onClick={() => setAdvanced(false)}
          >
            Voltar ao modo simples
          </Button>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={10}
          className="text-xs font-mono"
        />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Toolbar */}
      <div className="flex items-center gap-1 flex-wrap rounded-md border bg-muted/30 p-1">
        <ToolbarButton icon={Bold} title="Negrito" onClick={() => exec("bold")} />
        <ToolbarButton icon={Italic} title="Itálico" onClick={() => exec("italic")} />
        <ToolbarButton icon={Underline} title="Sublinhado" onClick={() => exec("underline")} />
        <ToolbarButton icon={LinkIcon} title="Inserir link" onClick={insertLink} />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="h-7 w-7"
              title="Inserir imagem"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3" align="start">
            <ImagePicker onSelect={insertImage} compact />
          </PopoverContent>
        </Popover>

        <div className="h-4 w-px bg-border mx-1" />

        <Popover>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-[11px]"
              title="Inserir variável"
            >
              <Variable className="h-3.5 w-3.5" />
              Variável
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <p className="text-[10px] text-muted-foreground mb-2 px-1">
              Será substituída automaticamente pelos dados reais
            </p>
            <ScrollArea className="h-64">
              <div className="space-y-0.5">
                {QUICK_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key)}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-muted text-xs flex flex-col gap-0.5"
                  >
                    <span className="font-medium text-foreground">{v.label}</span>
                    <code className="text-[9px] text-muted-foreground font-mono">
                      {`{{${v.key}}}`}
                    </code>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        <div className="ml-auto">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1 text-[10px] text-muted-foreground"
            onClick={() => setAdvanced(true)}
            title="Editar HTML diretamente"
          >
            <Code2 className="h-3 w-3" />
            HTML
          </Button>
        </div>
      </div>

      {/* Editor */}
      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={handleInput}
        className={cn(
          "min-h-[120px] max-h-[280px] overflow-auto rounded-md border bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-primary/40",
          "[&_p]:my-1 [&_strong]:font-bold [&_em]:italic [&_a]:text-primary [&_a]:underline"
        )}
        dangerouslySetInnerHTML={{ __html: value || "" }}
      />
      <p className="text-[10px] text-muted-foreground">
        Selecione um texto para formatar ou use <strong>Variável</strong> para inserir dados do cliente.
      </p>
    </div>
  );
}

function ToolbarButton({
  icon: Icon,
  title,
  onClick,
}: {
  icon: typeof Bold;
  title: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      title={title}
      onClick={onClick}
      className="h-7 w-7"
    >
      <Icon className="h-3.5 w-3.5" />
    </Button>
  );
}
