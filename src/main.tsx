// No Bootstrap JS bundle — react-bootstrap owns all interactive behavior
// (dropdowns, modals, etc.) via React, per CLAUDE.md.
import "./styles/main.scss";
// Font Awesome (npm package, not a CDN) — was only wired into the
// back-office's lazy chunk; the passenger UI now uses the same icon set too
// (HomePage benefits, PublicFooter), so it must load globally.
import "@fortawesome/fontawesome-free/css/all.min.css";
import "./i18n";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
