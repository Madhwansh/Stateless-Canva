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

export default function CanvasScreen() {
  const { id } = useParams();

  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);

  const [fillColor, setFillColor] = useState("#bfdfff");
  const [strokeColor, setStrokeColor] = useState("#222222");
  const [penMode, setPenMode] = useState(false);

  // sync/debounce guards
  const saveTimerRef = useRef(null);
  const lastRevRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);

  // history
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  // expose save functions to undo/redo
  const doSaveRef = useRef(() => {});
  const scheduleSaveRef = useRef((_) => {});

  // mark this browser tab
  const clientIdRef = useRef(
    (crypto?.randomUUID && crypto.randomUUID()) ||
      Math.random().toString(36).slice(2)
  );

  // include "path" so Pencil/free-draw strokes persist
  const extraProps = [
    "type",
    "left",
    "top",
    "width",
    "height",
    "radius",
    "angle",
    "scaleX",
    "scaleY",
    "originX",
    "originY",
    "fill",
    "stroke",
    "strokeWidth",
    "path",
    "text",
    "fontSize",
    "fontFamily",
    "fontWeight",
    "fontStyle",
    "underline",
    "linethrough",
    "charSpacing",
  ];

  const serializeObject = (c) => c.toDatalessJSON(extraProps);
  const serializeString = (c) => JSON.stringify(serializeObject(c));

  useEffect(() => {
    if (!id) return;

    const c = new fabric.Canvas(canvasElRef.current, {
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
    });
    fabricRef.current = c;

    // full-viewport sizing
    const resizeToContainer = () => {
      const w = containerRef.current?.clientWidth ?? window.innerWidth;
      const h = containerRef.current?.clientHeight ?? window.innerHeight;
      c.setDimensions({ width: w, height: h });
      c.requestRenderAll();
    };
    resizeToContainer();
    const ro = new ResizeObserver(resizeToContainer);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener("resize", resizeToContainer);

    const docRef = doc(db, "scenes", id);

    // ---------- SAVE (debounced, ignore while remote is applying) ----------
    const clearScheduledSave = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };

    const doSave = () => {
      if (isApplyingRemoteRef.current) {
        // ignore saves while applying remote state
        return;
      }
      try {
        const canvasStr = serializeString(c);
        const width = c.getWidth();
        const height = c.getHeight();
        // optimistic local rev tick — only for local comparison
        lastRevRef.current = (lastRevRef.current || 0) + 1;

        setDoc(
          docRef,
          {
            canvasStr, // store as string to avoid Firestore nested-array limits
            width,
            height,
            updatedAt: serverTimestamp(),
            lastEditor: clientIdRef.current,
            rev: increment(1),
          },
          { merge: true }
        ).catch((e) => {
          console.error("[save] Firestore error:", e);
        });
      } catch (e) {
        console.error("[save] serialize error:", e);
      }
    };

    const scheduleSave = (delay = 600) => {
      if (isApplyingRemoteRef.current) return; // never schedule from remote apply
      clearScheduledSave();
      saveTimerRef.current = setTimeout(doSave, delay);
    };

    // expose to undo/redo
    doSaveRef.current = doSave;
    scheduleSaveRef.current = scheduleSave;

    const flushPending = () => {
      clearScheduledSave();
      doSave();
    };

    window.addEventListener("beforeunload", flushPending);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushPending();
    });

    // ---------- selection + history ----------
    const onSelection = (e) => {
      const obj = e.selected?.[0] ?? null;
      if (obj) {
        if (obj.fill) setFillColor(obj.fill);
        if (obj.stroke) setStrokeColor(obj.stroke);
      }
    };
    c.on("selection:created", onSelection);
    c.on("selection:updated", onSelection);

    const pushSnapshot = () => {
      if (isApplyingRemoteRef.current) return;
      const snap = serializeObject(c);
      const last = undoStackRef.current[undoStackRef.current.length - 1];
      if (JSON.stringify(last) !== JSON.stringify(snap)) {
        undoStackRef.current.push(snap);
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        redoStackRef.current = [];
      }
    };

    c.on("object:added", pushSnapshot);
    c.on("object:modified", pushSnapshot);
    c.on("object:removed", pushSnapshot);

    // local change → debounced save (but NOT during remote apply)
    const onLocalChange = () => {
      if (isApplyingRemoteRef.current) return;
      scheduleSave(600);
    };
    c.on("object:added", onLocalChange);
    c.on("object:modified", onLocalChange);
    c.on("object:removed", onLocalChange);

    // pen: save once at stroke end (nice trailing debounce)
    c.on("mouse:up", () => {
      if (c.isDrawingMode) scheduleSave(400);
    });

    // ---------- initial load ----------
    getDoc(docRef).then((snap) => {
      let w = containerRef.current?.clientWidth ?? window.innerWidth;
      let h = containerRef.current?.clientHeight ?? window.innerHeight;

      if (snap.exists()) {
        const data = snap.data();
        if (data?.width) w = data.width;
        if (data?.height) h = data.height;

        c.setDimensions({ width: w, height: h });
        c.setBackgroundColor("#ffffff", c.renderAll.bind(c));

        const canvasStr = data?.canvasStr;
        const canvasObj = data?.canvas; // legacy

        if (canvasStr) {
          isApplyingRemoteRef.current = true;
          clearScheduledSave();
          c.loadFromJSON(JSON.parse(canvasStr), () => {
            c.requestRenderAll();
            lastRevRef.current = Number(data.rev || 0);
            // seed baseline history
            undoStackRef.current = [serializeObject(c)];
            redoStackRef.current = [];
            isApplyingRemoteRef.current = false;
          });
        } else if (canvasObj) {
          isApplyingRemoteRef.current = true;
          clearScheduledSave();
          c.loadFromJSON(canvasObj, () => {
            c.requestRenderAll();
            lastRevRef.current = Number(data.rev || 0);
            // seed baseline history
            undoStackRef.current = [serializeObject(c)];
            redoStackRef.current = [];
            isApplyingRemoteRef.current = false;
          });
        } else {
          // create empty doc and baseline
          const baseStr = serializeString(c);
          setDoc(docRef, {
            canvasStr: baseStr,
            width: w,
            height: h,
            updatedAt: serverTimestamp(),
            lastEditor: clientIdRef.current,
            rev: 1,
          });
          lastRevRef.current = 1;
          undoStackRef.current = [JSON.parse(baseStr)];
          redoStackRef.current = [];
        }
      } else {
        c.setDimensions({ width: w, height: h });
        const baseStr = serializeString(c);
        setDoc(docRef, {
          canvasStr: baseStr,
          width: w,
          height: h,
          updatedAt: serverTimestamp(),
          lastEditor: clientIdRef.current,
          rev: 1,
        });
        lastRevRef.current = 1;
        undoStackRef.current = [JSON.parse(baseStr)];
        redoStackRef.current = [];
      }
    });

    // ---------- realtime ----------
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      // ignore our own commits — prevents replay→save loops
      if (data.lastEditor === clientIdRef.current) return;

      const rev = Number(data.rev || 0);
      if (rev > lastRevRef.current) {
        lastRevRef.current = rev;
        isApplyingRemoteRef.current = true;
        clearScheduledSave();

        const payload = data.canvasStr
          ? JSON.parse(data.canvasStr)
          : data.canvas;

        c.loadFromJSON(payload, () => {
          if (data.width && data.height) {
            c.setDimensions({ width: data.width, height: data.height });
          }
          c.requestRenderAll();
          // update baseline so the next undo is from this state
          undoStackRef.current = [serializeObject(c)];
          redoStackRef.current = [];
          isApplyingRemoteRef.current = false;
        });
      }
    });

    // cleanup
    return () => {
      unsub();
      window.removeEventListener("resize", resizeToContainer);
      window.removeEventListener("beforeunload", flushPending);
      document.removeEventListener("visibilitychange", flushPending);
      if (containerRef.current) ro.disconnect();
      c.dispose();
      clearScheduledSave();
    };
  }, [id]);

  // ---------- Tools ----------
  const exitPenIfOn = () => {
    const c = fabricRef.current;
    if (c.isDrawingMode) {
      c.isDrawingMode = false;
      setPenMode(false);
    }
  };

  const addRect = () => {
    const c = fabricRef.current;
    exitPenIfOn();
    c.add(
      new fabric.Rect({
        left: 50,
        top: 50,
        width: 120,
        height: 80,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: 1,
      })
    );
    c.requestRenderAll();
  };

  const addCircle = () => {
    const c = fabricRef.current;
    exitPenIfOn();
    c.add(
      new fabric.Circle({
        left: 100,
        top: 100,
        radius: 50,
        fill: fillColor,
        stroke: strokeColor,
        strokeWidth: 1,
      })
    );
    c.requestRenderAll();
  };

  const addText = () => {
    const c = fabricRef.current;
    exitPenIfOn();
    c.add(
      new fabric.Textbox("Double-click to edit", {
        left: 150,
        top: 150,
        fontSize: 24,
        fill: strokeColor,
      })
    );
    c.requestRenderAll();
  };

  const togglePen = () => {
    const c = fabricRef.current;
    const on = !c.isDrawingMode;
    c.isDrawingMode = on;
    setPenMode(on);
    if (on) {
      if (!c.freeDrawingBrush) c.freeDrawingBrush = new fabric.PencilBrush(c);
      c.freeDrawingBrush.color = strokeColor;
      c.freeDrawingBrush.width = 2;
    }
  };

  const deleteSelected = () => {
    const c = fabricRef.current;
    const obj = c.getActiveObject();
    if (obj) {
      c.remove(obj);
      c.discardActiveObject();
      c.requestRenderAll();
    }
  };

  const onFillChange = (e) => {
    const color = e.target.value;
    setFillColor(color);
    const c = fabricRef.current;
    const obj = c.getActiveObject();
    if (obj && obj.fill !== undefined) {
      obj.set("fill", color);
      c.requestRenderAll();
    }
  };

  const onStrokeChange = (e) => {
    const color = e.target.value;
    setStrokeColor(color);
    const c = fabricRef.current;
    const obj = c.getActiveObject();
    if (obj && obj.stroke !== undefined) {
      obj.set("stroke", color);
      c.requestRenderAll();
    }
    if (c.isDrawingMode && c.freeDrawingBrush) {
      c.freeDrawingBrush.color = color;
    }
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
    const c = fabricRef.current;
    const dataURL = c.toDataURL({ format: "png" });
    const a = document.createElement("a");
    a.href = dataURL;
    a.download = `canvas-${id}.png`;
    a.click();
  };

  const exportSVG = () => {
    const c = fabricRef.current;
    const svg = c.toSVG();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `canvas-${id}.svg`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ---------- Undo / Redo (guarded, no re-entrant history) ----------
  const undo = () => {
    const c = fabricRef.current;
    if (!c) return;
    // Need at least baseline + current
    if (undoStackRef.current.length <= 1) return;

    const current = undoStackRef.current.pop();
    const prev = undoStackRef.current[undoStackRef.current.length - 1];
    redoStackRef.current.push(current);

    isApplyingRemoteRef.current = true;
    c.loadFromJSON(prev, () => {
      c.requestRenderAll();
      isApplyingRemoteRef.current = false;
      // normalize top-of-stack to exactly what was applied
      undoStackRef.current[undoStackRef.current.length - 1] =
        serializeObject(c);
      // optionally persist the undone state (debounced but safe)
      scheduleSaveRef.current(500);
    });
  };

  const redo = () => {
    const c = fabricRef.current;
    if (!c) return;
    if (redoStackRef.current.length === 0) return;

    const next = redoStackRef.current.pop();
    // push immediately to history as the new current
    undoStackRef.current.push(next);

    isApplyingRemoteRef.current = true;
    c.loadFromJSON(next, () => {
      c.requestRenderAll();
      isApplyingRemoteRef.current = false;
      // normalize top-of-stack
      undoStackRef.current[undoStackRef.current.length - 1] =
        serializeObject(c);
      // persist redone state
      scheduleSaveRef.current(500);
    });
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
        onFillChange={onFillChange}
        onStrokeChange={onStrokeChange}
        penMode={penMode}
      />
      <div ref={containerRef} className="flex-1 overflow-hidden">
        <canvas ref={canvasElRef} className="block" />
      </div>
    </div>
  );
}
