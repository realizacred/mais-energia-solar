import { forwardRef } from "react";
import { Phone, Mail, MapPin, Instagram, ArrowUpRight, Sun } from "lucide-react";
import logoBranca from "@/assets/logo-branca.png";

const Footer = forwardRef<HTMLElement>(function Footer(props, ref) {
  return (
    <footer ref={ref} className="relative py-12 bg-secondary text-secondary-foreground overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/3 rounded-full blur-2xl translate-y-1/3 -translate-x-1/4" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent" />

      <div className="container mx-auto px-4 relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 mb-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <img
              src={logoBranca}
              alt="Mais Energia Solar"
              className="h-10 w-auto mb-5"
            />
            <p className="text-secondary-foreground/45 text-sm leading-relaxed max-w-xs">
              Soluções em energia solar fotovoltaica para residências, comércios, indústrias e propriedades rurais.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-5 text-secondary-foreground/70">Contato</h4>
            <div className="space-y-3">
              <a
                href="tel:+5532998437675"
                className="flex items-center gap-2.5 text-secondary-foreground/55 hover:text-secondary-foreground transition-colors text-sm group"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                </div>
                (32) 99843-7675
              </a>
              <a
                href="mailto:contato@maisenergiasolar.com.br"
                className="flex items-center gap-2.5 text-secondary-foreground/55 hover:text-secondary-foreground transition-colors text-sm group"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Mail className="w-3.5 h-3.5 text-primary" />
                </div>
                contato@maisenergiasolar.com.br
              </a>
              <div className="flex items-center gap-2.5 text-secondary-foreground/55 text-sm">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                </div>
                Cataguases - MG
              </div>
            </div>
          </div>

          {/* Social */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-5 text-secondary-foreground/70">Redes</h4>
            <div className="space-y-3">
              <a
                href="https://www.instagram.com/maismaisenergiasolaroficial/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-secondary-foreground/55 hover:text-secondary-foreground transition-colors text-sm group"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Instagram className="w-3.5 h-3.5 text-primary" />
                </div>
                <span className="truncate">@maismaisenergiasolaroficial</span>
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </a>
              <a
                href="https://wa.me/5532998437675"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-secondary-foreground/55 hover:text-secondary-foreground transition-colors text-sm group"
              >
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Phone className="w-3.5 h-3.5 text-primary" />
                </div>
                WhatsApp
                <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-60 transition-opacity shrink-0" />
              </a>
            </div>
          </div>

          {/* Quick CTA */}
          <div>
            <h4 className="font-display font-bold text-sm uppercase tracking-wider mb-5 text-secondary-foreground/70">Economize</h4>
            <p className="text-secondary-foreground/45 text-sm leading-relaxed mb-4">
              Solicite seu orçamento gratuito e comece a economizar com energia solar.
            </p>
            <a
              href="https://wa.me/5532998437675?text=Ol%C3%A1%2C%20gostaria%20de%20um%20or%C3%A7amento%20de%20energia%20solar"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary/15 border border-primary/25 text-primary text-sm font-semibold hover:bg-primary/25 transition-all duration-300 hover:-translate-y-0.5"
            >
              <Sun className="w-4 h-4" />
              Fale conosco
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="pt-8 border-t border-secondary-foreground/8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-secondary-foreground/30">
            © {new Date().getFullYear()} Mais Energia Solar. Todos os direitos reservados.
          </p>
          <p className="text-xs text-secondary-foreground/20">
            Cataguases, Minas Gerais · Brasil
          </p>
        </div>
      </div>
    </footer>
  );
});

export default Footer;
