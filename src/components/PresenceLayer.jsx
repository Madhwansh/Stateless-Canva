// components/PresenceLayer.jsx
import React from "react";

/**
 * Draws floating cursors for remote users (and optionally for self).
 * Expects positions in canvas pixel coordinates (same as Fabric canvas).
 */
export default function PresenceLayer({ meId, users, showSelf = false }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40">
      {users.map((u) => {
        if (!u || !u.id) return null;
        if (!showSelf && u.id === meId) return null;
        if (u.hidden) return null;

        const size = 12;
        const namePad = 6;

        return (
          <div
            key={u.id}
            className="absolute"
            style={{
              transform: `translate(${(u.x ?? 0) - size}px, ${
                (u.y ?? 0) - size
              }px)`,
            }}
          >
            {/* Cursor dot */}
            <div
              style={{
                width: size,
                height: size,
                background: u.color || "#3b82f6",
                borderRadius: "9999px",
                boxShadow: "0 0 0 2px rgba(255,255,255,0.9)",
              }}
            />
            {/* Name tag */}
            <div
              className="mt-1 px-2 py-[2px] rounded-md text-xs font-medium shadow"
              style={{
                background: "rgba(0,0,0,0.65)",
                color: "white",
                transform: `translateX(${namePad}px)`,
                whiteSpace: "nowrap",
                backdropFilter: "blur(4px)",
              }}
            >
              {u.name || "Guest"}
              {u.isDrawing ? " ✏️" : ""}
            </div>
          </div>
        );
      })}
    </div>
  );
}
