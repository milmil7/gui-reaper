import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {ThemeProvider} from "./ThemeChanger.jsx";
import {ChartSettingsProvider} from "./SettingsDropdown.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
      <ThemeProvider>
          <ChartSettingsProvider>
              <App />
          </ChartSettingsProvider>
      </ThemeProvider>
  </React.StrictMode>,
);
