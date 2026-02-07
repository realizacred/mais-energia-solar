import { useState, useRef } from "react";
 import { motion, AnimatePresence } from "framer-motion";
 import { Button } from "@/components/ui/button";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
 import { Label } from "@/components/ui/label";
 import { Checkbox } from "@/components/ui/checkbox";
 import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { PhotoCapture } from "@/components/checklist/PhotoCapture";
 import { SignaturePad, SignaturePadRef } from "@/components/checklist/SignaturePad";
 import { supabase } from "@/integrations/supabase/client";
 import { toast } from "@/hooks/use-toast";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import {
   Camera,
   Check,
   CheckCircle2,
   Clock,
   ClipboardCheck,
   Loader2,
   MapPin,
   User,
   Calendar,
   Play,
   X,
   ChevronLeft,
   ChevronRight,
   Sun,
   Zap,
   Wifi,
   Wrench,
  Trash2,
  FileCheck,
  PenTool,
  Mic,
  Square,
  Volume2,
   Video,
   Grid3X3,
 } from "lucide-react";
 import { cn } from "@/lib/utils";
import logoWhite from "@/assets/logo-branca.png";
import logoBlue from "@/assets/logo.png";
 import { VideoCapture } from "./VideoCapture";
  import { SolarLayoutEditor, type LayoutData } from "@/components/solar-editor";
 
 interface ServicoAgendado {
   id: string;
   tipo: "instalacao" | "manutencao" | "visita_tecnica" | "suporte";
   status: "agendado" | "em_andamento" | "concluido" | "cancelado" | "reagendado";
   data_agendada: string;
   hora_inicio: string | null;
   hora_fim: string | null;
   data_hora_inicio: string | null;
   data_hora_fim: string | null;
   endereco: string | null;
   bairro: string | null;
   cidade: string | null;
   descricao: string | null;
   observacoes: string | null;
   observacoes_conclusao: string | null;
   fotos_urls: string[] | null;
   cliente: { nome: string; telefone: string } | null;
 }
 
 interface ServicoEmAndamentoProps {
   servico: ServicoAgendado;
   onClose: () => void;
   onServiceUpdated: () => void;
 }
 
 const tipoLabels: Record<string, string> = {
   instalacao: "Instalação Solar",
   manutencao: "Manutenção",
   visita_tecnica: "Visita Técnica",
   suporte: "Suporte/Reparo",
 };
 
 export function ServicoEmAndamento({ servico, onClose, onServiceUpdated }: ServicoEmAndamentoProps) {
   const [currentStep, setCurrentStep] = useState(1);
   const [isSubmitting, setIsSubmitting] = useState(false);
   const [isSuccess, setIsSuccess] = useState(false);
   
  // Checklist items with checkbox and multiple photos
  const [checklistItems, setChecklistItems] = useState<{
    [key: string]: { checked: boolean; photos: string[]; extraData?: string };
  }>({
    placas_local_aprovado: { checked: false, photos: [] },
    inversor_local_aprovado: { checked: false, photos: [] },
    adesivo_inversor: { checked: false, photos: [] },
    plaquinha_relogio: { checked: false, photos: [] },
    configuracao_wifi: { checked: false, photos: [], extraData: '' },
   });
   
   const [observacoes, setObservacoes] = useState(servico.observacoes_conclusao || "");
  const [fotosExtras, setFotosExtras] = useState<string[]>([]);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
   const [videoUrl, setVideoUrl] = useState<string | null>(null);
   const [savedLayoutId, setSavedLayoutId] = useState<string | null>(null);
   const [layoutModuleCount, setLayoutModuleCount] = useState(0);
   const [isLayoutEditorOpen, setIsLayoutEditorOpen] = useState(false);
   
   // Signatures
   const [installerSignature, setInstallerSignature] = useState<string | null>(null);
   const installerSignatureRef = useRef<SignaturePadRef>(null);
 
  const totalSteps = 2;
 
  // Audio recording handlers
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        await uploadAudio(blob);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast({
        title: "Erro ao gravar",
        description: "Permita o acesso ao microfone.",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder) {
      mediaRecorder.stop();
      setMediaRecorder(null);
      setIsRecording(false);
    }
  };

  const uploadAudio = async (blob: Blob) => {
    try {
      const fileName = `${servico.id}/audio_${Date.now()}.webm`;
      
      const { error } = await supabase.storage
        .from('checklist-assets')
        .upload(fileName, blob, { upsert: true });

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from('checklist-assets')
        .getPublicUrl(fileName);

      setAudioUrl(urlData.publicUrl);
      toast({
        title: "Áudio salvo",
        description: "Gravação anexada com sucesso.",
      });
    } catch (error) {
      console.error("Error uploading audio:", error);
      toast({
        title: "Erro ao salvar áudio",
        description: "Tente novamente.",
        variant: "destructive",
      });
    }
  };

  const handleAudioFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await uploadAudio(file);
    }
    if (audioInputRef.current) {
      audioInputRef.current.value = '';
    }
  };

   // Iniciar serviço - registra data/hora de início
   const handleStartService = async () => {
     setIsSubmitting(true);
     try {
       const { error } = await supabase
         .from("servicos_agendados")
         .update({
           status: "em_andamento",
           data_hora_inicio: new Date().toISOString(),
         })
         .eq("id", servico.id);
 
       if (error) throw error;
 
       toast({
         title: "Serviço iniciado!",
         description: `Início registrado às ${format(new Date(), "HH:mm", { locale: ptBR })}`,
       });
       
       onServiceUpdated();
     } catch (error) {
       console.error("Error starting service:", error);
       toast({
         title: "Erro ao iniciar",
         description: "Tente novamente.",
         variant: "destructive",
       });
     } finally {
       setIsSubmitting(false);
     }
   };
 
  // Handle photo upload for checklist item
  const handlePhotoUpload = async (itemKey: string, files: File[]) => {
    try {
      const uploadedUrls: string[] = [];
      
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${servico.id}/${itemKey}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        
        const { error } = await supabase.storage
          .from('checklist-assets')
          .upload(fileName, file, { upsert: true });

        if (error) throw error;

        const { data: urlData } = supabase.storage
          .from('checklist-assets')
          .getPublicUrl(fileName);

        uploadedUrls.push(urlData.publicUrl);
      }

      setChecklistItems(prev => ({
        ...prev,
        [itemKey]: { 
          ...prev[itemKey], 
          photos: [...prev[itemKey].photos, ...uploadedUrls],
          // Auto-check when photo is added
          checked: true
        }
      }));

      toast({
        title: "Foto(s) anexada(s)",
        description: `${files.length} foto(s) salva(s) com sucesso.`,
      });
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast({
        title: "Erro ao enviar foto",
        description: "Tente novamente.",
        variant: "destructive",
      });
     }
   };
 
  // Remove photo from checklist item by index
  const handleRemovePhoto = (itemKey: string, photoIndex: number) => {
    setChecklistItems(prev => ({
      ...prev,
      [itemKey]: { 
        ...prev[itemKey], 
        photos: prev[itemKey].photos.filter((_, i) => i !== photoIndex)
      }
    }));
  };

  // Toggle checkbox
  const handleToggleChecked = (itemKey: string, checked: boolean) => {
    setChecklistItems(prev => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], checked }
    }));
  };

  // Update extra data (like WiFi password)
  const handleExtraDataChange = (itemKey: string, value: string) => {
    setChecklistItems(prev => ({
      ...prev,
      [itemKey]: { ...prev[itemKey], extraData: value }
    }));
  };

   // Validar step antes de avançar
   const validateStep = (): boolean => {
     if (currentStep === 1) {
      // Nenhum item é obrigatório por enquanto - apenas seguir em frente
       return true;
     }
     
     return true;
   };
 
   const nextStep = () => {
     if (validateStep()) {
       setCurrentStep(prev => Math.min(prev + 1, totalSteps));
     }
   };
 
   const prevStep = () => {
     setCurrentStep(prev => Math.max(prev - 1, 1));
   };

    // Validar campos antes de concluir
    const validateBeforeFinish = (): { valid: boolean; errors: string[] } => {
      const errors: string[] = [];
      
      // Validar assinatura do instalador
      const installerSig = installerSignature || installerSignatureRef.current?.getSignatureDataUrl();
      if (!installerSig) {
        errors.push("Assinatura do instalador obrigatória");
      }
      
      // Validar se pelo menos um item do checklist foi marcado ou tem foto
      const hasAnyChecklistProgress = Object.values(checklistItems).some(
        item => item.checked || item.photos.length > 0
      );
      
      if (!hasAnyChecklistProgress && fotosExtras.length === 0) {
        errors.push("Adicione pelo menos uma foto ou marque um item do checklist");
      }
      
      return { valid: errors.length === 0, errors };
    };

    // Concluir serviço
    const handleFinishService = async () => {
      // Validar campos
      const validation = validateBeforeFinish();
      
      if (!validation.valid) {
        toast({
          title: "Campos obrigatórios não preenchidos",
          description: (
            <ul className="mt-2 list-disc list-inside space-y-1">
              {validation.errors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          ),
          variant: "destructive",
          duration: 6000,
        });
        return;
      }
  
      // Collect all photos from checklist items
      const allPhotos = Object.values(checklistItems)
        .flatMap(item => item.photos)
        .concat(fotosExtras);

      setIsSubmitting(true);
      try {
        const { error } = await supabase
          .from("servicos_agendados")
          .update({
            status: "concluido",
            data_hora_fim: new Date().toISOString(),
            fotos_urls: allPhotos,
            observacoes_conclusao: observacoes,
            audio_url: audioUrl,
            video_url: videoUrl,
            layout_id: savedLayoutId,
          })
          .eq("id", servico.id);
  
        if (error) {
          // Mapear erros específicos do Supabase
          let errorMessage = "Não foi possível concluir o serviço.";
          
          if (error.message.includes("violates row-level security")) {
            errorMessage = "Você não tem permissão para atualizar este serviço.";
          } else if (error.message.includes("network")) {
            errorMessage = "Erro de conexão. Verifique sua internet e tente novamente.";
          } else if (error.code === "PGRST116") {
            errorMessage = "Serviço não encontrado ou já foi atualizado.";
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          throw new Error(errorMessage);
        }
  
        setIsSuccess(true);
        toast({
          title: "Serviço concluído!",
          description: `Finalizado às ${format(new Date(), "HH:mm", { locale: ptBR })}`,
        });
        
        setTimeout(() => {
          onServiceUpdated();
          onClose();
        }, 2000);
      } catch (error: any) {
        console.error("Error finishing service:", error);
        toast({
          title: "Erro ao concluir serviço",
          description: error.message || "Ocorreu um erro inesperado. Tente novamente.",
          variant: "destructive",
          duration: 6000,
        });
      } finally {
        setIsSubmitting(false);
      }
    };
 
   // Tela de início (para serviços agendados)
   if (servico.status === "agendado") {
     return (
      <div className="fixed inset-0 z-50 bg-background overflow-auto">
         <div className="min-h-screen flex flex-col">
           {/* Header */}
          <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
             <div className="container mx-auto px-4">
              <div className="flex items-center justify-between h-16">
                 <Button
                   variant="ghost"
                   size="sm"
                   onClick={onClose}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
                 >
                   <ChevronLeft className="h-4 w-4" />
                   Voltar
                 </Button>
                <img src={logoBlue} alt="Mais Energia Solar" className="h-8" />
                 <div className="w-20" />
               </div>
             </div>
           </header>
 
           {/* Content */}
           <main className="flex-1 container mx-auto px-4 py-6 max-w-md">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              <Card className="border border-border/50 shadow-lg">
                <CardHeader className="text-center pb-4 border-b">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-secondary/10 flex items-center justify-center mb-4">
                    <Wrench className="h-8 w-8 text-secondary" />
                  </div>
                  <CardTitle className="text-xl font-semibold">{tipoLabels[servico.tipo]}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">Pronto para iniciar o atendimento</p>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {/* Cliente */}
                  {servico.cliente && (
                    <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-secondary" />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">{servico.cliente.nome}</p>
                        <p className="text-sm text-muted-foreground">{servico.cliente.telefone}</p>
                      </div>
                    </div>
                  )}
                  
                  {/* Endereço */}
                  {(servico.endereco || servico.bairro || servico.cidade) && (
                    <div className="flex items-start gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                      <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-5 w-5 text-secondary" />
                      </div>
                      <span className="text-sm text-foreground leading-relaxed">
                        {[servico.endereco, servico.bairro, servico.cidade].filter(Boolean).join(", ")}
                      </span>
                    </div>
                  )}
                  
                  {/* Data */}
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-xl border border-border/50">
                    <div className="w-10 h-10 rounded-full bg-secondary/10 flex items-center justify-center">
                      <Calendar className="h-5 w-5 text-secondary" />
                    </div>
                    <span className="text-sm text-foreground">
                      {format(new Date(servico.data_agendada), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      {servico.hora_inicio && ` às ${servico.hora_inicio.slice(0, 5)}`}
                    </span>
                  </div>

                  {/* Descrição */}
                  {servico.descricao && (
                    <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-xl border border-border/50">
                      {servico.descricao}
                    </p>
                  )}

                  {/* Botão Iniciar */}
                  <Button
                    onClick={handleStartService}
                    disabled={isSubmitting}
                    className="w-full bg-success hover:bg-success/90 text-success-foreground h-14 text-lg gap-3 rounded-xl shadow-lg"
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Play className="h-5 w-5" />
                    )}
                    Iniciar Atendimento
                  </Button>
                  
                  <p className="text-xs text-center text-muted-foreground">
                    Data e hora serão registradas automaticamente
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          </main>
        </div>
      </div>
    );
  }

  // Tela de sucesso
  if (isSuccess) {
    return (
      <div className="fixed inset-0 z-50 bg-background flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center px-6"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", delay: 0.2 }}
            className="w-24 h-24 bg-success rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
          >
            <CheckCircle2 className="h-12 w-12 text-success-foreground" />
          </motion.div>
          <h2 className="text-2xl font-bold text-success mb-2">Serviço Concluído!</h2>
          <p className="text-muted-foreground">Registro salvo com sucesso</p>
        </motion.div>
      </div>
    );
  }

  // Fluxo de execução (serviço em andamento)
  return (
    <div className="fixed inset-0 z-50 bg-background overflow-auto">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground hover:bg-muted gap-2"
            >
              <X className="h-4 w-4" />
              Fechar
            </Button>
            <img src={logoBlue} alt="Mais Energia Solar" className="h-8" />
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
              <Clock className="h-3 w-3 mr-1" />
              Em andamento
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-lg pb-28">
        {/* Step Indicator */}
        <div className="flex items-center justify-center gap-3 mb-6">
          {[
            { step: 1, icon: ClipboardCheck, label: "Checklist" },
            { step: 2, icon: PenTool, label: "Assinaturas" },
          ].map(({ step, icon: StepIcon, label }) => (
            <div key={step} className="flex items-center gap-2">
              <div
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center font-medium transition-all duration-300",
                  currentStep === step
                    ? "bg-secondary text-secondary-foreground shadow-lg"
                    : currentStep > step
                    ? "bg-success text-success-foreground"
                    : "bg-muted text-muted-foreground border border-border"
                )}
              >
                {currentStep > step ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
              </div>
              <span className={cn(
                "text-sm font-medium hidden sm:block",
                currentStep >= step ? "text-foreground" : "text-muted-foreground"
              )}>
                {label}
              </span>
              {step < totalSteps && (
                <div className={cn(
                  "w-8 h-0.5 rounded-full hidden sm:block",
                  currentStep > step ? "bg-success" : "bg-border"
                )} />
              )}
            </div>
          ))}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Checklist com Fotos */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="border border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ClipboardCheck className="h-4 w-4 text-primary" />
                    </div>
                    Checklist do Serviço
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Marque cada item e anexe as fotos correspondentes
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-4">
                  <ChecklistItemWithPhoto
                    icon={Sun}
                    iconColor="text-amber-600"
                    bgColor="bg-amber-500/10"
                    title="Placas instaladas no local correto"
                    description="Local com boa exposição solar"
                    item={checklistItems.placas_local_aprovado}
                    onPhotoUpload={(files) => handlePhotoUpload('placas_local_aprovado', files)}
                    onRemovePhoto={(index) => handleRemovePhoto('placas_local_aprovado', index)}
                    onToggleChecked={(checked) => handleToggleChecked('placas_local_aprovado', checked)}
                  />
                  
                  <ChecklistItemWithPhoto
                    icon={Zap}
                    iconColor="text-blue-600"
                    bgColor="bg-blue-500/10"
                    title="Inversor instalado corretamente"
                    description="Local seguro e protegido"
                    item={checklistItems.inversor_local_aprovado}
                    onPhotoUpload={(files) => handlePhotoUpload('inversor_local_aprovado', files)}
                    onRemovePhoto={(index) => handleRemovePhoto('inversor_local_aprovado', index)}
                    onToggleChecked={(checked) => handleToggleChecked('inversor_local_aprovado', checked)}
                  />
                  
                  <ChecklistItemWithPhoto
                    icon={FileCheck}
                    iconColor="text-violet-600"
                    bgColor="bg-violet-500/10"
                    title="Adesivo do inversor aplicado"
                    description="Identificação visível"
                    item={checklistItems.adesivo_inversor}
                    onPhotoUpload={(files) => handlePhotoUpload('adesivo_inversor', files)}
                    onRemovePhoto={(index) => handleRemovePhoto('adesivo_inversor', index)}
                    onToggleChecked={(checked) => handleToggleChecked('adesivo_inversor', checked)}
                  />
                  
                  <ChecklistItemWithPhoto
                    icon={Clock}
                    iconColor="text-emerald-600"
                    bgColor="bg-emerald-500/10"
                    title="Plaquinha do relógio instalada"
                    description="Identificação no medidor"
                    item={checklistItems.plaquinha_relogio}
                    onPhotoUpload={(files) => handlePhotoUpload('plaquinha_relogio', files)}
                    onRemovePhoto={(index) => handleRemovePhoto('plaquinha_relogio', index)}
                    onToggleChecked={(checked) => handleToggleChecked('plaquinha_relogio', checked)}
                  />
                  
                  <ChecklistItemWithPhoto
                    icon={Wifi}
                    iconColor="text-cyan-600"
                    bgColor="bg-cyan-500/10"
                    title="Configuração WiFi do inversor"
                    description="Conectado à rede"
                    item={checklistItems.configuracao_wifi}
                    onPhotoUpload={(files) => handlePhotoUpload('configuracao_wifi', files)}
                    onRemovePhoto={(index) => handleRemovePhoto('configuracao_wifi', index)}
                    onToggleChecked={(checked) => handleToggleChecked('configuracao_wifi', checked)}
                    showPasswordField
                    passwordValue={checklistItems.configuracao_wifi.extraData || ''}
                    onPasswordChange={(value) => handleExtraDataChange('configuracao_wifi', value)}
                  />

                  {/* Fotos Extras */}
                {/* Áudio */}
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                      <Volume2 className="h-4 w-4 text-info" />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Áudio</Label>
                      <p className="text-xs text-muted-foreground">Grave ou anexe um áudio</p>
                    </div>
                  </div>
                  
                  {audioUrl ? (
                    <div className="p-3 bg-muted/50 rounded-lg border border-border/50">
                      <audio controls className="w-full h-10" src={audioUrl} />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-destructive hover:text-destructive"
                        onClick={() => setAudioUrl(null)}
                      >
                        <Trash2 className="h-3 w-3 mr-1" />
                        Remover áudio
                      </Button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        ref={audioInputRef}
                        type="file"
                        accept="audio/*"
                        className="hidden"
                        onChange={handleAudioFileSelect}
                      />
                      <Button
                        type="button"
                        variant={isRecording ? "destructive" : "outline"}
                        size="sm"
                        className="flex-1 gap-2 h-10"
                        onClick={isRecording ? stopRecording : startRecording}
                      >
                        {isRecording ? (
                          <>
                            <Square className="h-4 w-4" />
                            Parar Gravação
                          </>
                        ) : (
                          <>
                            <Mic className="h-4 w-4" />
                            Gravar Áudio
                          </>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-2 h-10"
                        onClick={() => audioInputRef.current?.click()}
                        disabled={isRecording}
                      >
                        <FileCheck className="h-4 w-4" />
                        Anexar Áudio
                      </Button>
                    </div>
                  )}
                </div>

                 {/* Vídeo */}
                 <VideoCapture
                   videoUrl={videoUrl}
                   onVideoChange={setVideoUrl}
                   servicoId={servico.id}
                 />

                 {/* Layout de Módulos */}
                 <div className="space-y-3 pt-4 border-t">
                   <div className="flex items-center gap-2">
                     <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                       <Grid3X3 className="h-4 w-4 text-warning" />
                     </div>
                     <div>
                       <Label className="text-sm font-medium">Layout de Módulos</Label>
                       <p className="text-xs text-muted-foreground">Desenhe o posicionamento das placas</p>
                     </div>
                   </div>
                   
                   {savedLayoutId && layoutModuleCount > 0 ? (
                     <div className="p-3 bg-success/5 rounded-lg border border-success/20 flex items-center justify-between">
                       <div className="flex items-center gap-2">
                         <CheckCircle2 className="h-4 w-4 text-success" />
                         <span className="text-sm font-medium text-success">
                           {layoutModuleCount} módulos posicionados
                         </span>
                       </div>
                       <Button
                         type="button"
                         variant="outline"
                         size="sm"
                          onClick={() => setIsLayoutEditorOpen(true)}
                       >
                         Editar
                       </Button>
                     </div>
                   ) : (
                     <Button
                       type="button"
                       variant="outline"
                       className="w-full gap-2 h-10"
                        onClick={() => setIsLayoutEditorOpen(true)}
                     >
                       <Grid3X3 className="h-4 w-4" />
                       Desenhar Layout
                     </Button>
                   )}
                 </div>

                  {/* Observações */}
                  <div className="space-y-2 pt-4 border-t">
                    <Label className="text-sm font-medium">Observações</Label>
                    <Textarea
                      placeholder="Observações sobre o serviço realizado..."
                      value={observacoes}
                      onChange={(e) => setObservacoes(e.target.value)}
                      rows={3}
                      className="resize-none"
                    />
                  </div>

                  {/* Fotos Extras */}
                  <div className="space-y-3 pt-4 border-t">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <Label className="text-sm font-medium">Fotos Extras</Label>
                        <p className="text-xs text-muted-foreground">Opcional - fotos adicionais do serviço</p>
                      </div>
                    </div>
                    <PhotoCapture
                      photos={fotosExtras}
                      onPhotosChange={setFotosExtras}
                      maxPhotos={10}
                    />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Assinaturas */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-4"
            >
              <Card className="border border-border/50 shadow-sm">
                <CardHeader className="pb-3 border-b bg-muted/30">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 rounded-lg bg-secondary/10 flex items-center justify-center">
                      <Wrench className="h-4 w-4 text-secondary" />
                    </div>
                    Assinatura do Instalador
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Confirme com sua assinatura
                  </p>
                </CardHeader>
                <CardContent className="pt-4">
                  <SignaturePad
                    ref={installerSignatureRef}
                    label=""
                    onSignatureChange={setInstallerSignature}
                  />
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 gradient-blue p-4 pb-6 safe-area-bottom">
        <div className="container mx-auto max-w-lg flex flex-col gap-3">
          <div className="flex gap-3">
          {currentStep > 1 && (
            <Button
              variant="outline"
              onClick={prevStep}
              className="flex-1 h-11 bg-white/10 border-white/20 text-white hover:bg-white/20"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>
          )}
          
          {currentStep < totalSteps ? (
            <Button
              onClick={nextStep}
              className="flex-1 h-11 bg-white text-secondary hover:bg-white/90 font-medium"
            >
              Próximo
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleFinishService}
              disabled={isSubmitting}
              className="flex-1 h-11 bg-success hover:bg-success/90 text-success-foreground font-medium"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Concluir Serviço
            </Button>
          )}
          </div>
          <div className="flex justify-center">
            <img src={logoWhite} alt="Mais Energia Solar" className="h-5 opacity-80" />
          </div>
        </div>
      </div>

      {/* Editor de Layout Solar Profissional */}
      <SolarLayoutEditor
        isOpen={isLayoutEditorOpen}
        onClose={() => setIsLayoutEditorOpen(false)}
        layoutId={savedLayoutId || undefined}
        servicoId={servico.id}
        layoutName={`Layout - ${servico.cliente?.nome || servico.tipo}`}
        onSave={(layoutId, layoutData) => {
          setSavedLayoutId(layoutId);
          setLayoutModuleCount(layoutData.modules.length);
        }}
      />
    </div>
  );
}

// Componente auxiliar para item do checklist com foto
function ChecklistItemWithPhoto({
  icon: Icon,
  iconColor = "text-orange-600",
  bgColor = "bg-orange-500/10",
  title,
  description,
  item,
  onPhotoUpload,
  onRemovePhoto,
  onToggleChecked,
  showPasswordField,
  passwordValue,
  onPasswordChange,
}: {
  icon: React.ElementType;
  iconColor?: string;
  bgColor?: string;
  title: string;
  description: string;
  item: { checked: boolean; photos: string[]; extraData?: string };
  onPhotoUpload: (files: File[]) => void;
  onRemovePhoto: (index: number) => void;
  onToggleChecked: (checked: boolean) => void;
  showPasswordField?: boolean;
  passwordValue?: string;
  onPasswordChange?: (value: string) => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isCamera = false) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onPhotoUpload(Array.from(files));
    }
    // Reset input
    if (isCamera && cameraInputRef.current) {
      cameraInputRef.current.value = '';
    } else if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className={cn(
        "p-4 rounded-xl transition-all duration-200 border",
        item.checked && item.photos.length > 0 
        ? "bg-success/5 border-success/30" 
          : "bg-muted/30 border-border/50 hover:border-border"
      )}
    >
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.checked}
          onCheckedChange={(checked) => onToggleChecked(checked as boolean)}
          className="mt-1 data-[state=checked]:bg-success data-[state=checked]:border-success"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <div className={cn("w-6 h-6 rounded-md flex items-center justify-center", bgColor)}>
              <Icon className={cn("h-3.5 w-3.5", item.checked ? "text-success" : iconColor)} />
            </div>
            <span className={cn("font-medium text-sm", item.checked && "text-success")}>{title}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
          
          {/* Photos grid */}
          {item.photos.length > 0 && (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {item.photos.map((photo, index) => (
                <div key={index} className="relative group">
                  <img 
                    src={photo} 
                    alt={`${title} ${index + 1}`}
                    className="w-full h-20 object-cover rounded-lg border border-border/50 cursor-pointer hover:opacity-90 transition-opacity"
                    onClick={() => setPreviewPhoto(photo)}
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => onRemovePhoto(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                 </div>
              ))}
            </div>
          )}
          
          {/* Password field for WiFi */}
          {showPasswordField && (
            <div className="mt-3">
              <Input
                type="text"
                placeholder="Senha da rede WiFi (opcional)"
                value={passwordValue || ''}
                onChange={(e) => onPasswordChange?.(e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          )}
          
          {/* Add photo buttons */}
          <div className="mt-3 flex gap-2">
            {/* Camera input */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => handleFileSelect(e, true)}
            />
            {/* Gallery input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFileSelect(e, false)}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-2 h-9 text-xs"
              onClick={() => cameraInputRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              Tirar Foto
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1 gap-2 h-9 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileCheck className="h-4 w-4" />
              Galeria
            </Button>
          </div>
        </div>
       </div>
      
      {/* Photo Preview Dialog */}
      <Dialog open={!!previewPhoto} onOpenChange={() => setPreviewPhoto(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
          {previewPhoto && (
            <img 
              src={previewPhoto} 
              alt="Preview" 
              className="w-full h-auto max-h-[85vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
   );
 }