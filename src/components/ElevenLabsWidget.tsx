import { createElement, useEffect } from "react";

const SCRIPT_ID = "elevenlabs-convai-widget-embed";
const SCRIPT_SRC = "https://unpkg.com/@elevenlabs/convai-widget-embed";
const AGENT_ID =
  import.meta.env.VITE_ELEVENLABS_AGENT_ID ?? "agent_0601kj0ahmzeej18y9xp6av1bdrh";

export function ElevenLabsWidget() {
  useEffect(() => {
    if (document.getElementById(SCRIPT_ID)) return;

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = SCRIPT_SRC;
    script.async = true;
    script.type = "text/javascript";
    document.body.appendChild(script);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[70]">
      {createElement("elevenlabs-convai", { "agent-id": AGENT_ID } as Record<string, string>)}
    </div>
  );
}
