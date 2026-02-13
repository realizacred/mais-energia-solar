import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import WhatsAppButton from "@/components/WhatsAppButton";
import CookieConsent from "@/components/CookieConsent";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import {
  HeroBanner,
  AboutSection,
  HowItWorksSection,
  ServicesSection,
  SavingsComparisonSection,
  ProjectsSection,
  InstagramSection,
  CTASection,
  TestimonialsSection,
  FAQSection,
  PartnersSection,
  ContactSection,
} from "@/components/institutional";
import { VendorLandingPage } from "@/components/vendor/VendorLandingPage";

export default function Index() {
  const [searchParams] = useSearchParams();

  const isVendorLink = useMemo(() => {
    return !!(searchParams.get("v") || searchParams.get("vendedor"));
  }, [searchParams]);

  if (isVendorLink) {
    return <VendorLandingPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <HeroBanner />
      <AboutSection />
      <HowItWorksSection />
      <ServicesSection />
      <SavingsComparisonSection />
      <CTASection />
      <ProjectsSection />
      <TestimonialsSection />
      <PartnersSection />
      <FAQSection />
      <InstagramSection />
      <ContactSection />
      <Footer />
      <WhatsAppButton />
      <CookieConsent />
    </div>
  );
}
