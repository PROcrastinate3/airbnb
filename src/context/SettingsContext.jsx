import { useEffect, useState } from "react";
import { loadSettings } from "../services/settingsService.js";
import { Spinner } from "../components/ui.jsx";

// Loads /settings/platform once before the app renders, so sync getters (getCategories, getServiceFeeRate) are safe.
export function SettingsProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadSettings()
      .then(() => setReady(true))
      .catch((e) => setError(e.message || "Could not load settings."));
  }, []);

  if (error) return <p className="p-8 text-center text-red-600">{error}</p>;
  if (!ready)
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner />
      </div>
    );
  return children;
}
