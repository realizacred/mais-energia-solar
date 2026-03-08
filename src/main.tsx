import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import { initPWAPromptCapture } from "./lib/pwa-install-prompt";
import { cleanupLegacyServiceWorkers, debugServiceWorkers } from "./lib/sw-cleanup";
import App from "./App.tsx";
import "./index.css";

// 1. Remove legacy SWs BEFORE anything else (passive & active cleanup)
cleanupLegacyServiceWorkers();

// 2. Capturar beforeinstallprompt ANTES de qualquer componente montar
initPWAPromptCapture();

// 3. Debug SW state in dev
if (import.meta.env.DEV) {
  debugServiceWorkers();
}

// 4. Inicializar error tracking antes de renderizar
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
