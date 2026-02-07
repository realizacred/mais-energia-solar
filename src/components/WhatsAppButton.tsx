import { useState, forwardRef } from "react";
import { MessageCircle, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";

interface WhatsAppButtonProps {
  phoneNumber: string;
  message?: string;
}

const WhatsAppButton = forwardRef<HTMLDivElement, WhatsAppButtonProps>(function WhatsAppButton({ 
  phoneNumber, 
  message = "Olá! Gostaria de saber mais sobre energia solar." 
}, ref) {
  const [isOpen, setIsOpen] = useState(false);

  const formatPhoneForWhatsApp = (phone: string) => {
    // Remove all non-numeric characters
    return phone.replace(/\D/g, "");
  };

  const openWhatsApp = () => {
    const formattedPhone = formatPhoneForWhatsApp(phoneNumber);
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <div ref={ref} className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.8 }}
            className="absolute bottom-16 right-0 bg-white rounded-xl shadow-2xl p-4 w-72 border"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-green-500 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-semibold text-sm">Mais Energia Solar</p>
                <p className="text-xs text-green-600">Online agora</p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Olá! 👋 Como podemos ajudar você a economizar com energia solar?
            </p>
            <Button
              onClick={openWhatsApp}
              className="w-full bg-green-500 hover:bg-green-600 gap-2"
            >
              <Phone className="w-4 h-4" />
              Iniciar Conversa
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg flex items-center justify-center transition-colors"
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </motion.button>
    </div>
  );
});

export default WhatsAppButton;
