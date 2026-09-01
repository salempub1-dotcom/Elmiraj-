import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./cart-polish.css";
import { App } from "./App";
import DeliveryProviderDialog from "./components/admin/DeliveryProviderDialog";
import DeliveryProviderLabels from "./components/admin/DeliveryProviderLabels";
import { installDeliveryFetchBridge } from "./services/deliveryBridge";
import { installUiSounds } from "./utils/uiSounds";

// Keep the proven App.tsx/NOEST handlers untouched. This scoped bridge only
// redirects the three delivery actions (send/resend/sync) to the generic
// provider API and leaves every other store/admin request unchanged.
installDeliveryFetchBridge();

// Tiny Web Audio cues: no audio files, no extra requests, and hover sound only
// unlocks after the visitor's first interaction to respect browser policies.
installUiSounds();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <DeliveryProviderDialog />
      <DeliveryProviderLabels />
    </BrowserRouter>
  </StrictMode>
);