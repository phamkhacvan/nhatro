"use client";

import { useEffect } from "react";

export default function Error({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div style={{ margin: "40px auto", maxWidth: 640, padding: 16, textAlign: "center" }}>
      <p style={{ fontWeight: 700, color: "#a00" }}>&#x1F6D1; Không tải được dữ liệu nhà.</p>
      <p style={{ marginTop: 8, fontSize: 14, color: "#555" }}>Vui lòng tải lại trang hoặc thử lại sau.</p>
      <button
        onClick={() => retry()}
        style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}
      >
        Thử lại
      </button>
    </div>
  );
}