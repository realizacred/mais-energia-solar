import { Zap, Leaf, TrendingDown, Shield } from "lucide-react";

const benefits = [
  {
    icon: TrendingDown,
    label: "Economia de até",
    value: "90%",
    accent: "primary" as const,
  },
  {
    icon: Leaf,
    label: "Energia",
    value: "Sustentável",
    accent: "success" as const,
  },
  {
    icon: Shield,
    label: "Garantia de",
    value: "25 Anos",
    accent: "secondary" as const,
  },
  {
    icon: Zap,
    label: "Instalação",
    value: "Rápida",
    accent: "primary" as const,
  },
];

const accentStyles = {
  primary: {
    bg: "bg-primary/10",
    icon: "text-primary",
    value: "text-primary",
  },
  success: {
    bg: "bg-success/10",
    icon: "text-success",
    value: "text-success",
  },
  secondary: {
    bg: "bg-secondary/10",
    icon: "text-secondary",
    value: "text-secondary",
  },
};

export function HeroSection() {
  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Economize até 90% na sua{" "}
            <span className="text-primary">Conta de Energia!</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Desde 2009 gerando economia, autonomia e impacto positivo. Soluções em
            energia solar para residências, comércios, indústrias e propriedades
            rurais.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12 max-w-4xl mx-auto">
          {benefits.map((benefit, index) => {
            const styles = accentStyles[benefit.accent];
            return (
              <div
                key={index}
                className="flex items-center gap-3 bg-card rounded-xl p-4 shadow-sm border border-border hover:border-primary/30 hover:shadow-md transition-all duration-300 hover-lift"
              >
                <div
                  className={`w-10 h-10 rounded-full ${styles.bg} flex items-center justify-center`}
                >
                  <benefit.icon className={`w-5 h-5 ${styles.icon}`} />
                </div>
                <div>
                  <p className="font-semibold text-sm text-foreground">
                    {benefit.label}
                  </p>
                  <p className={`${styles.value} font-bold`}>{benefit.value}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
