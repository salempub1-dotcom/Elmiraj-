import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./cart-polish.css";
import "./cart-frame.css";
import "./brand-polish.css";
import "./dark-mode.css";
import { App } from "./App";
import DeliveryProviderDialog from "./components/admin/DeliveryProviderDialog";
import DeliveryProviderLabels from "./components/admin/DeliveryProviderLabels";
import { installDeliveryFetchBridge } from "./services/deliveryBridge";
import { installUiSounds } from "./utils/uiSounds";
import { installStorefrontTheme } from "./utils/storefrontTheme";

// Keep the proven App.tsx/NOEST handlers untouched. This scoped bridge only
// redirects the three delivery actions (send/resend/sync) to the generic
// provider API and leaves every other store/admin request unchanged.
installDeliveryFetchBridge();

// Lightweight storefront interaction sounds.
installUiSounds();

// Optional premium dark mode. Light remains the default; visitor choice is
// persisted locally and the admin/dashboard routes stay untouched.
installStorefrontTheme();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <DeliveryProviderDialog />
      <DeliveryProviderLabels />
    </BrowserRouter>
  </StrictMode>
);