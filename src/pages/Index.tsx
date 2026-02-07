import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import WhatsAppButton from "@/components/WhatsAppButton";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  HeroBanner,
  AboutSection,
  ServicesSection,
  ProjectsSection,
  InstagramSection,
  CTASection,
  TestimonialsSection,
  ContactSection,
} from "@/components/institutional";
import { VendorLandingPage } from "@/components/vendor/VendorLandingPage";

// WhatsApp da Mais Energia Solar
const WHATSAPP_NUMBER = "5532998437675";

export default function Index() {
  const [searchParams] = useSearchParams();

  // Detecta se é link de vendedor
  const isVendorLink = useMemo(() => {
    return !!(searchParams.get("v") || searchParams.get("vendedor"));
  }, [searchParams]);

  // Página dedicada para links de vendedores
  if (isVendorLink) {
    return <VendorLandingPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroBanner />
      <AboutSection />
      <ServicesSection />
      <CTASection />
      <ProjectsSection />
      <InstagramSection />
      <TestimonialsSection />
      <ContactSection />
      <Footer />
      <WhatsAppButton phoneNumber={WHATSAPP_NUMBER} />
    </div>
  );
}
