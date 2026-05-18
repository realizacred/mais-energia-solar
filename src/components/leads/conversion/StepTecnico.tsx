import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Navigation, CreditCard, Home, Zap, Signature } from "lucide-react";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui-kit/Spinner";
import { DocumentUpload, type DocumentFile } from "../DocumentUpload";
import { useConversionEquipment } from "@/hooks/useConvertLeadToClient";
import { SectionTitle } from "./SectionTitle";
import { useToast } from "@/hooks/use-toast";

const step2Schema = z.object({
  disjuntor_id: z.string().min(1, "Disjuntor é obrigatório"),
  transformador_id: z.string().min(1, "Transformador é obrigatório"),
  localizacao: z.string().min(1, "Localização é obrigatória"),
  simulacao_aceita_id: z.string().optional(),
  observacoes: z.string().optional(),
});

export type Step2Data = z.infer<typeof step2Schema>;

interface StepTecnicoProps {
  projetoId?: string; 
  initialData: Partial<Step2Data>;
  identidadeFiles: DocumentFile[];
  comprovanteFiles: DocumentFile[];
  beneficiariaFiles: DocumentFile[];
  assinaturaFiles: DocumentFile[];
  onFilesChange: (type: "identidade" | "comprovante" | "beneficiaria" | "assinatura", files: DocumentFile[]) => void;
  onChange: (data: Step2Data, isValid: boolean) => void;
}

export function StepTecnico({ 
  initialData, 
  identidadeFiles, 
  comprovanteFiles, 
  beneficiariaFiles, 
  assinaturaFiles,
  onFilesChange,
  onChange 
}: StepTecnicoProps) {
  const { toast } = useToast();
  const { data: equipmentData } = useConversionEquipment();
  const [gettingLocation, setGettingLocation] = useState(false);

  const form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      disjuntor_id: initialData.disjuntor_id || "",
      transformador_id: initialData.transformador_id || "",
      localizacao: initialData.localizacao || "",
    },
    mode: "onChange",
  });

  const formData = form.watch();
  const isValid = form.formState.isValid;

  useEffect(() => {
    onChange(formData as Step2Data, isValid);
  }, [formData, isValid, onChange]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Erro",
        description: "Geolocalização não é suportada pelo seu navegador.",
        variant: "destructive",
      });
      return;
    }

    setGettingLocation(true);

    const fallbackTimeout = setTimeout(() => {
      setGettingLocation(false);
      toast({
        title: "Erro",
        description: "Não foi possível obter a localização. Verifique as permissões do navegador.",
        variant: "destructive",
      });
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(fallbackTimeout);
        const { latitude, longitude } = position.coords;
        const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        form.setValue("localizacao", googleMapsLink, { shouldValidate: true, shouldDirty: true });
        setGettingLocation(false);
        toast({
          title: "Localização obtida!",
          description: `Coordenadas: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        });
      },
      (error) => {
        clearTimeout(fallbackTimeout);
        setGettingLocation(false);
        toast({
          title: "Erro de Geolocalização",
          description: "Não foi possível obter a localização. Tente novamente.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  return (
    <Form {...form}>
      <div className="space-y-6">
        <div className="space-y-3">
          <SectionTitle>Dados técnicos</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="disjuntor_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Disjuntor *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione o disjuntor" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {equipmentData?.disjuntores.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.amperagem}A {d.descricao ? `- ${d.descricao}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="transformador_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Transformador *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger><SelectValue placeholder="Selecione o transformador" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {equipmentData?.transformadores.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.potencia_kva} kVA {t.descricao ? `- ${t.descricao}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="localizacao"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" /> Localização *
                </FormLabel>
                <div className="flex gap-2">
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Link do Google Maps ou coordenadas"
                      className="flex-1"
                    />
                  </FormControl>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={getCurrentLocation}
                    disabled={gettingLocation}
                    className="shrink-0"
                  >
                    {gettingLocation ? <Spinner size="sm" /> : <Navigation className="h-4 w-4" />}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="border-t border-border" />

        <div className="space-y-3">
          <SectionTitle>Documentos</SectionTitle>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-primary" /> Identidade (RG/CNH)
              </span>
              {identidadeFiles.length > 0 ? (
                <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
              ) : (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
              )}
            </div>
            <DocumentUpload label="" description="Frente e verso" files={identidadeFiles} onFilesChange={(f) => onFilesChange("identidade", f)} required />
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5 text-primary" /> Comprovante de Endereço
              </span>
              {comprovanteFiles.length > 0 ? (
                <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
              ) : (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
              )}
            </div>
            <DocumentUpload label="" description="Foto ou arquivo digital" files={comprovanteFiles} onFilesChange={(f) => onFilesChange("comprovante", f)} required />
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-primary" /> Comprovante Beneficiária UC
              </span>
              {beneficiariaFiles.length > 0 ? (
                <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Opcional</Badge>
              )}
            </div>
            <DocumentUpload label="" description="Comprovante da unidade consumidora" files={beneficiariaFiles} onFilesChange={(f) => onFilesChange("beneficiaria", f)} />
          </div>

          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                <Signature className="h-3.5 w-3.5 text-primary" /> Foto da Assinatura
              </span>
              {assinaturaFiles.length > 0 ? (
                <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
              ) : (
                <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Opcional</Badge>
              )}
            </div>
            <DocumentUpload label="" description="Foto da assinatura do cliente no contrato" files={assinaturaFiles} onFilesChange={(f) => onFilesChange("assinatura", f)} accept="image/*" />
          </div>
        </div>
      </div>
    </Form>
  );
}
