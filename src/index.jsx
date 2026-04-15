import React from "react";
import ReactDOM from "react-dom/client";
import EIcerikEditor from "./EIcerikEditor";

function formatBootError(error) {
  if (!error) return "Bilinmeyen hata";
  if (typeof error === "string") return error;
  return error.stack || error.message || JSON.stringify(error);
}

function reportBootError(title, error) {
  try {
    window.__EIC_BOOT_REPORT__?.(title, formatBootError(error));
  } catch {}
}

class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    reportBootError("React acilis hatasi", error);
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            background:
              "radial-gradient(circle at top, rgba(56,189,248,.2), transparent 34%), linear-gradient(180deg, #0a1220 0%, #09111f 48%, #050b14 100%)",
            color: "#f8fafc",
            fontFamily: '"Segoe UI", Arial, sans-serif',
          }}
        >
          <div
            style={{
              width: "min(680px, 100%)",
              borderRadius: 24,
              border: "1px solid rgba(248, 113, 113, 0.26)",
              background: "rgba(16, 26, 47, 0.94)",
              boxShadow: "0 24px 80px rgba(0, 0, 0, 0.45)",
              padding: 28,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".04em", textTransform: "uppercase", color: "#fca5a5" }}>
              React Hata Siniri
            </div>
            <div style={{ marginTop: 14, fontSize: 30, lineHeight: 1.1, fontWeight: 800 }}>
              Uygulama acilirken durdu
            </div>
            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.6, color: "#d3deef" }}>
              Bu, siyah bos ekran yerine hatayi gorebilmen icin gosterilen yedek ekran.
            </div>
            <pre
              style={{
                marginTop: 16,
                padding: 16,
                borderRadius: 16,
                background: "rgba(10, 18, 32, 0.92)",
                border: "1px solid rgba(248, 113, 113, 0.3)",
                color: "#fecaca",
                font: '12px/1.6 Consolas, "Courier New", monospace',
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {formatBootError(this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function BootReady() {
  React.useEffect(() => {
    window.__EIC_BOOT_DONE__?.();
  }, []);
  return <EIcerikEditor />;
}

try {
  ReactDOM.createRoot(document.getElementById("root")).render(
    <React.StrictMode>
      <AppErrorBoundary>
        <BootReady />
      </AppErrorBoundary>
    </React.StrictMode>
  );
} catch (error) {
  reportBootError("Render baslatilamadi", error);
  throw error;
}
