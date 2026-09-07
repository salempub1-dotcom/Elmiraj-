import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import "./cart-polish.css";
import "./cart-frame.css";
import "./brand-polish.css";
import "./dark-mode.css";
import "./bilingual.css";
import "./components/AiAssistantRobot.css";
import { App } from "./App";
import AiAssistantGate from "./components/AiAssistantGate";
import DeliveryProviderDialog from "./components/admin/DeliveryProviderDialog";
import DeliveryProviderLabels from "./components/admin/DeliveryProviderLabels";
import { installDeliveryFetchBridge } from "./services/deliveryBridge";
import { installUiSounds } from "./utils/uiSounds";
import { installStorefrontTheme } from "./utils/storefrontTheme";
import { installPurchaseSoundIsolation } from "./utils/purchaseSoundIsolation";
import { installStorefrontLanguage } from "./utils/storefrontLanguage";
import { installProductVideoEnhancement } from "./utils/productVideoEnhancement";

// Keep the proven App.tsx/NOEST handlers untouched. This scoped bridge only
// redirects the three delivery actions (send/resend/sync) to the generic
// provider API and leaves every other store/admin request unchanged.
installDeliveryFetchBridge();

// Product videos are optional and stored in Supabase Storage. This enhancement
// injects the admin upload UI and exposes video playback without changing the
// existing products table schema or the proven App.tsx product form logic.
installProductVideoEnhancement();

// Preserve the original product-specific sounds on "add to cart" and "buy now"
// by excluding those buttons from the newer global click sound.
installPurchaseSoundIsolation();

// Lightweight storefront interaction sounds for the rest of the UI.
installUiSounds();

// Optional premium dark mode. Light remains the default; visitor choice is
// persisted locally and the admin/dashboard routes stay untouched.
installStorefrontTheme();

// Optional AR / EN storefront UI. Arabic remains the default, the visitor's
// choice is persisted locally, and admin/dashboard routes remain Arabic RTL.
installStorefrontLanguage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <AiAssistantGate />
      <DeliveryProviderDialog />
      <DeliveryProviderLabels />
    </BrowserRouter>
  </StrictMode>
);