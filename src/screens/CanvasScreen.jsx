import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { fabric } from "fabric";
import { db } from "../config/firestore.js";
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp,
  increment,
} from "firebase/firestore";
import Toolbar from "../components/Toolbar.jsx";

/**
 * CanvasScreen renders the collaborative drawing surface for a given scene ID.
 * Fabric.js for objects; Firestore for realtime sync; local undo/redo.
 * Fixes:
 *  - Monotonic rev-based syncing (no stale overwrites)
 *  - Ignore our own writes (optimistic rev bump)
 *  - Debounced saves; guarded during remote apply
 */
export default function CanvasScreen() {
  const { id } = useParams();
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const containerRef = useRef(null);

  const [fillColor, setFillColor] = useState("#bfdfff");
  const [strokeColor, setStrokeColor] = useState("#222222");
  const [penMode, setPenMode] = useState(false);

  // Realtime + history refs
  const saveTimerRef = useRef(null);
  const lastRevRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  useEffect(() => {
    if (!id) return;
    const c = new fabric.Canvas(canvasRef.current, {
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
    });
    fabricCanvasRef.current = c;

    // --- Full-viewport sizing from container ---
    const resizeToContainer = () => {
      const width = containerRef.current?.clientWidth ?? window.innerWidth;
      const height = containerRef.current?.clientHeight ?? window.innerHeight;
      c.setDimensions({ width, height });
      c.requestRenderAll();
    };
    resizeToContainer();
    const resizeObs = new ResizeObserver(resizeToContainer);
    if (containerRef.current) resizeObs.observe(containerRef.current);
    window.addEventListener("resize", resizeToContainer);

    // --- Debounced save helper ---
    const scheduleSave = (fn) => {
      if (isApplyingRemoteRef.current) return; // never save while applying remote
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      // 300ms feels snappy for pen strokes; you can raise to ~500ms if you want fewer writes
      saveTimerRef.current = setTimeout(() => fn(), 300);
    };

    // --- History (skip during remote apply) ---
    const recordHistory = () => {
      if (isApplyingRemoteRef.current) return;
      undoStackRef.current.push(c.toJSON());
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      redoStackRef.current = [];
    };

    // Reflect selection colors into the pickers
    const updateSelection = (e) => {
      const obj = e.selected ? e.selected[0] : null;
      if (obj) {
        if (obj.fill) setFillColor(obj.fill);
        if (obj.stroke) setStrokeColor(obj.stroke);
      }
    };

    c.on("selection:created", updateSelection);
    c.on("selection:updated", updateSelection);
    c.on("object:added", recordHistory);
    c.on("object:modified", recordHistory);
    c.on("object:removed", recordHistory);

    const docRef = doc(db, "scenes", id);

    // --- Save (optimistic rev bump so our own snapshot won’t reload) ---
    const saveCanvas = () => {
      if (isApplyingRemoteRef.current) return;
      const json = c.toJSON();

      // Bump local rev optimistically; snapshot with same rev won't be "newer"
      lastRevRef.current = (lastRevRef.current || 0) + 1;

      setDoc(
        docRef,
        {
          canvas: json,
          width: c.getWidth(),
          height: c.getHeight(),
          updatedAt: serverTimestamp(),
          rev: increment(1),
        },
        { merge: true }
      ).catch((err) => console.error("Error saving canvas:", err));
    };

    // Persist (debounced) on local edits
    const persistIfLocal = () => scheduleSave(saveCanvas);

    c.on("object:added", persistIfLocal);
    c.on("object:modified", persistIfLocal);
    c.on("object:removed", persistIfLocal);

    // IMPORTANT: pen strokes come via 'path:created' once per stroke
    c.on("path:created", () => scheduleSave(saveCanvas));

    // --- Initial load (also sets rev) ---
    getDoc(docRef).then((snap) => {
      // Compute baseline size
      let width = containerRef.current?.clientWidth ?? window.innerWidth;
      let height = containerRef.current?.clientHeight ?? window.innerHeight;

      if (snap.exists()) {
        const data = snap.data();
        if (data?.width) width = data.width;
        if (data?.height) height = data.height;

        c.setDimensions({ width, height });
        c.setBackgroundColor("#ffffff", c.renderAll.bind(c));

        if (data?.canvas) {
          isApplyingRemoteRef.current = true;
          c.loadFromJSON(data.canvas, () => {
            c.requestRenderAll();
            lastRevRef.current = Number(data.rev || 0);
            setTimeout(() => (isApplyingRemoteRef.current = false), 0);
          });
        } else {
          // create first state
          setDoc(docRef, {
            canvas: c.toJSON(),
            width,
            height,
            updatedAt: serverTimestamp(),
            rev: 1,
          }).catch((err) => console.error("Error creating canvas:", err));
          lastRevRef.current = 1;
        }
      } else {
        // no doc yet
        c.setDimensions({ width, height });
        setDoc(docRef, {
          canvas: c.toJSON(),
          width,
          height,
          updatedAt: serverTimestamp(),
          rev: 1,
        }).catch((err) => console.error("Error creating canvas:", err));
        lastRevRef.current = 1;
      }
    });

    // --- Realtime sync: apply only strictly newer revisions ---
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      const rev = Number(data.rev || 0);

      if (rev > lastRevRef.current) {
        lastRevRef.current = rev;
        isApplyingRemoteRef.current = true;
        c.loadFromJSON(data.canvas, () => {
          // also apply remote width/height if present
          if (data.width && data.height) {
            c.setDimensions({ width: data.width, height: data.height });
          }
          c.requestRenderAll();
          setTimeout(() => (isApplyingRemoteRef.current = false), 0);
        });
      }
    });

    // Cleanup
    return () => {
      unsub();
      window.removeEventListener("resize", resizeToContainer);
      if (containerRef.current) resizeObs.disconnect();
      c.dispose();
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [id]);

  // ---------- Tooling ----------
  const addRect = () => {
    const c = fabricCanvasRef.current;
    const rect = new fabric.Rect({
      left: 50,
      top: 50,
      width: 120,
      height: 80,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: 1,
    });
    c.add(rect);
    c.setActiveObject(rect);
    c.requestRenderAll();
  };

  const addCircle = () => {
    const c = fabricCanvasRef.current;
    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: 1,
    });
    c.add(circle);
    c.setActiveObject(circle);
    c.requestRenderAll();
  };

  const addText = () => {
    const c = fabricCanvasRef.current;
    const textbox = new fabric.Textbox("Double-click to edit", {
      left: 150,
      top: 150,
      fontSize: 24,
      fill: strokeColor,
    });
    c.add(textbox);
    c.setActiveObject(textbox);
    c.requestRenderAll();
  };

  const togglePen = () => {
    const c = fabricCanvasRef.current;
    const newMode = !c.isDrawingMode;
    c.isDrawingMode = newMode;
    setPenMode(newMode);
    if (newMode) {
      c.freeDrawingBrush.color = strokeColor;
      c.freeDrawingBrush.width = 2;
    }
  };

  const deleteSelected = () => {
    const c = fabricCanvasRef.current;
    const obj = c.getActiveObject();
    if (obj) {
      c.remove(obj);
      c.discardActiveObject();
      c.requestRenderAll();
    }
  };

  const handleFillChange = (e) => {
    const color = e.target.value;
    setFillColor(color);
    const c = fabricCanvasRef.current;
    const obj = c.getActiveObject();
    if (obj && obj.fill !== undefined) {
      obj.set("fill", color);
      c.requestRenderAll();
    }
    if (c.isDrawingMode) c.freeDrawingBrush.color = color;
  };

  const handleStrokeChange = (e) => {
    const color = e.target.value;
    setStrokeColor(color);
    const c = fabricCanvasRef.current;
    const obj = c.getActiveObject();
    if (obj && obj.stroke !== undefined) {
      obj.set("stroke", color);
      c.requestRenderAll();
    }
    if (c.isDrawingMode) c.freeDrawingBrush.color = color;
  };

  const shareCanvas = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard
        .writeText(url)
        .then(() => alert("Shareable link copied to your clipboard."))
        .catch(() => prompt("Copy this link to share your canvas:", url));
    } else {
      prompt("Copy this link to share your canvas:", url);
    }
  };

  const exportPNG = () => {
    const c = fabricCanvasRef.current;
    const dataURL = c.toDataURL({ format: "png" });
    const link = document.createElement("a");
    link.href = dataURL;
    link.download = `canvas-${id}.png`;
    link.click();
  };

  const exportSVG = () => {
    const c = fabricCanvasRef.current;
    const svgData = c.toSVG();
    const blob = new Blob([svgData], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `canvas-${id}.svg`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const undo = () => {
    const c = fabricCanvasRef.current;
    if (undoStackRef.current.length > 0) {
      const prev = undoStackRef.current.pop();
      redoStackRef.current.push(c.toJSON());
      c.loadFromJSON(prev, c.renderAll.bind(c));
    }
  };

  const redo = () => {
    const c = fabricCanvasRef.current;
    if (redoStackRef.current.length > 0) {
      const next = redoStackRef.current.pop();
      undoStackRef.current.push(c.toJSON());
      c.loadFromJSON(next, c.renderAll.bind(c));
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen">
      <Toolbar
        addRect={addRect}
        addCircle={addCircle}
        addText={addText}
        togglePen={togglePen}
        deleteSelected={deleteSelected}
        undo={undo}
        redo={redo}
        exportPNG={exportPNG}
        exportSVG={exportSVG}
        shareCanvas={shareCanvas}
        fillColor={fillColor}
        strokeColor={strokeColor}
        onFillChange={handleFillChange}
        onStrokeChange={handleStrokeChange}
        penMode={penMode}
      />
      <div
        ref={containerRef}
        className="flex-1 overflow-hidden"
        // If your Dock overlaps, optionally add padding-bottom here to keep a safe area:
        // style={{ paddingBottom: 112 }}
      >
        <canvas ref={canvasRef} className="block" />
      </div>
    </div>
  );
}
