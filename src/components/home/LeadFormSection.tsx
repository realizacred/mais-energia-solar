import LeadFormWizard from "@/components/LeadFormWizard";

export function LeadFormSection() {
  return (
    <section className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
            Solicite Seu Orçamento Gratuito
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Preencha o formulário abaixo e receba uma proposta personalizada para
            o seu imóvel.
          </p>
        </div>
        <LeadFormWizard />
      </div>
    </section>
  );
}
