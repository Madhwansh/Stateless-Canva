import React, { useRef, useState } from "react";
import { motion } from "framer-motion";

/**
 * Glassy header with sliding cursor.
 * overlay=true -> absolute inside parent (ideal for Hero)
 * overlay=false -> fixed to viewport top (classic navbar)
 */
export default function Header({
  items = ["Home", "Features", "About", "Contact"],
  onSelect,
  overlay = true,
}) {
  const [position, setPosition] = useState({ left: 0, width: 0, opacity: 0 });

  const wrapperClass = overlay
    ? // sits inside Hero, slightly inset from top
      "absolute top-6 left-0 w-full z-40"
    : // fallback: fixed nav
      "fixed top-0 left-0 w-full z-50";

  return (
    <header className={wrapperClass}>
      <div className="mx-auto max-w-6xl px-4">
        <ul
          onMouseLeave={() => setPosition((pv) => ({ ...pv, opacity: 0 }))}
          className="
            relative mx-auto flex w-fit rounded-full
            border border-white/20
            bg-white/10/50  /* logical comment: transparent base */
            backdrop-blur-xl
            p-1 shadow-[0_2px_24px_rgba(0,0,0,0.35)]
            ring-1 ring-white/10
          "
          style={{
            background:
              "rgba(20, 20, 32, 0.28)" /* subtle dark glass so rays shine through */,
          }}
        >
          {items.map((label) => (
            <Tab
              key={label}
              label={label}
              setPosition={setPosition}
              onSelect={onSelect}
            />
          ))}
          <Cursor position={position} />
        </ul>
      </div>
    </header>
  );
}

function Tab({ label, setPosition, onSelect }) {
  const ref = useRef(null);
  return (
    <li
      ref={ref}
      onMouseEnter={() => {
        if (!ref?.current) return;
        const { width } = ref.current.getBoundingClientRect();
        setPosition({
          left: ref.current.offsetLeft,
          width,
          opacity: 1,
        });
      }}
      onClick={() => onSelect?.(label)}
      className="relative z-10 block cursor-pointer select-none
                 px-3 py-1.5 md:px-5 md:py-3 text-xs md:text-base uppercase
                 text-white mix-blend-difference"
    >
      {label}
    </li>
  );
}

function Cursor({ position }) {
  return (
    <motion.li
      animate={{ ...position }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="absolute z-0 h-7 md:h-12 rounded-full
                 bg-[#601ef9]/25 backdrop-blur-md shadow-inner"
    />
  );
}
