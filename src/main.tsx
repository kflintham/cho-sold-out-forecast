import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { AppStateProvider } from "./state/AppState";
import App from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AppStateProvider>
      <App />
    </AppStateProvider>
  </StrictMode>,
);
