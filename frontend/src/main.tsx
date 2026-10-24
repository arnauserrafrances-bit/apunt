import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import App from "./App";
import { APP_NAME } from "./config";
import { StoreProvider } from "./store/AppStore";
import { LocalStorageRepository } from "./store/repository";
import { ToastProvider } from "./components/Toast";
import "./index.css";

document.title = APP_NAME;

const repository = new LocalStorageRepository();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider repository={repository}>
        <ToastProvider>
          <App />
        </ToastProvider>
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>,
);
