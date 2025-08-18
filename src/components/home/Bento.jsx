// src/components/home/Bento.jsx
import React from "react";
import { motion } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { ArrowRight, Mail, MapPin, Github } from "lucide-react";

/* ------------------------------- Theming ------------------------------- */
const PURPLE = "#601ef9";

/* LeetCode brand-like icon (inline SVG), sized like lucide icons */
function LeetCodeIcon({ className = "", strokeWidth = 2 }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      x="0px"
      y="0px"
      width="50"
      height="40"
      viewBox="0 0 16 16"
      style={{ fill: PURPLE }}
    >
      <path d="M 10.447266 0.265625 A 0.50005 0.50005 0 0 0 10.103516 0.41796875 L 5.65625 4.8671875 L 3.0957031 7.4257812 A 0.50005 0.50005 0 0 0 2.9785156 7.6035156 C 1.769869 8.9739016 1.7865696 11.063913 3.0957031 12.373047 L 5.65625 14.933594 C 7.0176322 16.294976 9.242133 16.294976 10.603516 14.933594 L 12.853516 12.683594 A 0.50063809 0.50063809 0 1 0 12.144531 11.976562 L 9.8945312 14.226562 C 8.9159134 15.20518 7.3418991 15.20518 6.3632812 14.226562 L 3.8027344 11.666016 C 2.8241166 10.687398 2.8241166 9.1114303 3.8027344 8.1328125 L 6.3632812 5.5742188 C 7.3418991 4.5956009 8.9159135 4.5956009 9.8945312 5.5742188 L 12.144531 7.8242188 A 0.50063784 0.50063784 0 1 0 12.853516 7.1171875 L 10.603516 4.8671875 C 9.9106907 4.174363 8.9943718 3.8431189 8.0820312 3.8554688 L 10.8125 1.125 A 0.50005 0.50005 0 0 0 10.447266 0.265625 z M 7.328125 9.4003906 A 0.50005 0.50005 0 1 0 7.328125 10.400391 L 14.228516 10.400391 A 0.50005 0.50005 0 1 0 14.228516 9.4003906 L 7.328125 9.4003906 z"></path>
    </svg>
  );
}

/* --------------------------- Generic glass Block --------------------------- */
const Block = ({ className, ...rest }) => {
  return (
    <motion.div
      variants={{
        initial: { scale: 0.6, y: 50, opacity: 0 },
        animate: { scale: 1, y: 0, opacity: 1 },
      }}
      transition={{ type: "spring", mass: 3, stiffness: 400, damping: 50 }}
      className={twMerge(
        "col-span-4 rounded-2xl border border-white/15",
        "bg-white/[0.06] backdrop-blur-md p-6",
        "shadow-[0_10px_40px_rgba(0,0,0,0.35)]",
        className
      )}
      {...rest}
    />
  );
};

/* ------------------------------ Root Bento ------------------------------ */
export default function Bento() {
  return (
    <div className="min-h-screen bg-[radial-gradient(80%_60%_at_50%_-10%,rgba(96,30,249,0.25),transparent_60%),#0b0b14] px-4 py-12 text-white">
      <motion.div
        initial="initial"
        animate="animate"
        transition={{ staggerChildren: 0.05 }}
        className="mx-auto grid max-w-5xl grid-flow-dense grid-cols-12 gap-4"
      >
        <HeaderBlock />
        <SocialsBlock />
        <AboutBlock />
        <LocationBlock />
        <EmailListBlock />
      </motion.div>
    </div>
  );
}

/* ------------------------------ Content blocks ------------------------------ */

const HeaderBlock = () => (
  <Block className="col-span-12 row-span-2 md:col-span-6">
    <img
      src="https://api.dicebear.com/8.x/lorelei-neutral/svg?seed=John"
      alt="avatar"
      className="mb-4 size-14 rounded-full ring-2 ring-[#610ef9]/20"
    />
    <h1 className="mb-10 text-4xl font-semibold text-[#610ef9] leading-tight">
      Hi, I’m Madhwansh.{" "}
      <span className="text-white/70">
        I build fullstack web apps with delightful ui and robust backend.
      </span>
    </h1>
    <a
      href="#"
      className="flex items-center gap-1 text-[#610ef9]/90 font-bold hover:underline"
    >
      Contact me <ArrowRight />
    </a>
  </Block>
);

/* Replaced social tiles: GitHub + LeetCode (lucide for GH, custom SVG for LC) */
const SocialsBlock = () => (
  <>
    <Block
      whileHover={{ rotate: "2deg", scale: 1.06 }}
      className="col-span-6 md:col-span-3 border-white/20 bg-white/[0.08]"
    >
      <a
        href="https://github.com/"
        target="_blank"
        rel="noreferrer"
        className="grid h-full place-content-center text-3xl"
        aria-label="GitHub"
      >
        <Github className="text-[#610ef9]" size={40} />
        <p className="mt-2 text-sm text-white/80">GitHub</p>
      </a>
    </Block>

    <Block
      whileHover={{ rotate: "-2deg", scale: 1.06 }}
      className="col-span-6 md:col-span-3 border-white/20 bg-white/[0.08]"
    >
      <a
        href="https://leetcode.com/"
        target="_blank"
        rel="noreferrer"
        className="grid h-full place-content-center text-3xl"
        aria-label="LeetCode"
      >
        <LeetCodeIcon className="text-[#610ef9]" />
        <p className="mt-2 text-sm text-white/80">LeetCode</p>
      </a>
    </Block>

    {/* Two aesthetic accent tiles to keep the 2x2 grid feel */}
    <Block
      whileHover={{ rotate: "-2deg", scale: 1.06 }}
      className="col-span-6 md:col-span-3 border-white/10 bg-[linear-gradient(180deg,rgba(96,30,249,0.25),rgba(96,30,249,0.05))]"
    >
      <div className="grid h-full place-content-center text-center">
        <p className="text-base font-medium text-white/90">Open Source</p>
        <p className="text-sm text-white/60">PRs welcome</p>
      </div>
    </Block>

    <Block
      whileHover={{ rotate: "2deg", scale: 1.06 }}
      className="col-span-6 md:col-span-3 border-white/10 bg-[linear-gradient(180deg,rgba(96,30,249,0.25),rgba(96,30,249,0.05))]"
    >
      <div className="grid h-full place-content-center text-center">
        <p className="text-base font-medium text-white/90">Motion-First</p>
        <p className="text-sm text-white/60">Framer Motion + WebGL</p>
      </div>
    </Block>
  </>
);

const AboutBlock = () => (
  <Block className="col-span-12 text-2xl leading-snug">
    <p>
      I enjoy designing and developing end-to-end applications — from crafting
      intuitive UIs to building robust, scalable backends.{" "}
      <span className="text-white/70">
        Current stack: React, Tailwind CSS, Node.js, Express, MongoDB,
        REST/GraphQL APIs, and a sprinkle of cloud magic with AWS.
      </span>
    </p>
  </Block>
);

const LocationBlock = () => (
  <Block className="col-span-12 flex flex-col items-center gap-4 md:col-span-3">
    <MapPin className="text-white" size={28} />
    <p className="text-center text-lg text-white/70">India</p>
  </Block>
);

const EmailListBlock = () => (
  <Block id="contact" className="col-span-12 md:col-span-9">
    <p className="mb-3 text-lg">Let’s build something together</p>
    <form
      onSubmit={(e) => e.preventDefault()}
      className="flex items-center gap-2"
    >
      <input
        type="email"
        placeholder="your@email.com"
        className="w-full rounded border border-white/15 bg-zinc-950/50 px-3 py-2 text-white placeholder-white/40 outline-none ring-0 focus:border-[--focus] focus:ring-0"
        style={{ ["--focus"]: PURPLE }}
      />
      <button
        type="submit"
        className="inline-flex items-center gap-2 whitespace-nowrap rounded bg-white px-3 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-200"
      >
        <Mail size={16} /> Send
      </button>
    </form>
  </Block>
);

/* ----------------------------- Logo & Footer ----------------------------- */

const Logo = () => {
  return (
    <svg
      width="40"
      height="auto"
      viewBox="0 0 50 39"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto mb-12"
      style={{ filter: "drop-shadow(0 4px 16px rgba(96,30,249,0.45))" }}
    >
      <path d="M16.4992 2H37.5808L22.0816 24.9729H1L16.4992 2Z" fill={PURPLE} />
      <path
        d="M17.4224 27.102L11.4192 36H33.5008L49 13.0271H32.7024L23.2064 27.102H17.4224Z"
        fill="white"
        opacity="0.9"
      />
    </svg>
  );
};
