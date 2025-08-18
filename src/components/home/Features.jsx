import React, { useEffect, useRef, useCallback } from "react";
import { Users, KeyRound, PencilRuler, Share2, History } from "lucide-react";

/* ---------------- Card ---------------- */
export const ScrollStackItem = ({ children, itemClassName = "" }) => (
  <div
    className={[
      "scroll-stack-card relative w-full h-64 my-8 px-10 py-8",
      "rounded-[28px] shadow-[0_10px_40px_rgba(0,0,0,0.25)]",
      "bg-[#610fe9]/10 border border-white/15 backdrop-blur-md",
      "origin-top will-change-transform text-white",
      itemClassName,
    ].join(" ")}
    style={{
      backfaceVisibility: "hidden",
      transformStyle: "preserve-3d",
      // animation variables default
      // --pg is set dynamically per-card in the scroll loop
      "--pg": 0,
    }}
  >
    {children}
  </div>
);

/* -------- Helpers (document coordinates) -------- */
function absTop(el) {
  let y = 0;
  let n = el;
  while (n) {
    y += n.offsetTop || 0;
    n = n.offsetParent;
  }
  return y;
}

/* -------- Window-scroll stack (no nested scrolling) -------- */
function ScrollStackWindow({
  children,
  itemDistance = 100,
  itemScale = 0.035,
  itemStackDistance = 30,
  stackPosition = "20%",
  scaleEndPosition = "10%",
  baseScale = 0.88,
  rotationAmount = 0,
  blurAmount = 0,
}) {
  const containerRef = useRef(null);
  const cardsRef = useRef([]);
  const cachedRef = useRef(false);
  const lastTransformsRef = useRef(new Map());
  const tickingRef = useRef(false);

  const pct = useCallback((v, vh) => {
    if (typeof v === "string" && v.includes("%"))
      return (parseFloat(v) / 100) * vh;
    return +v || 0;
  }, []);

  const lerp01 = (x, a, b) => (x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a));

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    if (!cachedRef.current) {
      cardsRef.current = Array.from(
        containerRef.current.querySelectorAll(".scroll-stack-card")
      );
      cardsRef.current.forEach((card, i, arr) => {
        if (i < arr.length - 1) card.style.marginBottom = `${itemDistance}px`;
        card.style.transformOrigin = "top center";
        card.style.willChange = "transform, filter";
        card.style.backfaceVisibility = "hidden";
      });
      cachedRef.current = true;
    }
  }, [itemDistance]);

  const update = useCallback(() => {
    if (!containerRef.current || cardsRef.current.length === 0) {
      tickingRef.current = false;
      return;
    }

    const vh = window.innerHeight;
    const y = window.scrollY;

    const stackY = pct(stackPosition, vh);
    const scaleEndY = pct(scaleEndPosition, vh);

    const endEl =
      containerRef.current.querySelector(".scroll-stack-end") ||
      cardsRef.current[cardsRef.current.length - 1];
    const endAbs =
      absTop(endEl) +
      (endEl.classList?.contains?.("scroll-stack-end")
        ? 0
        : endEl.offsetHeight);
    const pinEndGlobal = endAbs - vh / 2;

    cardsRef.current.forEach((card, i) => {
      const cardAbs = absTop(card);

      const triggerStart = cardAbs - stackY - itemStackDistance * i;
      const triggerEnd = cardAbs - scaleEndY;
      const pinStart = triggerStart;

      const scaleT = lerp01(y, triggerStart, triggerEnd); // 0→1
      // expose progress to children
      card.style.setProperty("--pg", scaleT.toString());

      const targetScale = baseScale + i * itemScale;
      const scale = 1 - scaleT * (1 - targetScale);
      const rotation = rotationAmount ? i * rotationAmount * scaleT : 0;

      let translateY = 0;
      if (y >= pinStart && y <= pinEndGlobal) {
        translateY = y - cardAbs + stackY + itemStackDistance * i;
      } else if (y > pinEndGlobal) {
        translateY = pinEndGlobal - cardAbs + stackY + itemStackDistance * i;
      }

      let blur = 0;
      if (blurAmount) {
        let topIdx = 0;
        for (let j = 0; j < cardsRef.current.length; j++) {
          const thisAbs = absTop(cardsRef.current[j]);
          const thisStart = thisAbs - stackY - itemStackDistance * j;
          if (y >= thisStart) topIdx = j;
        }
        if (i < topIdx) blur = Math.max(0, (topIdx - i) * blurAmount);
      }

      const snap = (n, f) => Math.round(n * f) / f;
      const next = {
        y: snap(translateY, 100),
        s: snap(scale, 1000),
        r: snap(rotation, 100),
        b: snap(blur, 100),
      };
      const last = lastTransformsRef.current.get(i);
      if (
        !last ||
        Math.abs(last.y - next.y) > 0.1 ||
        Math.abs(last.s - next.s) > 0.001 ||
        Math.abs(last.r - next.r) > 0.1 ||
        Math.abs(last.b - next.b) > 0.1
      ) {
        card.style.transform = `translate3d(0, ${next.y}px, 0) scale(${next.s}) rotate(${next.r}deg)`;
        card.style.filter = next.b ? `blur(${next.b}px)` : "";
        lastTransformsRef.current.set(i, next);
      }
    });

    tickingRef.current = false;
  }, [
    baseScale,
    itemScale,
    itemStackDistance,
    rotationAmount,
    blurAmount,
    pct,
    stackPosition,
    scaleEndPosition,
  ]);

  useEffect(() => {
    measure();
    const onScroll = () => {
      if (tickingRef.current) return;
      tickingRef.current = true;
      requestAnimationFrame(update);
    };
    const onResize = () => {
      lastTransformsRef.current.clear();
      cachedRef.current = false;
      measure();
      onScroll();
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    onScroll();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      lastTransformsRef.current.clear();
      cardsRef.current = [];
      cachedRef.current = false;
    };
  }, [measure, update]);

  return (
    <div ref={containerRef}>
      {children}
      <div className="scroll-stack-end h-px w-full" />
    </div>
  );
}

/* ---------------- Tiny feature row (big title + animated icon) ---------------- */
function FeatureRow({ title, Icon }) {
  return (
    <div className="flex h-full w-full items-center justify-between gap-6">
      <h3 className="text-[clamp(28px,4vw,44px)] font-extrabold tracking-tight text-white">
        {title}
      </h3>

      {/* Icon frame */}
      <div
        className="shrink-0 w-[min(38vw,420px)] h-[min(22vw,180px)] rounded-3xl border-4 border-white/80 grid place-items-center"
        style={{
          // slight float-in as progress grows
          transform:
            "translateY(calc((1 - var(--pg, 0)) * 12px)) scale(calc(0.95 + var(--pg, 0) * 0.05)) rotate(calc((1 - var(--pg, 0)) * -2deg))",
          transition: "transform 0.1s linear",
        }}
      >
        <Icon
          className="w-[min(18vw,96px)] h-[min(18vw,96px)] text-white"
          strokeWidth={2.5}
          // line-draw effect + subtle settle
          style={{
            // lucide paths obey these on the <svg> level
            strokeDasharray: 1,
            strokeDashoffset: "calc(1 - var(--pg, 0))",
            // fade/scale in as it finishes drawing
            transform:
              "scale(calc(0.9 + var(--pg, 0) * 0.1)) rotate(calc((1 - var(--pg, 0)) * -6deg))",
            opacity: "calc(0.5 + var(--pg, 0) * 0.5)",
            transition: "transform 0.1s linear, opacity 0.1s linear",
          }}
        />
      </div>
    </div>
  );
}

/* --------------------------- Features content --------------------------- */
export default function Features() {
  return (
    <ScrollStackWindow>
      <ScrollStackItem>
        <FeatureRow title="Realtime Collaboration" Icon={Users} />
      </ScrollStackItem>

      <ScrollStackItem>
        <FeatureRow title="No Auth — Instant Guests" Icon={KeyRound} />
      </ScrollStackItem>

      <ScrollStackItem>
        <FeatureRow title="Easy Draw Tools" Icon={PencilRuler} />
      </ScrollStackItem>

      <ScrollStackItem>
        <FeatureRow title="Undo / Redo History" Icon={History} />
      </ScrollStackItem>

      <ScrollStackItem>
        <FeatureRow title="Share & Export" Icon={Share2} />
      </ScrollStackItem>
    </ScrollStackWindow>
  );
}
