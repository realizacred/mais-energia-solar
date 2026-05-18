import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isValidCpfCnpj } from "@/lib/cpfCnpjUtils";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { EmailInput } from "@/components/ui/EmailInput";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";
import { SectionTitle } from "./SectionTitle";

const step1Schema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  telefone: z.string().min(10, "Telefone é obrigatório"),
  email: z.string().optional().refine(val => !val || z.string().email().safeParse(val).success, "E-mail inválido"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ é obrigatório").refine(isValidCpfCnpj, "CPF/CNPJ inválido"),
  data_nascimento: z.string().optional(),
  cep: z.string().optional(),
  estado: z.string().optional(),
  cidade: z.string().optional(),
  bairro: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
});

export type Step1Data = z.infer<typeof step1Schema>;

interface StepDadosPessoaisProps {
  initialData: Partial<Step1Data>;
  onChange: (data: Step1Data, isValid: boolean) => void;
}

export function StepDadosPessoais({ initialData, onChange }: StepDadosPessoaisProps) {
  const form = useForm<Step1Data>({
    resolver: zodResolver(step1Schema),
    defaultValues: {
      nome: initialData.nome || "",
      telefone: initialData.telefone || "",
      email: initialData.email || "",
      cpf_cnpj: initialData.cpf_cnpj || "",
      data_nascimento: initialData.data_nascimento || "",
      cep: initialData.cep || "",
      estado: initialData.estado || "",
      cidade: initialData.cidade || "",
      bairro: initialData.bairro || "",
      rua: initialData.rua || "",
      numero: initialData.numero || "",
      complemento: initialData.complemento || "",
    },
    mode: "onChange",
  });

  const formData = form.watch();
  const isValid = form.formState.isValid;

  useEffect(() => {
    onChange(formData as Step1Data, isValid);
  }, [formData, isValid, onChange]);

  const handleAddressChange = (addr: AddressData) => {
    form.setValue("cep", addr.cep, { shouldValidate: true, shouldDirty: true });
    form.setValue("rua", addr.rua, { shouldValidate: true, shouldDirty: true });
    form.setValue("numero", addr.numero, { shouldValidate: true, shouldDirty: true });
    form.setValue("complemento", addr.complemento, { shouldDirty: true });
    form.setValue("bairro", addr.bairro, { shouldValidate: true, shouldDirty: true });
    form.setValue("cidade", addr.cidade, { shouldValidate: true, shouldDirty: true });
    form.setValue("estado", addr.estado, { shouldValidate: true, shouldDirty: true });
  };

  const addressValue: AddressData = {
    cep: formData.cep || "",
    rua: formData.rua || "",
    numero: formData.numero || "",
    complemento: formData.complemento || "",
    bairro: formData.bairro || "",
    cidade: formData.cidade || "",
    estado: formData.estado || "",
  };

  return (
    <Form {...form}>
      <div className="space-y-6">
        <div className="space-y-3">
          <SectionTitle>Dados pessoais</SectionTitle>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="nome"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome *</FormLabel>
                  <FormControl><Input {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="telefone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Telefone *</FormLabel>
                  <FormControl><PhoneInput value={field.value} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail</FormLabel>
                  <FormControl><EmailInput value={field.value || ""} onChange={field.onChange} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="cpf_cnpj"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>CPF/CNPJ *</FormLabel>
                  <FormControl><CpfCnpjInput value={field.value || ""} onChange={field.onChange} label="" /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="data_nascimento"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Data de nascimento</FormLabel>
                  <FormControl><Input type="date" {...field} value={field.value || ""} /></FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>

        <div className="border-t border-border" />

        <div className="space-y-3">
          <SectionTitle>Endereço</SectionTitle>
          <AddressFields value={addressValue} onChange={handleAddressChange} />
        </div>
      </div>
    </Form>
  );
}
