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
import { supabase } from "@/integrations/supabase/client";

const step2Schema = z.object({
  disjuntor_id: z.string().min(1, "Disjuntor é obrigatório"),
  transformador_id: z.string().min(1, "Transformador é obrigatório"),
  localizacao: z.string().min(1, "Localização é obrigatória"),
  simulacao_aceita_id: z.string().optional(),
  observacoes: z.string().optional(),
});

export type Step2Data = z.infer<typeof step2Schema>;

interface StepTecnicoProps {
  leadId?: string; 
  initialData: Partial<Step2Data>; 
  identidadeFiles: DocumentFile[];
  comprovanteFiles: DocumentFile[];
  beneficiariaFiles: DocumentFile[];
  assinaturaFiles: DocumentFile[];
  onFilesChange: (type: "identidade" | "comprovante" | "beneficiaria" | "assinatura", files: DocumentFile[]) => void;
  onChange: (data: Step2Data, isValid: boolean) => void;
}

export function StepTecnico({ 
  leadId,
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
  const [simulacoes, setSimulacoes] = useState<any[]>([]);

  const form = useForm<Step2Data>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      disjuntor_id: initialData.disjuntor_id || "",
      transformador_id: initialData.transformador_id || "",
      localizacao: initialData.localizacao || "",
      simulacao_aceita_id: initialData.simulacao_aceita_id || "",
      observacoes: initialData.observacoes || "",
    },
    mode: "onChange",
  });

  const formData = form.watch();
  const isValid = form.formState.isValid;

  useEffect(() => {
    onChange(formData as Step2Data, isValid);
  }, [formData, isValid, onChange]);

  useEffect(() => {
    if (leadId) {
      supabase.from("simulacoes").select("*").eq("lead_id", leadId).order("created_at", { ascending: false })
        .then(({ data }) => setSimulacoes(data || []));
    }
  }, [leadId]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Erro", description: "Geolocalização não é suportada.", variant: "destructive" });
      return;
    }
    setGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const link = `https://www.google.com/maps?q=${pos.coords.latitude},${pos.coords.longitude}`;
        form.setValue("localizacao", link, { shouldValidate: true });
        setGettingLocation(false);
      },
      () => {
        setGettingLocation(false);
        toast({ title: "Erro", description: "Falha ao obter localização.", variant: "destructive" });
      },
      { timeout: 10000 }
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
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {equipmentData?.disjuntores.map((d) => (
                        <SelectItem key={d.id} value={d.id}>{d.amperagem}A {d.descricao || ""}</SelectItem>
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
                    <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                    <SelectContent>
                      {equipmentData?.transformadores.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.potencia_kva} kVA {t.descricao || ""}</SelectItem>
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
                <FormLabel className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5" /> Localização *</FormLabel>
                <div className="flex gap-2">
                  <FormControl><Input {...field} placeholder="Link do Google Maps" /></FormControl>
                  <Button type="button" variant="outline" size="icon" onClick={getCurrentLocation} disabled={gettingLocation}>
                    {gettingLocation ? <Spinner size="sm" /> : <Navigation className="h-4 w-4" />}
                  </Button>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="simulacao_aceita_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Proposta Aceita</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger></FormControl>
                  <SelectContent>
                    {simulacoes.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {new Date(s.created_at).toLocaleDateString()} - {s.potencia_recomendada_kwp}kWp
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="observacoes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Observações</FormLabel>
                <FormControl><Input {...field} /></FormControl>
              </FormItem>
            )}
          />
        </div>

        <div className="border-t border-border" />

        <div className="space-y-3">
          <SectionTitle>Documentos</SectionTitle>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <span className="text-sm font-medium flex items-center gap-1.5"><CreditCard className="h-3.5 w-3.5" /> Identidade (RG/CNH)</span>
            <DocumentUpload label="" files={identidadeFiles} onFilesChange={(f) => onFilesChange("identidade", f)} required />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <span className="text-sm font-medium flex items-center gap-1.5"><Home className="h-3.5 w-3.5" /> Endereço</span>
            <DocumentUpload label="" files={comprovanteFiles} onFilesChange={(f) => onFilesChange("comprovante", f)} required />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <span className="text-sm font-medium flex items-center gap-1.5"><Zap className="h-3.5 w-3.5" /> Conta Beneficiária</span>
            <DocumentUpload label="" files={beneficiariaFiles} onFilesChange={(f) => onFilesChange("beneficiaria", f)} />
          </div>
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <span className="text-sm font-medium flex items-center gap-1.5"><Signature className="h-3.5 w-3.5" /> Assinatura</span>
            <DocumentUpload label="" files={assinaturaFiles} onFilesChange={(f) => onFilesChange("assinatura", f)} />
          </div>
        </div>
      </div>
    </Form>
  );
}
