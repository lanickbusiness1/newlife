import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import StartEntryView from "./StartEntryView";
import CeaReturnView from "./CeaReturnView";
import { isStartEntryPath } from "./startEntry";
import { isCeaReturnPath } from "./ceaReturn";
import "./startEntry.css";

const RootView = isCeaReturnPath(window.location.pathname)
  ? CeaReturnView
  : isStartEntryPath(window.location.pathname)
    ? StartEntryView
    : App;

createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RootView />
  </React.StrictMode>
);
