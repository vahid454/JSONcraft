import { useEffect, useRef, useState } from "react";

const CLIENT_ID = "AcC409Ktt9mGsrhQrep83oigkfYXU2vEyPF9htYBnW_3oLJ_Nc8e278RSMAZXeKWgFJEyErkJtHzgCUV";
const PLAN_ID   = "P-1M12095393576834GNG37AHQ";

// Load PayPal SDK once globally
let sdkLoaded = false;
let sdkCallbacks = [];

function loadSDK(cb) {
  if (sdkLoaded) { cb(); return; }
  sdkCallbacks.push(cb);
  if (sdkCallbacks.length > 1) return; // already loading
  const script = document.createElement("script");
  script.src = `https://www.paypal.com/sdk/js?client-id=${CLIENT_ID}&vault=true&intent=subscription&components=buttons`;
  script.setAttribute("data-sdk-integration-source", "button-factory");
  script.onload = () => {
    sdkLoaded = true;
    sdkCallbacks.forEach(fn => fn());
    sdkCallbacks = [];
  };
  document.head.appendChild(script);
}

export default function PayPalButton({ onSuccess }) {
  const containerRef = useRef(null);
  const rendered     = useRef(false);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(false);

  useEffect(() => {
    rendered.current = false;
    loadSDK(() => {
      setLoading(false);
      // Small delay to ensure container is in DOM
      setTimeout(() => {
        if (!containerRef.current || rendered.current) return;
        rendered.current = true;

        window.paypal.Buttons({
          style: {
            shape: "rect",
            color: "gold",
            layout: "vertical",
            label: "subscribe",
            height: 45,
          },
          createSubscription: (data, actions) =>
            actions.subscription.create({ plan_id: PLAN_ID }),
          onApprove: (data) => {
            if (onSuccess) onSuccess(data.subscriptionID);
          },
          onCancel: () => {
            // user cancelled — do nothing
          },
          onError: (err) => {
            console.error("PayPal error:", err);
            setError(true);
          },
        }).render(containerRef.current).catch(() => {
          setError(true);
        });
      }, 100);
    });

    return () => {
      rendered.current = false;
    };
  }, []);

  if (error) {
    return (
      <div style={{
        padding: "14px", background: "#1e1e1e", borderRadius: 8,
        border: "1px solid #3f3f3f", textAlign: "center",
      }}>
        <div style={{ fontSize: 12, color: "#f87171", marginBottom: 8 }}>
          PayPal failed to load. Please disable ad blockers and try again.
        </div>
        <button
          onClick={() => { setError(false); rendered.current = false; }}
          style={{
            fontSize: 12, color: "#10b981", background: "transparent",
            border: "1px solid #10b981", borderRadius: 6,
            padding: "6px 14px", cursor: "pointer", fontFamily: "inherit",
          }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div>
      {loading && (
        <div style={{
          height: 45, background: "#1f2937", borderRadius: 6,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 12, color: "#4b5563",
        }}>
          Loading PayPal...
        </div>
      )}
      <div ref={containerRef} style={{ minHeight: loading ? 0 : 50 }} />
    </div>
  );
}