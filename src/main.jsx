import React, { useCallback, useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { Excalidraw } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import "./style.css";

const DEFAULT_HASH = "#room=47732dff42e6388fe867,hcNTq-TdX-jtF6t33kxA2Q";
const ORIGINAL_ROOM = `https://excalidraw.com/${DEFAULT_HASH}`;

function Toast({ message }) {
  return <div className={`toast ${message ? "show" : ""}`}>{message}</div>;
}

function App() {
  const [scene, setScene] = useState(null);
  const [error, setError] = useState("");
  const [api, setApi] = useState(null);
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!location.hash) history.replaceState(null, "", `${location.pathname}${DEFAULT_HASH}`);
    fetch("/scene-data.json", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load scene (${res.status})`);
        return res.json();
      })
      .then((data) => setScene({
        ...data,
        appState: {
          ...(data.appState || {}),
          viewBackgroundColor: "#000000",
          theme: "dark",
          viewModeEnabled: true,
        },
        scrollToContent: true,
      }))
      .catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    if (!api || !scene) return;
    api.updateScene({
      elements: scene.elements,
      appState: {
        ...scene.appState,
        viewBackgroundColor: "#000000",
        theme: "dark",
        viewModeEnabled: true,
        zenModeEnabled: false,
        collaborators: [],
      },
      files: scene.files,
    });
    [150, 800, 1800].forEach((delay) => {
      setTimeout(() => {
        api.scrollToContent(scene.elements, { fitToContent: true, animate: false });
        api.refresh?.();
      }, delay);
    });
  }, [api, scene]);

  const showToast = useCallback((message) => {
    setToast(message);
    window.clearTimeout(window.__toastTimer);
    window.__toastTimer = window.setTimeout(() => setToast(""), 1800);
  }, []);

  const copyText = useCallback(async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const input = document.createElement("textarea");
      input.value = text;
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.appendChild(input);
      input.focus();
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    showToast(label);
  }, [showToast]);

  const viewOnlyUrl = useMemo(() => `${location.origin}${location.pathname}${location.hash || DEFAULT_HASH}`, []);

  const downloadScene = useCallback(() => {
    if (!scene) return;
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = "view-only-board.excalidraw";
    a.click();
    URL.revokeObjectURL(href);
    showToast("Scene downloaded");
  }, [scene, showToast]);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <div className="mark">✦</div>
          <div>
            <strong>Excalidraw</strong>
            <span>view-only board</span>
          </div>
        </div>
        <div className="tools" aria-hidden="true">
          <div className="tool">↖</div><div className="tool active">▭</div><div className="tool">◇</div><div className="tool">○</div><div className="tool">→</div><div className="tool">A</div><div className="tool">✎</div><div className="tool">🖐</div>
        </div>
        <div className="actions">
          <button className="primary" onClick={() => copyText(viewOnlyUrl, "View-only link copied")}>Copy view-only link</button>
          <button onClick={() => copyText(JSON.stringify(scene ?? {}, null, 2), "Scene JSON copied")} disabled={!scene}>Copy scene</button>
          <button onClick={downloadScene} disabled={!scene}>Download</button>
          <button className="locked" disabled>Editing locked</button>
        </div>
      </header>

      <main className="canvas-wrap">
        <div className="notice"><span className="pill">VIEW ONLY</span><span>This board includes the new repo file. You can copy/share it, but editing is disabled here.</span></div>
        {error ? <div className="error">{error}</div> : null}
        {!scene && !error ? <div className="loading">Loading board…</div> : null}
        {scene ? (
          <Excalidraw
            excalidrawAPI={setApi}
            initialData={scene}
            viewModeEnabled={true}
            zenModeEnabled={false}
            theme="dark"
            gridModeEnabled={false}
            detectScroll={false}
            UIOptions={{
              canvasActions: {
                changeViewBackgroundColor: false,
                clearCanvas: false,
                export: false,
                loadScene: false,
                saveAsImage: false,
                saveToActiveFile: false,
                toggleTheme: false,
              },
              tools: { image: false },
            }}
          />
        ) : null}
      </main>

      <footer className="statusbar">
        <span>Room: 47732dff42e6388fe867</span>
        <span>{scene?.elements?.length ?? 0} elements loaded • Original: {ORIGINAL_ROOM}</span>
      </footer>
      <Toast message={toast} />
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
