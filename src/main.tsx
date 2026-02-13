import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import { initPWAPromptCapture } from "./lib/pwa-install-prompt";
import App from "./App.tsx";
import "./index.css";

// Capturar beforeinstallprompt ANTES de qualquer componente montar
initPWAPromptCapture();

// Inicializar error tracking antes de renderizar
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
