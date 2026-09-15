import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import StartEntryView from "./StartEntryView";
import { isStartEntryPath } from "./startEntry";

const RootView = isStartEntryPath(window.location.pathname) ? StartEntryView : App;

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootView />
  </React.StrictMode>
);
