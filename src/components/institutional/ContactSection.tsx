import { useState } from "react";
import { Phone, Mail, MapPin, Send, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const estados = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
];

const contactInfo = [
  {
    icon: Phone,
    label: "Telefone",
    value: "(32) 99843-7675",
    href: "tel:+5532998437675",
  },
  {
    icon: Mail,
    label: "E-mail",
    value: "contato@maisenergiasolar.com.br",
    href: "mailto:contato@maisenergiasolar.com.br",
  },
  {
    icon: MapPin,
    label: "Localização",
    value: "Cataguases - MG",
    href: null,
  },
];

export function ContactSection() {
  const { ref, isVisible } = useScrollReveal();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    telefone: "",
    cidade: "",
    estado: "",
    observacoes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.nome || !formData.telefone) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha pelo menos seu nome e telefone.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const message = encodeURIComponent(
        `Olá! Gostaria de solicitar um orçamento.\n\nNome: ${formData.nome}\nTelefone: ${formData.telefone}\nCidade: ${formData.cidade} - ${formData.estado}\n${formData.observacoes ? `Observações: ${formData.observacoes}` : ""}`
      );
      window.open(`https://wa.me/5532998437675?text=${message}`, "_blank");

      toast({
        title: "Redirecionado para WhatsApp!",
        description: "Complete o envio pelo WhatsApp.",
      });

      setFormData({ nome: "", email: "", telefone: "", cidade: "", estado: "", observacoes: "" });
    } catch {
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente ou entre em contato pelo WhatsApp.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="contato" className="py-20 sm:py-32 bg-background relative overflow-hidden">
      <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -translate-y-1/4 translate-x-1/4" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold mb-4">
            Fale Conosco
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight">
            Solicite um Orçamento
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-5 gap-10 max-w-5xl mx-auto">
          {/* Contact Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="md:col-span-2"
          >
            <h3 className="font-display text-xl font-bold text-foreground mb-8">Informações de Contato</h3>
            <div className="space-y-6 mb-10">
              {contactInfo.map((info) => (
                <div key={info.label} className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform duration-300">
                    <info.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">{info.label}</p>
                    {info.href ? (
                      <a
                        href={info.href}
                        className="font-semibold text-foreground hover:text-primary transition-colors"
                      >
                        {info.value}
                      </a>
                    ) : (
                      <p className="font-semibold text-foreground">{info.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* WhatsApp CTA */}
            <a
              href="https://wa.me/5532998437675"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-success text-success-foreground font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              <Phone className="w-4 h-4" />
              Chamar no WhatsApp
              <ArrowRight className="w-4 h-4" />
            </a>
          </motion.div>

          {/* Contact Form */}
          <motion.form
            initial={{ opacity: 0, x: 20 }}
            animate={isVisible ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.5, delay: 0.3 }}
            onSubmit={handleSubmit}
            className="md:col-span-3 space-y-4 p-6 sm:p-8 rounded-2xl bg-card border border-border/50"
          >
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                placeholder="Nome *"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
                className="rounded-xl h-12"
              />
              <Input
                placeholder="Telefone *"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
                required
                className="rounded-xl h-12"
              />
            </div>
            <Input
              type="email"
              placeholder="E-mail"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="rounded-xl h-12"
            />
            <div className="grid sm:grid-cols-2 gap-4">
              <Input
                placeholder="Cidade"
                value={formData.cidade}
                onChange={(e) => setFormData({ ...formData, cidade: e.target.value })}
                className="rounded-xl h-12"
              />
              <Select
                value={formData.estado}
                onValueChange={(val) => setFormData({ ...formData, estado: val })}
              >
                <SelectTrigger className="rounded-xl h-12">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  {estados.map((uf) => (
                    <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              placeholder="Observações"
              value={formData.observacoes}
              onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
              rows={4}
              className="rounded-xl"
            />
            <Button
              type="submit"
              disabled={loading}
              size="xl"
              className="w-full bg-primary hover:bg-primary/90 rounded-full font-bold shadow-primary hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
            >
              <Send className="w-4 h-4 mr-2" />
              {loading ? "Enviando..." : "Enviar Orçamento"}
            </Button>
          </motion.form>
        </div>
      </div>
    </section>
  );
}
