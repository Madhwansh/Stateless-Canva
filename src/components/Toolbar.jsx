import React from "react";
import Dock from "./Dock";
import {
  Square,
  Circle,
  Type,
  Pencil,
  Trash2,
  Undo2,
  Redo2,
  ImageDown,
  FileDown,
  Share2,
  Droplet,
  Palette,
} from "lucide-react";

export default function Toolbar({
  addRect,
  addCircle,
  addText,
  togglePen,
  deleteSelected,
  undo,
  redo,
  exportPNG,
  exportSVG,
  shareCanvas,
  fillColor,
  strokeColor,
  onFillChange,
  onStrokeChange,
  penMode,
}) {
  const items = [
    {
      label: "Rectangle",
      icon: <Square size={20} className="text-white" />,
      onClick: addRect,
    },
    {
      label: "Circle",
      icon: <Circle size={20} className="text-white" />,
      onClick: addCircle,
    },
    {
      label: "Text",
      icon: <Type size={20} className="text-white" />,
      onClick: addText,
    },

    {
      label: "Pen",
      icon: <Pencil size={20} className="text-white" />,
      onClick: togglePen,
      className: penMode ? "ring-2 ring-white/60" : "",
    },

    // Color pickers: icon + transparent color input overlay
    {
      label: "Fill",
      icon: (
        <div className="relative flex items-center justify-center">
          <Droplet size={20} className="text-white" />
          <input
            aria-label="Fill color"
            type="color"
            value={fillColor}
            onChange={onFillChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
      ),
    },
    {
      label: "Stroke",
      icon: (
        <div className="relative flex items-center justify-center">
          <Palette size={20} className="text-white" />
          <input
            aria-label="Stroke color"
            type="color"
            value={strokeColor}
            onChange={onStrokeChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
        </div>
      ),
    },

    {
      label: "Delete",
      icon: <Trash2 size={20} className="text-white" />,
      onClick: deleteSelected,
    },
    {
      label: "Undo",
      icon: <Undo2 size={20} className="text-white" />,
      onClick: undo,
    },
    {
      label: "Redo",
      icon: <Redo2 size={20} className="text-white" />,
      onClick: redo,
    },

    {
      label: "Export PNG",
      icon: <ImageDown size={20} className="text-white" />,
      onClick: exportPNG,
    },
    {
      label: "Export SVG",
      icon: <FileDown size={20} className="text-white" />,
      onClick: exportSVG,
    },
    {
      label: "Share",
      icon: <Share2 size={20} className="text-white" />,
      onClick: shareCanvas,
    },
  ];

  return (
    <Dock
      items={items}
      panelHeight={64}
      dockHeight={220}
      baseItemSize={44}
      magnification={72} // how big icons grow on hover
      distance={180} // hover influence range
      className="select-none"
    />
  );
}
