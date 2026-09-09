"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ margin: "40px auto", maxWidth: 640, padding: 16, textAlign: "center" }}>
      <p style={{ fontWeight: 700, color: "#a00" }}>&#x1F6D1; Không tải được dữ liệu nhà.</p>
      <pre
        style={{
          fontFamily: "ui-monospace, monospace",
          fontSize: 12,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          textAlign: "left",
          background: "#fff5f5",
          border: "1px solid #d33",
          borderRadius: 8,
          padding: 12,
        }}
      >
        {error.message}
        {"\n\n"}
        {error.digest ?? ""}
      </pre>
      <button
        onClick={() => retry()}
        style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
      >
        Thử lại
      </button>
    </div>
  );
}