import { Zap, Leaf, TrendingDown, Shield } from "lucide-react";

const benefits = [
  {
    icon: TrendingDown,
    label: "Economia de até",
    value: "90%",
    bgColor: "bg-primary/10",
    iconColor: "text-primary",
    valueColor: "text-primary",
  },
  {
    icon: Leaf,
    label: "Energia",
    value: "Sustentável",
    bgColor: "bg-green-100",
    iconColor: "text-green-600",
    valueColor: "text-green-600",
  },
  {
    icon: Shield,
    label: "Garantia de",
    value: "25 Anos",
    bgColor: "bg-secondary/10",
    iconColor: "text-secondary",
    valueColor: "text-secondary",
  },
  {
    icon: Zap,
    label: "Instalação",
    value: "Rápida",
    bgColor: "bg-primary/10",
    iconColor: "text-primary",
    valueColor: "text-primary",
  },
];

export function HeroSection() {
  return (
    <section className="py-12 md:py-20">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-3xl mx-auto mb-12">
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-6">
            Economize até 90% na sua{" "}
            <span className="text-brand-orange">Conta de Energia!</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-8">
            Desde 2009 gerando economia, autonomia e impacto positivo. Soluções em
            energia solar para residências, comércios, indústrias e propriedades
            rurais.
          </p>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-12 max-w-4xl mx-auto">
          {benefits.map((benefit, index) => (
            <div
              key={index}
              className="flex items-center gap-3 bg-white rounded-xl p-4 shadow-sm border border-border"
            >
              <div
                className={`w-10 h-10 rounded-full ${benefit.bgColor} flex items-center justify-center`}
              >
                <benefit.icon className={`w-5 h-5 ${benefit.iconColor}`} />
              </div>
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {benefit.label}
                </p>
                <p className={`${benefit.valueColor} font-bold`}>{benefit.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
