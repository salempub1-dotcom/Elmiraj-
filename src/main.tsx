import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "./index.css";
import { App } from "./App";
import DeliveryProviderDialog from "./components/admin/DeliveryProviderDialog";
import { installDeliveryFetchBridge } from "./services/deliveryBridge";

// Keep the proven App.tsx/NOEST handlers untouched. This scoped bridge only
// redirects the three delivery actions (send/resend/sync) to the generic
// provider API and leaves every other store/admin request unchanged.
installDeliveryFetchBridge();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <DeliveryProviderDialog />
    </BrowserRouter>
  </StrictMode>
);