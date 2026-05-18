import { useState, useRef, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info, MessageCircle, AlertCircle, Loader2 } from "lucide-react";
import { VARIABLES_CATALOG } from "@/lib/variablesCatalog";
import { useWaInstances } from "@/hooks/useWaInstances";
import { useAuth } from "@/hooks/useAuth";

interface AutomationWhatsAppFormProps {
  config: any;
  updateConfig: (patch: any) => void;
}

export function AutomationWhatsAppForm({ config, updateConfig }: AutomationWhatsAppFormProps) {
  const { user } = useAuth();
  const { instances, loading: loadingInstances } = useWaInstances();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [activeTab, setActiveTab] = useState<string>(config.wa_message_type || 'text');

  const connectedInstances = instances.filter(i => i.status === 'connected');

  // Auto-select instance if only one is available
  useEffect(() => {
    if (!config.wa_instance_id && connectedInstances.length === 1) {
      updateConfig({ wa_instance_id: connectedInstances[0].id });
    }
  }, [connectedInstances, config.wa_instance_id]);

  const insertVariable = (variable: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = config.wa_content_template || "";
    const before = text.substring(0, start);
    const after = text.substring(end);
    const newText = before + variable + after;

    updateConfig({ wa_content_template: newText });
    
    // Focus back and set cursor position (need to wait for React render)
    setTimeout(() => {
      textarea.focus();
      const newPos = start + variable.length;
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const variableGroups = [
    { label: "👤 Cliente", filter: "cliente" },
    { label: "📁 Projeto", filter: "projeto" },
    { label: "📄 Proposta", filter: "proposta" },
    { label: "👷 Responsável", filter: "responsavel" },
    { label: "📅 Sistema", filter: "sistema" },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-top-2">
      {/* DESTINATÁRIO */}
      <div className="space-y-3">
        <Label className="text-sm font-bold">Enviar para</Label>
        <RadioGroup 
          value={config.wa_destinatario_tipo || 'cliente'} 
          onValueChange={(v) => updateConfig({ wa_destinatario_tipo: v })}
          className="grid grid-cols-1 gap-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="cliente" id="wa-dest-cliente" />
            <Label htmlFor="wa-dest-cliente" className="font-normal cursor-pointer">Telefone do cliente do projeto</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="responsavel" id="wa-dest-responsavel" />
            <Label htmlFor="wa-dest-responsavel" className="font-normal cursor-pointer">Responsável pelo projeto</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="fixo" id="wa-dest-fixo" />
            <Label htmlFor="wa-dest-fixo" className="font-normal cursor-pointer">Número fixo</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="variavel" id="wa-dest-variavel" />
            <Label htmlFor="wa-dest-variavel" className="font-normal cursor-pointer">Variável dinâmica</Label>
          </div>
        </RadioGroup>

        {config.wa_destinatario_tipo === 'fixo' && (
          <Input 
            placeholder="Digite o número (ex: 5531999999999)"
            value={config.wa_destinatario_valor || ''}
            onChange={(e) => updateConfig({ wa_destinatario_valor: e.target.value })}
            className="mt-2"
          />
        )}

        {config.wa_destinatario_tipo === 'variavel' && (
          <Select 
            value={config.wa_destinatario_valor} 
            onValueChange={(v) => updateConfig({ wa_destinatario_valor: v })}
          >
            <SelectTrigger className="mt-2">
              <SelectValue placeholder="Selecione a variável" />
            </SelectTrigger>
            <SelectContent>
              {VARIABLES_CATALOG.filter(v => v.description.toLowerCase().includes("telefone") || v.label.toLowerCase().includes("telefone")).map(v => (
                <SelectItem key={v.canonicalKey} value={v.canonicalKey}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* TIPO DE MENSAGEM */}
      <div className="space-y-3">
        <Label className="text-sm font-bold">Tipo de conteúdo</Label>
        <Tabs value={activeTab} onValueChange={(v) => {
          setActiveTab(v);
          updateConfig({ wa_message_type: v });
        }} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="text" className="text-xs">Texto</TabsTrigger>
            <TabsTrigger value="image" className="text-xs">Imagem</TabsTrigger>
            <TabsTrigger value="document" className="text-xs">Doc</TabsTrigger>
            <TabsTrigger value="audio" className="text-xs">Áudio</TabsTrigger>
          </TabsList>
        </Tabs>

        {activeTab === 'text' && (
          <div className="space-y-2">
            <Label className="text-xs">Mensagem</Label>
            <Textarea 
              ref={textareaRef}
              value={config.wa_content_template || ''}
              onChange={(e) => updateConfig({ wa_content_template: e.target.value })}
              placeholder="Digite sua mensagem..."
              rows={5}
            />
          </div>
        )}

        {activeTab === 'image' && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">URL da imagem</Label>
              <Input 
                value={config.wa_media_url || ''}
                onChange={(e) => updateConfig({ wa_media_url: e.target.value })}
                placeholder="https://exemplo.com/imagem.jpg"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Legenda (Opcional)</Label>
              <Textarea 
                ref={textareaRef}
                value={config.wa_content_template || ''}
                onChange={(e) => updateConfig({ wa_content_template: e.target.value })}
                placeholder="Legenda da imagem..."
                rows={3}
              />
            </div>
          </div>
        )}

        {activeTab === 'document' && (
          <div className="space-y-4">
            <div className="space-y-3">
              <Label className="text-xs">Origem do Documento</Label>
              <RadioGroup 
                value={config.wa_doc_origin || 'fixo'} 
                onValueChange={(v) => updateConfig({ wa_doc_origin: v })}
                className="grid grid-cols-1 gap-2"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="fixo" id="doc-fixo" />
                  <Label htmlFor="doc-fixo" className="font-normal text-xs cursor-pointer">Link fixo</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="proposta" id="doc-proposta" />
                  <Label htmlFor="doc-proposta" className="font-normal text-xs cursor-pointer">Link da proposta vinculada</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="variavel" id="doc-variavel" />
                  <Label htmlFor="doc-variavel" className="font-normal text-xs cursor-pointer">Variável</Label>
                </div>
              </RadioGroup>
            </div>

            {config.wa_doc_origin === 'fixo' && (
              <Input 
                placeholder="https://exemplo.com/documento.pdf"
                value={config.wa_media_url || ''}
                onChange={(e) => updateConfig({ wa_media_url: e.target.value })}
              />
            )}

            {config.wa_doc_origin === 'variavel' && (
              <Select 
                value={config.wa_media_url} 
                onValueChange={(v) => updateConfig({ wa_media_url: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a variável" />
                </SelectTrigger>
                <SelectContent>
                  {VARIABLES_CATALOG.filter(v => v.description.toLowerCase().includes("pdf") || v.label.toLowerCase().includes("link")).map(v => (
                    <SelectItem key={v.canonicalKey} value={v.canonicalKey}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="space-y-2">
              <Label className="text-xs">Nome do arquivo (Opcional)</Label>
              <Input 
                value={config.wa_media_filename || ''}
                onChange={(e) => updateConfig({ wa_media_filename: e.target.value })}
                placeholder="Proposta_{{cliente.nome}}.pdf"
              />
            </div>
          </div>
        )}

        {activeTab === 'audio' && (
          <div className="space-y-2">
            <Label className="text-xs">URL do áudio</Label>
            <Input 
              value={config.wa_media_url || ''}
              onChange={(e) => updateConfig({ wa_media_url: e.target.value })}
              placeholder="https://exemplo.com/audio.mp3"
            />
          </div>
        )}

        {/* VARIÁVEIS DISPONÍVEIS */}
        <div className="space-y-3 pt-2">
          <Label className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">Variáveis Disponíveis</Label>
          <div className="space-y-3">
            {variableGroups.map(group => (
              <div key={group.label} className="space-y-1.5">
                <p className="text-[10px] font-semibold text-muted-foreground/80">{group.label}</p>
                <div className="flex flex-wrap gap-1.5">
                  {VARIABLES_CATALOG
                    .filter(v => v.canonicalKey.includes(group.filter))
                    .slice(0, 6)
                    .map(v => (
                      <button
                        key={v.canonicalKey}
                        onClick={() => insertVariable(v.canonicalKey)}
                        className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded text-[10px] font-medium border border-teal-100 transition-colors"
                      >
                        {v.label}
                      </button>
                    ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* INSTÂNCIA WHATSAPP */}
      <div className="space-y-3 pt-2 border-t">
        <Label className="text-sm font-bold">Instância WhatsApp</Label>
        {loadingInstances ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            Carregando instâncias...
          </div>
        ) : connectedInstances.length > 0 ? (
          <Select 
            value={config.wa_instance_id} 
            onValueChange={(v) => updateConfig({ wa_instance_id: v })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione a instância conectada" />
            </SelectTrigger>
            <SelectContent>
              {connectedInstances.map(inst => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.nome} ({inst.phone_number || 'Sem número'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Alert variant="destructive" className="py-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Nenhuma instância conectada encontrada.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* AGENDAMENTO */}
      <div className="space-y-4 pt-4 border-t">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-bold cursor-pointer" htmlFor="wa-schedule">Agendar envio</Label>
          <Switch 
            id="wa-schedule" 
            checked={config.wa_schedule_enabled || false} 
            onCheckedChange={(v) => updateConfig({ wa_schedule_enabled: v })}
          />
        </div>

        {config.wa_schedule_enabled && (
          <div className="space-y-4 animate-in zoom-in-95 duration-200">
            <RadioGroup 
              value={config.wa_schedule_tipo || 'horas'} 
              onValueChange={(v) => updateConfig({ wa_schedule_tipo: v })}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="horas" id="sched-horas" />
                <Label htmlFor="sched-horas" className="text-xs cursor-pointer">Após X horas</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dias" id="sched-dias" />
                <Label htmlFor="sched-dias" className="text-xs cursor-pointer">Após X dias</Label>
              </div>
            </RadioGroup>
            
            <div className="flex items-center gap-3">
              <Input 
                type="number"
                min="1"
                placeholder="Ex: 2"
                value={config.wa_scheduled_valor || ''}
                onChange={(e) => updateConfig({ wa_scheduled_valor: parseInt(e.target.value) })}
                className="w-24"
              />
              <span className="text-xs text-muted-foreground">
                {config.wa_schedule_tipo === 'dias' ? 'dia(s)' : 'hora(s)'} após o gatilho
              </span>
            </div>
          </div>
        )}
      </div>

      <Alert className="bg-teal-50 border-teal-100 mt-4">
        <Info className="h-4 w-4 text-teal-600" />
        <AlertDescription className="text-[10px] text-teal-800 leading-relaxed">
          RB-105: O envio utiliza diretamente a Evolution API através do sistema de fila. 
          Nenhum link externo wa.me é gerado.
        </AlertDescription>
      </Alert>
    </div>
  );
}
