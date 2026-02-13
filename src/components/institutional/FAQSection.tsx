import { motion } from "framer-motion";
import { useScrollReveal } from "@/hooks/useScrollReveal";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "Quanto vou economizar na conta de luz?",
    answer: "A economia pode chegar a até 90% da sua conta de energia. O valor exato depende do seu consumo atual, da tarifa da concessionária e do tamanho do sistema instalado. Fazemos uma simulação personalizada e gratuita para você.",
  },
  {
    question: "Existe financiamento disponível?",
    answer: "Sim! Trabalhamos com diversas linhas de financiamento e parceiros bancários que oferecem condições especiais para energia solar, com parcelas que muitas vezes são menores do que sua conta de luz atual.",
  },
  {
    question: "Qual a garantia do sistema?",
    answer: "Os painéis solares possuem garantia de 25 anos de performance. Os inversores têm garantia de 10 a 15 anos, dependendo do fabricante. Além disso, oferecemos garantia de instalação e suporte técnico completo.",
  },
  {
    question: "E a manutenção? É cara?",
    answer: "A manutenção é mínima e de baixo custo. Recomendamos uma limpeza semestral dos painéis (que pode ser feita com água) e uma revisão anual do sistema. Oferecemos planos de manutenção preventiva.",
  },
  {
    question: "Como funciona a homologação?",
    answer: "Cuidamos de todo o processo burocrático com a concessionária de energia. Isso inclui o projeto técnico, documentação, solicitação de parecer de acesso e troca do medidor. Você não precisa se preocupar com nada.",
  },
  {
    question: "Quanto tempo leva a instalação?",
    answer: "A instalação em si leva de 1 a 5 dias, dependendo do porte do sistema. O processo completo, incluindo projeto e homologação, leva em média 30 a 60 dias até você começar a gerar sua própria energia.",
  },
  {
    question: "Funciona em dias nublados ou chuvosos?",
    answer: "Sim! Os painéis continuam gerando energia mesmo em dias nublados, porém com rendimento menor. O sistema é dimensionado considerando as condições climáticas da sua região ao longo do ano.",
  },
  {
    question: "E se eu mudar de casa?",
    answer: "O sistema pode ser desmontado e reinstalado no novo endereço. Também é possível deixá-lo na residência atual, pois ele valoriza o imóvel em até 8% segundo estudos de mercado.",
  },
];

export function FAQSection() {
  const { ref, isVisible } = useScrollReveal();

  return (
    <section id="faq" className="py-20 sm:py-32 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="absolute bottom-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl translate-y-1/2 translate-x-1/4" />

      <div ref={ref} className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-bold mb-4 border border-primary/20">
            Perguntas Frequentes
          </span>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-extrabold text-foreground tracking-tight mb-4">
            Tire suas Dúvidas
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-lg">
            As perguntas mais comuns sobre energia solar respondidas de forma clara e direta.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isVisible ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-3xl mx-auto"
        >
          <Accordion type="single" collapsible className="space-y-3">
            {faqs.map((faq, i) => (
              <AccordionItem
                key={i}
                value={`faq-${i}`}
                className="rounded-xl border border-border/60 bg-card px-6 hover:border-primary/30 transition-colors duration-200 data-[state=open]:border-primary/30 data-[state=open]:shadow-md"
              >
                <AccordionTrigger className="text-left font-display font-bold text-foreground py-5 hover:no-underline hover:text-primary transition-colors">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-muted-foreground leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </motion.div>
      </div>
    </section>
  );
}
