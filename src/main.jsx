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
  const [copyFeedback, setCopyFeedback] = useState(null);

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
          theme: "light",
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
        theme: "light",
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

  const getCopyPayloadForElement = useCallback((element) => {
    if (!element || !scene?.elements) return null;

    if (element.type === "text") {
      return {
        text: element.text || element.originalText || "",
        label: "Text copied",
      };
    }

    const boundTextId = element.boundElements?.find((item) => item.type === "text")?.id;
    const boundText = boundTextId ? scene.elements.find((item) => item.id === boundTextId) : null;
    if (boundText?.text || boundText?.originalText) {
      return {
        text: boundText.text || boundText.originalText,
        label: "Label copied",
      };
    }

    if (element.type === "image") {
      return {
        text: `Image element: ${element.id}`,
        label: "Image reference copied",
      };
    }

    return {
      text: JSON.stringify(element, null, 2),
      label: `${element.type || "Element"} copied`,
    };
  }, [scene]);

  const getElementViewportRect = useCallback((element) => {
    if (!api || !element) return null;
    const appState = api.getAppState();
    const canvasRect = document.querySelector(".canvas-wrap")?.getBoundingClientRect();
    const zoom = appState?.zoom?.value || 1;
    if (!canvasRect || !zoom) return null;

    const x1 = (Math.min(element.x, element.x + (element.width || 0)) + appState.scrollX) * zoom + canvasRect.left;
    const y1 = (Math.min(element.y, element.y + (element.height || 0)) + appState.scrollY) * zoom + canvasRect.top;
    const x2 = (Math.max(element.x, element.x + (element.width || 0)) + appState.scrollX) * zoom + canvasRect.left;
    const y2 = (Math.max(element.y, element.y + (element.height || 0)) + appState.scrollY) * zoom + canvasRect.top;

    return {
      left: Math.max(8, x1 - 8),
      top: Math.max(66, y1 - 8),
      width: Math.max(44, x2 - x1 + 16),
      height: Math.max(32, y2 - y1 + 16),
    };
  }, [api]);

  const copyElement = useCallback((element, point = null) => {
    const payload = getCopyPayloadForElement(element);
    if (!payload?.text) return;
    copyText(payload.text, payload.label);

    const rect = getElementViewportRect(element);
    const position = point || (rect ? { x: rect.left + rect.width / 2, y: rect.top } : { x: window.innerWidth / 2, y: 100 });
    setCopyFeedback({
      ...payload,
      id: element?.id,
      type: element?.type || "object",
      rect,
      x: Math.min(window.innerWidth - 150, Math.max(12, position.x - 70)),
      y: Math.min(window.innerHeight - 110, Math.max(72, position.y - 48)),
      preview: payload.text.length > 160 ? `${payload.text.slice(0, 160)}…` : payload.text,
    });
    window.clearTimeout(window.__copyFeedbackTimer);
    window.__copyFeedbackTimer = window.setTimeout(() => setCopyFeedback(null), 3500);
  }, [copyText, getCopyPayloadForElement, getElementViewportRect]);

  const findElementAtViewportPoint = useCallback((clientX, clientY) => {
    if (!api || !scene?.elements) return null;
    const appState = api.getAppState();
    const canvasRect = document.querySelector(".canvas-wrap")?.getBoundingClientRect();
    const zoom = appState?.zoom?.value || 1;
    if (!canvasRect || !zoom) return null;

    const sceneX = (clientX - canvasRect.left) / zoom - appState.scrollX;
    const sceneY = (clientY - canvasRect.top) / zoom - appState.scrollY;
    const hitPadding = Math.max(10 / zoom, 18);

    return [...scene.elements].reverse().find((element) => {
      if (!element || element.isDeleted) return false;
      const minX = Math.min(element.x, element.x + (element.width || 0)) - hitPadding;
      const maxX = Math.max(element.x, element.x + (element.width || 0)) + hitPadding;
      const minY = Math.min(element.y, element.y + (element.height || 0)) - hitPadding;
      const maxY = Math.max(element.y, element.y + (element.height || 0)) + hitPadding;
      return sceneX >= minX && sceneX <= maxX && sceneY >= minY && sceneY <= maxY;
    }) || null;
  }, [api, scene]);

  const handleCanvasClick = useCallback((event) => {
    if (event.target?.closest?.("button, a, input, textarea, [role='button'], .copy-card")) return;
    const element = findElementAtViewportPoint(event.clientX, event.clientY);
    copyElement(element, { x: event.clientX, y: event.clientY });
  }, [copyElement, findElementAtViewportPoint]);

  useEffect(() => {
    window.__copyElementPayload = (id) => {
      const element = scene?.elements?.find((item) => item.id === id);
      return getCopyPayloadForElement(element);
    };
  }, [scene, getCopyPayloadForElement]);

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

      <main className="canvas-wrap" onClickCapture={handleCanvasClick}>
        <div className="notice"><span className="pill">CLICK TO COPY</span><span>Tap any text, box, graph, or object — it flashes and shows what was copied.</span></div>
        {error ? <div className="error">{error}</div> : null}
        {!scene && !error ? <div className="loading">Loading board…</div> : null}
        {copyFeedback?.rect ? <div className="copy-outline" style={{ left: copyFeedback.rect.left, top: copyFeedback.rect.top, width: copyFeedback.rect.width, height: copyFeedback.rect.height }} /> : null}
        {copyFeedback ? (
          <div className="copy-pop" style={{ left: copyFeedback.x, top: copyFeedback.y }}>
            ✓ Copied
          </div>
        ) : null}
        {copyFeedback ? (
          <div className="copy-card">
            <div>
              <strong>{copyFeedback.label}</strong>
              <span>{copyFeedback.preview}</span>
            </div>
            <button className="primary" onClick={() => copyText(copyFeedback.text, "Copied again")}>Copy again</button>
          </div>
        ) : null}
        {scene ? (
          <Excalidraw
            excalidrawAPI={(api) => { setApi(api); window.__excalidrawApi = api; }}
            initialData={scene}
            viewModeEnabled={true}
            zenModeEnabled={false}
            theme="light"
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
