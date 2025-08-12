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

  // debounce & sync guards
  const saveTimerRef = useRef(null);
  const lastRevRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);

  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  // mark this browser tab
  const clientIdRef = useRef(
    (crypto?.randomUUID && crypto.randomUUID()) ||
      Math.random().toString(36).slice(2)
  );

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

  const serializeObject = (c) => {
    const json = c.toDatalessJSON(extraProps);
    console.log("[serialize] objects:", json.objects?.length ?? 0);
    return json;
  };

  const serializeString = (c) => JSON.stringify(serializeObject(c));

  useEffect(() => {
    if (!id) return;

    console.log("[init] scene:", id, "clientId:", clientIdRef.current);

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
    const doSave = () => {
      if (isApplyingRemoteRef.current) {
        // don't queue while applying remote; it causes tail-chasing loops
        console.log("[save] blocked (applying remote)");
        return;
      }
      try {
        const canvasStr = serializeString(c);
        const width = c.getWidth();
        const height = c.getHeight();
        // optimistic local rev tick — only for local comparison
        lastRevRef.current = (lastRevRef.current || 0) + 1;

        console.log("[save] setDoc rev+1(localGuess):", lastRevRef.current);
        setDoc(
          docRef,
          {
            canvasStr,
            width,
            height,
            updatedAt: serverTimestamp(),
            lastEditor: clientIdRef.current, // mark this write as ours
            rev: increment(1),
          },
          { merge: true }
        )
          .then(() => {
            console.log("[save] success");
          })
          .catch((e) => {
            console.error("[save] Firestore error:", e);
          });
      } catch (e) {
        console.error("[save] serialize error:", e);
      }
    };

    const scheduleSave = (delay = 500) => {
      if (isApplyingRemoteRef.current) {
        // ignore schedules triggered during remote apply
        return;
      }
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(doSave, delay);
    };

    const clearScheduledSave = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
    };

    const flushPending = () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
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

    const recordHistory = () => {
      if (isApplyingRemoteRef.current) return;
      undoStackRef.current.push(serializeObject(c));
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      redoStackRef.current = [];
    };
    c.on("object:added", recordHistory);
    c.on("object:modified", recordHistory);
    c.on("object:removed", recordHistory);

    // ---------- local change → debounced save (but NOT during remote apply) ----------
    const onLocalChange = () => {
      if (isApplyingRemoteRef.current) {
        // Ignore — these changes are coming from loadFromJSON
        // This is the big one that prevents endless save loops.
        // console.log("[localChange] ignored (remote apply)");
        return;
      }
      // console.log("[localChange] scheduled");
      scheduleSave(600);
    };
    c.on("object:added", onLocalChange);
    c.on("object:modified", onLocalChange);
    c.on("object:removed", onLocalChange);

    // ---------- pen: save once at stroke end ----------
    c.on("mouse:up", () => {
      if (c.isDrawingMode) {
        // trailing-only save; no immediate leading call
        scheduleSave(400);
      }
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
            isApplyingRemoteRef.current = false;
            console.log("[initLoad] loaded string rev:", lastRevRef.current);
          });
        } else if (canvasObj) {
          isApplyingRemoteRef.current = true;
          clearScheduledSave();
          c.loadFromJSON(canvasObj, () => {
            c.requestRenderAll();
            lastRevRef.current = Number(data.rev || 0);
            isApplyingRemoteRef.current = false;
            console.log("[initLoad] loaded object rev:", lastRevRef.current);
          });
        } else {
          setDoc(docRef, {
            canvasStr: serializeString(c),
            width: w,
            height: h,
            updatedAt: serverTimestamp(),
            lastEditor: clientIdRef.current,
            rev: 1,
          });
          lastRevRef.current = 1;
          console.log("[initLoad] created empty doc rev: 1");
        }
      } else {
        c.setDimensions({ width: w, height: h });
        setDoc(docRef, {
          canvasStr: serializeString(c),
          width: w,
          height: h,
          updatedAt: serverTimestamp(),
          lastEditor: clientIdRef.current,
          rev: 1,
        });
        lastRevRef.current = 1;
        console.log("[initLoad] created new doc rev: 1");
      }
    });

    // ---------- realtime ----------
    const unsub = onSnapshot(docRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      // Ignore our own commits completely — prevents replay → save loops
      if (data.lastEditor === clientIdRef.current) {
        // console.log("[snapshot] own write ignored");
        return;
      }

      const rev = Number(data.rev || 0);
      // console.log("[snapshot] got rev", rev, "local rev", lastRevRef.current);
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
          isApplyingRemoteRef.current = false;
          console.log("[snapshot] applied remote rev:", rev);
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

  const undo = () => {
    const c = fabricRef.current;
    if (undoStackRef.current.length > 0) {
      const prev = undoStackRef.current.pop();
      redoStackRef.current.push(serializeObject(c));
      c.loadFromJSON(prev, c.renderAll.bind(c));
    }
  };

  const redo = () => {
    const c = fabricRef.current;
    if (redoStackRef.current.length > 0) {
      const next = redoStackRef.current.pop();
      undoStackRef.current.push(serializeObject(c));
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
