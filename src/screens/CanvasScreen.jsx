import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { fabric } from 'fabric';
import { db } from '../config/firestore.js';
import {
  doc,
  getDoc,
  setDoc,
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import Toolbar from '../components/Toolbar.jsx';

/**
 * CanvasScreen renders the collaborative drawing surface for a given scene ID.
 * It uses Fabric.js to manage objects on the canvas and Firestore to
 * synchronise state across clients. Undo/redo history is stored in memory.
 */
export default function CanvasScreen() {
  const { id } = useParams();
  const canvasRef = useRef(null);
  const fabricCanvasRef = useRef(null);
  const [fillColor, setFillColor] = useState('#bfdfff');
  const [strokeColor, setStrokeColor] = useState('#222222');
  const [penMode, setPenMode] = useState(false);
  const saveTimeoutRef = useRef(null);
  const lastRemoteUpdateTimeRef = useRef(null);
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);

  useEffect(() => {
    if (!id) return;
    const fabricCanvas = new fabric.Canvas(canvasRef.current, {
      width: 1000,
      height: 600,
      backgroundColor: '#ffffff',
      selection: true
    });
    fabricCanvasRef.current = fabricCanvas;

    const scheduleSave = () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => {
        saveCanvas();
      }, 1000);
    };
    const updateSelection = (e) => {
      const obj = e.selected ? e.selected[0] : null;
      if (obj) {
        if (obj.fill) setFillColor(obj.fill);
        if (obj.stroke) setStrokeColor(obj.stroke);
      }
    };
    // attach events
    fabricCanvas.on('selection:created', updateSelection);
    fabricCanvas.on('selection:updated', updateSelection);
    fabricCanvas.on('object:added', scheduleSave);
    fabricCanvas.on('object:modified', scheduleSave);
    fabricCanvas.on('object:removed', scheduleSave);
    fabricCanvas.on('path:created', scheduleSave);
    const recordHistory = () => {
      undoStackRef.current.push(fabricCanvas.toJSON());
      if (undoStackRef.current.length > 50) undoStackRef.current.shift();
      redoStackRef.current = [];
    };
    fabricCanvas.on('object:added', recordHistory);
    fabricCanvas.on('object:modified', recordHistory);
    fabricCanvas.on('object:removed', recordHistory);
    // Firestore doc reference
    const docRef = doc(db, 'scenes', id);
    // Save canvas state
    const saveCanvas = () => {
      const json = fabricCanvas.toJSON();
      setDoc(docRef, {
        canvas: json,
        updatedAt: serverTimestamp()
      }).catch((err) => {
        console.error('Error saving canvas:', err);
      });
    };
    // Load state
    getDoc(docRef).then((snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.canvas) {
          fabricCanvas.loadFromJSON(data.canvas).then(() => {
            fabricCanvas.requestRenderAll();
            if (data.updatedAt) {
              lastRemoteUpdateTimeRef.current = data.updatedAt.toMillis();
            }
          });
        }
      } else {
        saveCanvas();
      }
    });
    // Subscribe to changes
    const unsubscribe = onSnapshot(docRef, (snapshot) => {
      if (snapshot.metadata.hasPendingWrites) return;
      const data = snapshot.data();
      if (!data || !data.updatedAt) return;
      const remoteTime = data.updatedAt.toMillis();
      if (!lastRemoteUpdateTimeRef.current || remoteTime > lastRemoteUpdateTimeRef.current) {
        lastRemoteUpdateTimeRef.current = remoteTime;
        fabricCanvas.loadFromJSON(data.canvas).then(() => {
          fabricCanvas.requestRenderAll();
        });
      }
    });
    return () => {
      unsubscribe();
      fabricCanvas.dispose();
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [id]);

  // Helper functions for shapes and tools
  const addRect = () => {
    const rect = new fabric.Rect({
      left: 50,
      top: 50,
      width: 120,
      height: 80,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: 1
    });
    const c = fabricCanvasRef.current;
    c.add(rect);
    c.setActiveObject(rect);
    c.requestRenderAll();
  };
  const addCircle = () => {
    const circle = new fabric.Circle({
      left: 100,
      top: 100,
      radius: 50,
      fill: fillColor,
      stroke: strokeColor,
      strokeWidth: 1
    });
    const c = fabricCanvasRef.current;
    c.add(circle);
    c.setActiveObject(circle);
    c.requestRenderAll();
  };
  const addText = () => {
    const textbox = new fabric.Textbox('Double‑click to edit', {
      left: 150,
      top: 150,
      fontSize: 24,
      fill: strokeColor
    });
    const c = fabricCanvasRef.current;
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
      obj.set('fill', color);
      c.requestRenderAll();
    }
  };
  const handleStrokeChange = (e) => {
    const color = e.target.value;
    setStrokeColor(color);
    const c = fabricCanvasRef.current;
    const obj = c.getActiveObject();
    if (obj && obj.stroke !== undefined) {
      obj.set('stroke', color);
      c.requestRenderAll();
    }
    if (c.isDrawingMode) {
      c.freeDrawingBrush.color = color;
    }
  };
  const shareCanvas = () => {
    const url = window.location.href;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        alert('Shareable link copied to your clipboard.');
      }).catch(() => {
        prompt('Copy this link to share your canvas:', url);
      });
    } else {
      prompt('Copy this link to share your canvas:', url);
    }
  };
  const exportPNG = () => {
    const c = fabricCanvasRef.current;
    const dataURL = c.toDataURL({ format: 'png' });
    const link = document.createElement('a');
    link.href = dataURL;
    link.download = `canvas-${id}.png`;
    link.click();
  };
  const exportSVG = () => {
    const c = fabricCanvasRef.current;
    const svgData = c.toSVG();
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
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
      c.loadFromJSON(prev).then(() => {
        c.requestRenderAll();
      });
    }
  };
  const redo = () => {
    const c = fabricCanvasRef.current;
    if (redoStackRef.current.length > 0) {
      const next = redoStackRef.current.pop();
      undoStackRef.current.push(c.toJSON());
      c.loadFromJSON(next).then(() => {
        c.requestRenderAll();
      });
    }
  };

  return (
    <div>
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
      <div className="flex justify-center items-center p-5">
        <canvas ref={canvasRef} className="border border-gray-300 shadow" />
      </div>
    </div>
  );
}