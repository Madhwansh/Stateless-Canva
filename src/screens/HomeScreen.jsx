import React from "react";
import { useNavigate } from "react-router-dom";
import Hero from "../components/home/Hero";
import Features from "../components/home/Features";
import Bento from "../components/home/Bento";

function generateSceneId() {
  return Math.random().toString(36).substring(2, 12);
}

export default function HomeScreen() {
  const navigate = useNavigate();
  const handleStartDrawing = () => {
    navigate(`/canvas/${generateSceneId()}`);
  };

  return (
    <div className="bg-black text-white">
      <Hero onStartDrawing={handleStartDrawing} />

      {/* Heading + subheading live in the main flow (window scroll) */}
      <section className="relative mb-10 pb-20">
        <div className="mx-auto max-w-6xl px-6 md:px-5">
          <h2 className="text-5xl md:text-7xl font-semibold tracking-tight">
            Features
          </h2>
          <p className="mt-3 text-white/80 max-w-2xl">
            Everything you need to sketch ideas together—fast, smooth, and
            multiplayer by default.
          </p>

          {/* Directly render the stacked items; they animate via window scroll */}
          <div className="">
            <Features />
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-6xl px-6 md:px-5 mt-20 pt-20">
        <h2 className="text-5xl md:text-7xl font-semibold tracking-tight">
          About Me
        </h2>
        <p className="mt-3 text-white/80 max-w-2xl">
          A small introduction about myself and my work.
        </p>
      </div>
      <Bento />

      {/* Add more sections as needed */}
    </div>
  );
}
