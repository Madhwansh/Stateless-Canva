import React, { useState, useEffect, useRef, useMemo } from "react";
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
  collection,
  runTransaction,
  deleteDoc,
} from "firebase/firestore";
import Toolbar from "../components/Toolbar.jsx";
import PresenceLayer from "../components/PresenceLayer.jsx";

/* ------------------------------ Custom Toasts ------------------------------ */
function Toasts({ items }) {
  return (
    <div className="pointer-events-none fixed top-3 left-1/2 -translate-x-1/2 z-[60] flex flex-col gap-2">
      {items.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto rounded-md bg-black/80 text-white px-3 py-2 text-sm shadow-lg"
        >
          {t.text}
        </div>
      ))}
    </div>
  );
}

export default function CanvasScreen() {
  const { id } = useParams();

  // ----- canvas refs -----
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const containerRef = useRef(null);

  // ----- drawing states -----
  const [fillColor, setFillColor] = useState("#bfdfff");
  const [strokeColor, setStrokeColor] = useState("#222222");
  const [penMode, setPenMode] = useState(false);

  // ----- debouncing & sync -----
  const saveTimerRef = useRef(null);
  const lastRevRef = useRef(0);
  const isApplyingRemoteRef = useRef(false);
  const isApplyingHistoryRef = useRef(false);

  // history
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const pushedOnThisGestureRef = useRef(false); // avoid double push on same drag

  // -----user presence -----
  const clientIdRef = useRef(
    (crypto?.randomUUID && crypto.randomUUID()) ||
      Math.random().toString(36).slice(2)
  );
  const [presenceUsers, setPresenceUsers] = useState([]);
  const prevActiveUsersRef = useRef(new Set()); // for join/leave diffs

  // toasts
  const [toasts, setToasts] = useState([]);
  const toastIdRef = useRef(0);
  const pushToast = (text) => {
    const id = ++toastIdRef.current;
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
    }, 2400);
  };

  const MY_COLOR = useMemo(() => {
    const colors = [
      "#F97316",
      "#22C55E",
      "#3B82F6",
      "#A855F7",
      "#EF4444",
      "#EAB308",
      "#06B6D4",
      "#10B981",
      "#F59E0B",
    ];
    const s = clientIdRef.current
      .split("")
      .reduce((a, c) => a + c.charCodeAt(0), 0);
    return colors[s % colors.length];
  }, []);
  const myPresenceDocRef = useMemo(
    () =>
      doc(collection(doc(db, "scenes", id), "presence"), clientIdRef.current),
    [id]
  );
  const PRESENCE_STALE_MS = 12000; // 12s

  // simple throttle for cursor writes
  const throttleRef = useRef({ timer: null, lastRun: 0 });
  const throttle = (fn, wait = 100) => {
    const now = Date.now();
    if (now - throttleRef.current.lastRun >= wait) {
      throttleRef.current.lastRun = now;
      fn();
    } else {
      clearTimeout(throttleRef.current.timer);
      throttleRef.current.timer = setTimeout(() => {
        throttleRef.current.lastRun = Date.now();
        fn();
      }, wait - (now - throttleRef.current.lastRun));
    }
  };

  // ---------- serialization ----------
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

    // ----------------- INIT CANVAS -----------------
    const c = new fabric.Canvas(canvasElRef.current, {
      backgroundColor: "#ffffff",
      selection: true,
      preserveObjectStacking: true,
    });
    fabricRef.current = c;

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

    const sceneDocRef = doc(db, "scenes", id);

    // ----------------- SAVE (debounced) -----------------
    const doSave = () => {
      if (isApplyingRemoteRef.current || isApplyingHistoryRef.current) return;
      const canvasStr = serializeString(c);
      const width = c.getWidth();
      const height = c.getHeight();
      lastRevRef.current = (lastRevRef.current || 0) + 1;

      setDoc(
        sceneDocRef,
        {
          canvasStr,
          width,
          height,
          updatedAt: serverTimestamp(),
          lastEditor: clientIdRef.current,
          rev: increment(1),
        },
        { merge: true }
      ).catch((e) => console.error("[save] Firestore error:", e));
    };

    const scheduleSave = (delay = 600) => {
      if (isApplyingRemoteRef.current || isApplyingHistoryRef.current) return;
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

    // ----------------- HISTORY (robust) -----------------
    // push a baseline at first interaction of a gesture, so undo returns to BEFORE state
    const onMouseDownForHistory = (opt) => {
      if (isApplyingRemoteRef.current || isApplyingHistoryRef.current) return;
      // Starting a transform (move/scale/rotate) on an object?
      if (opt?.target && !pushedOnThisGestureRef.current) {
        undoStackRef.current.push(serializeObject(c));
        // cap size
        if (undoStackRef.current.length > 50) undoStackRef.current.shift();
        pushedOnThisGestureRef.current = true;
      }
    };
    // when gesture ends, allow next push
    const onMouseUpForHistory = () => {
      pushedOnThisGestureRef.current = false;
    };

    c.on("mouse:down", onMouseDownForHistory);
    c.on("mouse:up", onMouseUpForHistory);

    // programmatic changes (added/removed/modified) → schedule save
    const onLocalChange = () => {
      if (isApplyingRemoteRef.current || isApplyingHistoryRef.current) return;
      scheduleSave(700);
    };
    c.on("object:added", onLocalChange);
    c.on("object:modified", onLocalChange);
    c.on("object:removed", onLocalChange);

    // Free-draw: just save once at stroke end
    c.on("mouse:up", () => {
      if (c.isDrawingMode) scheduleSave(300);
    });

    // ----------------- INITIAL LOAD -----------------
    getDoc(sceneDocRef).then(async (snap) => {
      let w = containerRef.current?.clientWidth ?? window.innerWidth;
      let h = containerRef.current?.clientHeight ?? window.innerHeight;

      if (snap.exists()) {
        const data = snap.data();
        if (data?.width) w = data.width;
        if (data?.height) h = data.height;

        c.setDimensions({ width: w, height: h });
        c.setBackgroundColor("#ffffff", c.renderAll.bind(c));

        const payload = data.canvasStr
          ? JSON.parse(data.canvasStr)
          : data.canvas;
        if (payload) {
          isApplyingRemoteRef.current = true;
          clearScheduledSave();
          c.loadFromJSON(payload, () => {
            c.requestRenderAll();
            lastRevRef.current = Number(data.rev || 0);
            isApplyingRemoteRef.current = false;
          });
        } else {
          await setDoc(
            sceneDocRef,
            {
              canvasStr: serializeString(c),
              width: w,
              height: h,
              updatedAt: serverTimestamp(),
              lastEditor: clientIdRef.current,
              rev: 1,
              nextGuest: 1,
            },
            { merge: true }
          );
          lastRevRef.current = 1;
        }
      } else {
        await setDoc(sceneDocRef, {
          canvasStr: serializeString(c),
          width: w,
          height: h,
          updatedAt: serverTimestamp(),
          lastEditor: clientIdRef.current,
          rev: 1,
          nextGuest: 1,
        });
        lastRevRef.current = 1;
      }

      // After scene exists: ensure we have a presence doc with guest name
      await ensurePresence(sceneDocRef);
    });

    // ----------------- REALTIME SCENE -----------------
    const unsubScene = onSnapshot(sceneDocRef, (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();

      // ignore our own writes (prevents replay loops)
      if (data.lastEditor === clientIdRef.current) return;

      const rev = Number(data.rev || 0);
      if (rev > lastRevRef.current) {
        lastRevRef.current = rev;
        isApplyingRemoteRef.current = true;
        clearScheduledSave();

        const payload = data.canvasStr
          ? JSON.parse(data.canvasStr)
          : data.canvas;
        if (payload) {
          fabricRef.current.loadFromJSON(payload, () => {
            if (data.width && data.height) {
              fabricRef.current.setDimensions({
                width: data.width,
                height: data.height,
              });
            }
            fabricRef.current.requestRenderAll();
            isApplyingRemoteRef.current = false;
          });
        } else {
          isApplyingRemoteRef.current = false;
        }
      }
    });

    // ----------------- REALTIME PRESENCE -----------------
    const presenceColRef = collection(sceneDocRef, "presence");
    const unsubPresence = onSnapshot(presenceColRef, (qs) => {
      const now = Date.now();
      const list = [];
      const currentActive = new Set();

      qs.forEach((d) => {
        const v = d.data();
        const last = v.lastActive?.toMillis?.() ?? 0;
        const stale = now - last > PRESENCE_STALE_MS;

        const entry = {
          id: d.id,
          name: v.name,
          color: v.color,
          x: v.x,
          y: v.y,
          isDrawing: v.isDrawing,
          hidden: stale,
        };
        list.push(entry);

        if (!stale) currentActive.add(d.id);
      });

      // compute joins / leaves against previous active set (exclude self)
      const prev = prevActiveUsersRef.current;

      // Joins
      currentActive.forEach((idNow) => {
        if (!prev.has(idNow) && idNow !== clientIdRef.current) {
          const u = list.find((u) => u.id === idNow);
          if (u?.name) pushToast(`${u.name} joined the canvas`);
        }
      });
      // Leaves
      prev.forEach((idPrev) => {
        if (!currentActive.has(idPrev) && idPrev !== clientIdRef.current) {
          // try find name from previous known users or QS (may be null if deleted)
          const u = list.find((u) => u.id === idPrev);
          const name = u?.name || "Guest";
          pushToast(`${name} left the canvas`);
        }
      });

      prevActiveUsersRef.current = currentActive;
      setPresenceUsers(list);
    });

    // ----------------- PUBLISH LOCAL CURSOR (throttled) -----------------
    const publishPointer = (x, y) => {
      throttle(() => {
        setDoc(
          myPresenceDocRef,
          { x, y, lastActive: serverTimestamp() },
          { merge: true }
        ).catch(() => {});
      }, 80);
    };

    // Use Fabric's pointer—already in canvas coords
    const onMouseMove = (opt) => {
      const p = fabricRef.current.getPointer(opt.e);
      publishPointer(p.x, p.y);
    };
    c.on("mouse:move", onMouseMove);

    const onMouseDown = () => {
      setDoc(
        myPresenceDocRef,
        { isDrawing: true, lastActive: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    };
    const onMouseUp = () => {
      setDoc(
        myPresenceDocRef,
        { isDrawing: false, lastActive: serverTimestamp() },
        { merge: true }
      ).catch(() => {});
    };
    c.on("mouse:down", onMouseDown);
    c.on("mouse:up", onMouseUp);

    // ----------------- CLEANUP -----------------
    const cleanupPresence = async () => {
      try {
        await deleteDoc(myPresenceDocRef);
      } catch {}
    };
    window.addEventListener("beforeunload", cleanupPresence);

    return () => {
      unsubScene();
      unsubPresence();
      window.removeEventListener("resize", resizeToContainer);
      window.removeEventListener("beforeunload", cleanupPresence);
      window.removeEventListener("beforeunload", flushPending);
      if (containerRef.current) ro.disconnect();
      c.off("mouse:move", onMouseMove);
      c.off("mouse:down", onMouseDown);
      c.off("mouse:up", onMouseUp);
      c.off("mouse:down", onMouseDownForHistory);
      c.off("mouse:up", onMouseUpForHistory);
      c.dispose();
      clearScheduledSave();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- ensure presence: assign "Guest N" once ----------
  async function ensurePresence(sceneDocRef) {
    try {
      const guestNumber = await runTransaction(db, async (tx) => {
        const snap = await tx.get(sceneDocRef);
        const data = snap.exists() ? snap.data() : {};
        const n = data?.nextGuest ?? 1;
        tx.set(sceneDocRef, { nextGuest: increment(1) }, { merge: true });
        return n;
      });

      await setDoc(
        myPresenceDocRef,
        {
          name: `Guest ${guestNumber}`,
          color: MY_COLOR,
          x: 20,
          y: 20,
          isDrawing: false,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
      pushToast(`Guest ${guestNumber} joined the canvas`);
    } catch {
      await setDoc(
        myPresenceDocRef,
        {
          name: `Guest`,
          color: MY_COLOR,
          x: 20,
          y: 20,
          isDrawing: false,
          lastActive: serverTimestamp(),
        },
        { merge: true }
      );
      pushToast(`Guest joined the canvas`);
    }
  }

  /* ------------------------------- Tools ----------------------------------- */
  const pushHistoryBeforeProgrammaticChange = () => {
    if (isApplyingRemoteRef.current || isApplyingHistoryRef.current) return;
    undoStackRef.current.push(serializeObject(fabricRef.current));
    if (undoStackRef.current.length > 50) undoStackRef.current.shift();
    // clear redo on new branch
    redoStackRef.current = [];
  };

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
    pushHistoryBeforeProgrammaticChange();
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
    pushHistoryBeforeProgrammaticChange();
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
    pushHistoryBeforeProgrammaticChange();
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
      pushHistoryBeforeProgrammaticChange();
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
      pushHistoryBeforeProgrammaticChange();
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
      pushHistoryBeforeProgrammaticChange();
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
    if (undoStackRef.current.length === 0) return;
    const prev = undoStackRef.current.pop();
    redoStackRef.current.push(serializeObject(c));
    isApplyingHistoryRef.current = true;
    c.loadFromJSON(prev, () => {
      c.requestRenderAll();
      isApplyingHistoryRef.current = false;
    });
  };

  const redo = () => {
    const c = fabricRef.current;
    if (redoStackRef.current.length === 0) return;
    const next = redoStackRef.current.pop();
    undoStackRef.current.push(serializeObject(c));
    isApplyingHistoryRef.current = true;
    c.loadFromJSON(next, () => {
      c.requestRenderAll();
      isApplyingHistoryRef.current = false;
    });
  };

  // ---------- render ----------
  return (
    <div className="relative flex flex-col h-screen w-screen">
      <Toasts items={toasts} />

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

      <div ref={containerRef} className="relative flex-1 overflow-hidden">
        {/* Live cursors overlay */}
        <PresenceLayer
          meId={clientIdRef.current}
          users={presenceUsers}
          showSelf={false}
        />
        {/* Fabric canvas */}
        <canvas ref={canvasElRef} className="block" />
      </div>
    </div>
  );
}
