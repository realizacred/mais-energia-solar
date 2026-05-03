/**
 * Properties Panel — Right sidebar for editing selected block properties
 */

import { useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, Eye, EyeOff, Type, Palette, Box, Layout } from "lucide-react";
import type { TemplateBlock, BlockStyle } from "./types";
import { cn } from "@/lib/utils";
import { SEMANTIC_BLOCK_LABELS, isSemanticProposalBlock } from "./semanticBlockLabels";

interface PropertiesPanelProps {
  block: TemplateBlock;
  onUpdate: (updates: Partial<TemplateBlock>) => void;
}

function Section({ title, icon: Icon, children, defaultOpen = true }: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Collapsible defaultOpen={defaultOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-2.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors border-b border-border/40 group">
        <span className="flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5" />
          {title}
        </span>
        <ChevronDown className="h-3 w-3 transition-transform group-data-[state=closed]:-rotate-90" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="p-4 space-y-3 border-b border-border/40">
          {children}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</Label>
      {children}
    </div>
  );
}

export function PropertiesPanel({ block, onUpdate }: PropertiesPanelProps) {
  const updateStyle = useCallback((key: keyof BlockStyle, value: unknown) => {
    onUpdate({ style: { ...block.style, [key]: value } });
  }, [block.style, onUpdate]);

  const isContainer = ["section", "column", "inner_section"].includes(block.type);

  return (
    <div className="w-[280px] border-l border-border bg-card flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold text-foreground capitalize">{block.type}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">
            {block.id}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onUpdate({ isVisible: !block.isVisible })}
          className={cn(!block.isVisible && "text-destructive")}
        >
          {block.isVisible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {/* Content */}
        {!isContainer && (
          <Section title="Conteúdo" icon={Type}>
            {block.type === "editor" ? (
              <Field label="HTML">
                <Textarea
                  value={block.content}
                  onChange={e => onUpdate({ content: e.target.value })}
                  rows={6}
                  className="text-xs font-mono"
                  placeholder="<p>Seu conteúdo HTML...</p>"
                />
              </Field>
            ) : block.type === "image" ? (
              <Field label="URL da Imagem">
                <Input
                  value={block.content}
                  onChange={e => onUpdate({ content: e.target.value })}
                  className="text-xs"
                  placeholder="https://..."
                />
              </Field>
            ) : block.type === "button" ? (
              <Field label="Texto do Botão">
                <Input
                  value={block.content}
                  onChange={e => onUpdate({ content: e.target.value })}
                  className="text-xs"
                  placeholder="Clique aqui"
                />
              </Field>
            ) : block.type === "video" ? (
              <Field label="URL do Vídeo">
                <Input
                  value={block.content}
                  onChange={e => onUpdate({ content: e.target.value })}
                  className="text-xs"
                  placeholder="https://youtube.com/..."
                />
              </Field>
            ) : null}
          </Section>
        )}

        {/* Layout */}
        {isContainer && (
          <Section title="Layout" icon={Layout}>
            {block.type === "column" && (
              <Field label={`Largura: ${block.style.width ?? 100}%`}>
                <Slider
                  value={[Number(block.style.width ?? 100)]}
                  onValueChange={([v]) => updateStyle("width", v)}
                  min={10}
                  max={100}
                  step={5}
                />
              </Field>
            )}
            {block.type === "section" && (
              <Field label="Largura do Conteúdo">
                <Select
                  value={String(block.style.contentWidth ?? "boxed")}
                  onValueChange={v => updateStyle("contentWidth", v)}
                >
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="boxed">Contido (1200px)</SelectItem>
                    <SelectItem value="full">Largura total</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            )}
            <Field label="Alinhamento Vertical">
              <Select
                value={String(block.style.alignItems ?? "stretch")}
                onValueChange={v => updateStyle("alignItems", v)}
              >
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flex-start">Topo</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="flex-end">Base</SelectItem>
                  <SelectItem value="stretch">Esticar</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Distribuição Horizontal">
              <Select
                value={String(block.style.justifyContent ?? "center")}
                onValueChange={v => updateStyle("justifyContent", v)}
              >
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="flex-start">Início</SelectItem>
                  <SelectItem value="center">Centro</SelectItem>
                  <SelectItem value="flex-end">Fim</SelectItem>
                  <SelectItem value="space-between">Espaçado</SelectItem>
                  <SelectItem value="space-around">Distribuído</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </Section>
        )}

        {/* Typography */}
        {!isContainer && block.type !== "divider" && block.type !== "image" && (
          <Section title="Tipografia" icon={Type} defaultOpen={false}>
            <Field label="Família">
              <Select
                value={String(block.style.fontFamily ?? "Inter")}
                onValueChange={v => updateStyle("fontFamily", v)}
              >
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Inter">Inter</SelectItem>
                  <SelectItem value="Poppins">Poppins</SelectItem>
                  <SelectItem value="Montserrat">Montserrat</SelectItem>
                  <SelectItem value="Open Sans">Open Sans</SelectItem>
                  <SelectItem value="Roboto">Roboto</SelectItem>
                  <SelectItem value="Lato">Lato</SelectItem>
                  <SelectItem value="Playfair Display">Playfair Display</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Tamanho (px)">
                <Input
                  type="number"
                  value={block.style.fontSize ?? "16"}
                  onChange={e => updateStyle("fontSize", e.target.value)}
                  className="text-xs"
                  min={8}
                  max={120}
                />
              </Field>
              <Field label="Peso">
                <Select
                  value={String(block.style.fontWeight ?? "400")}
                  onValueChange={v => updateStyle("fontWeight", v)}
                >
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="300">Light</SelectItem>
                    <SelectItem value="400">Regular</SelectItem>
                    <SelectItem value="500">Medium</SelectItem>
                    <SelectItem value="600">Semibold</SelectItem>
                    <SelectItem value="700">Bold</SelectItem>
                    <SelectItem value="800">Extra Bold</SelectItem>
                    <SelectItem value="900">Black</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Alinhamento">
              <div className="flex gap-1">
                {(["left", "center", "right", "justify"] as const).map(align => (
                  <Button
                    key={align}
                    variant={block.style.textAlign === align ? "default" : "outline"}
                    size="sm"
                    className="flex-1 h-7 text-[10px]"
                    onClick={() => updateStyle("textAlign", align)}
                  >
                    {align === "left" ? "E" : align === "center" ? "C" : align === "right" ? "D" : "J"}
                  </Button>
                ))}
              </div>
            </Field>
            <Field label="Cor do texto">
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={block.style.color ?? "#1E293B"}
                  onChange={e => updateStyle("color", e.target.value)}
                  className="w-8 h-8 rounded border border-border cursor-pointer"
                />
                <Input
                  value={block.style.color ?? "#1E293B"}
                  onChange={e => updateStyle("color", e.target.value)}
                  className="text-xs font-mono flex-1"
                />
              </div>
            </Field>
          </Section>
        )}

        {/* Background & Colors */}
        <Section title="Cores e Fundo" icon={Palette} defaultOpen={false}>
          <Field label="Cor de fundo">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={block.style.backgroundColor ?? "#FFFFFF"}
                onChange={e => updateStyle("backgroundColor", e.target.value)}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <Input
                value={block.style.backgroundColor ?? "transparent"}
                onChange={e => updateStyle("backgroundColor", e.target.value)}
                className="text-xs font-mono flex-1"
              />
            </div>
          </Field>
          <Field label="Gradiente">
            <div className="flex items-center gap-2 mb-2">
              <Switch
                checked={!!block.style.useGradient}
                onCheckedChange={v => updateStyle("useGradient", v)}
              />
              <span className="text-[10px] text-muted-foreground">Usar gradiente</span>
            </div>
            {block.style.useGradient && (
              <div className="grid grid-cols-2 gap-2">
                <Field label="Início">
                  <div className="flex gap-1 items-center">
                    <input
                      type="color"
                      value={block.style.gradientStart ?? "#3B82F6"}
                      onChange={e => updateStyle("gradientStart", e.target.value)}
                      className="w-6 h-6 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={block.style.gradientStart ?? ""}
                      onChange={e => updateStyle("gradientStart", e.target.value)}
                      className="text-[10px] font-mono"
                    />
                  </div>
                </Field>
                <Field label="Fim">
                  <div className="flex gap-1 items-center">
                    <input
                      type="color"
                      value={block.style.gradientEnd ?? "#8B5CF6"}
                      onChange={e => updateStyle("gradientEnd", e.target.value)}
                      className="w-6 h-6 rounded border border-border cursor-pointer"
                    />
                    <Input
                      value={block.style.gradientEnd ?? ""}
                      onChange={e => updateStyle("gradientEnd", e.target.value)}
                      className="text-[10px] font-mono"
                    />
                  </div>
                </Field>
                <Field label={`Ângulo: ${block.style.staticGradientAngle ?? 180}°`}>
                  <Slider
                    value={[Number(block.style.staticGradientAngle ?? 180)]}
                    onValueChange={([v]) => updateStyle("staticGradientAngle", v)}
                    min={0}
                    max={360}
                    step={15}
                  />
                </Field>
              </div>
            )}
          </Field>
        </Section>

        {/* Spacing */}
        <Section title="Espaçamento" icon={Box} defaultOpen={false}>
          <Field label="Margem (px)">
            <div className="grid grid-cols-4 gap-1.5">
              {(["marginTop", "marginRight", "marginBottom", "marginLeft"] as const).map(k => (
                <div key={k} className="space-y-0.5">
                  <span className="text-[8px] text-muted-foreground block text-center">
                    {k === "marginTop" ? "↑" : k === "marginRight" ? "→" : k === "marginBottom" ? "↓" : "←"}
                  </span>
                  <Input
                    type="number"
                    value={block.style[k] ?? "0"}
                    onChange={e => updateStyle(k, e.target.value)}
                    className="text-[10px] h-7 text-center px-1"
                    min={0}
                    max={200}
                  />
                </div>
              ))}
            </div>
          </Field>
          <Field label="Padding (px)">
            <div className="grid grid-cols-4 gap-1.5">
              {(["paddingTop", "paddingRight", "paddingBottom", "paddingLeft"] as const).map(k => (
                <div key={k} className="space-y-0.5">
                  <span className="text-[8px] text-muted-foreground block text-center">
                    {k === "paddingTop" ? "↑" : k === "paddingRight" ? "→" : k === "paddingBottom" ? "↓" : "←"}
                  </span>
                  <Input
                    type="number"
                    value={block.style[k] ?? "0"}
                    onChange={e => updateStyle(k, e.target.value)}
                    className="text-[10px] h-7 text-center px-1"
                    min={0}
                    max={200}
                  />
                </div>
              ))}
            </div>
          </Field>
        </Section>

        {/* Border & Shadow */}
        <Section title="Borda e Sombra" icon={Box} defaultOpen={false}>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Espessura (px)">
              <Input
                type="number"
                value={block.style.borderWidth ?? "0"}
                onChange={e => updateStyle("borderWidth", e.target.value)}
                className="text-xs"
                min={0}
                max={20}
              />
            </Field>
            <Field label="Raio (px)">
              <Input
                type="number"
                value={block.style.borderRadius ?? "0"}
                onChange={e => updateStyle("borderRadius", e.target.value)}
                className="text-xs"
                min={0}
                max={100}
              />
            </Field>
          </div>
          <Field label="Cor da borda">
            <div className="flex gap-2 items-center">
              <input
                type="color"
                value={block.style.borderColor ?? "#E2E8F0"}
                onChange={e => updateStyle("borderColor", e.target.value)}
                className="w-8 h-8 rounded border border-border cursor-pointer"
              />
              <Input
                value={block.style.borderColor ?? "#E2E8F0"}
                onChange={e => updateStyle("borderColor", e.target.value)}
                className="text-xs font-mono flex-1"
              />
            </div>
          </Field>
          <Field label="Sombra">
            <Select
              value={block.style.boxShadow ?? "none"}
              onValueChange={v => updateStyle("boxShadow", v)}
            >
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="0 1px 3px rgba(0,0,0,0.12)">Suave</SelectItem>
                <SelectItem value="0 4px 14px rgba(0,0,0,0.1)">Média</SelectItem>
                <SelectItem value="0 10px 40px rgba(0,0,0,0.15)">Forte</SelectItem>
                <SelectItem value="0 20px 60px rgba(0,0,0,0.2)">Dramática</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </Section>

        {/* Animation */}
        <Section title="Animação" icon={Eye} defaultOpen={false}>
          <Field label="Efeito de entrada">
            <Select
              value={block.style.animation ?? "none"}
              onValueChange={v => updateStyle("animation", v)}
            >
              <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Nenhuma</SelectItem>
                <SelectItem value="fadeIn">Fade In</SelectItem>
                <SelectItem value="slideUp">Subir</SelectItem>
                <SelectItem value="slideLeft">Da Esquerda</SelectItem>
                <SelectItem value="slideRight">Da Direita</SelectItem>
                <SelectItem value="zoomIn">Zoom In</SelectItem>
                <SelectItem value="bounceIn">Bounce</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label={`Duração: ${block.style.animationDuration ?? "0.5"}s`}>
            <Slider
              value={[Number(block.style.animationDuration ?? 0.5) * 10]}
              onValueChange={([v]) => updateStyle("animationDuration", String(v / 10))}
              min={1}
              max={20}
              step={1}
            />
          </Field>
        </Section>
      </ScrollArea>
    </div>
  );
}
