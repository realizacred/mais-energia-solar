import { createRoot } from "react-dom/client";
import { initSentry } from "./lib/sentry";
import App from "./App.tsx";
import "./index.css";

// Inicializar error tracking antes de renderizar
initSentry();

createRoot(document.getElementById("root")!).render(<App />);
