import React from 'react';

/**
 * Stateless toolbar component for the canvas editor. It exposes actions
 * through props and uses Tailwind utility classes for styling. The
 * `penMode` prop toggles an active style on the pen button when free
 * drawing mode is enabled.
 */
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
  penMode
}) {
  // Utility classes reused on buttons for a consistent look
  const baseButton = 'px-3 py-2 rounded text-white bg-blue-500 hover:bg-blue-600 transition-colors';
  const activeButton = 'bg-blue-700';
  return (
    <div className="toolbar flex flex-wrap items-center gap-2 p-3 bg-white shadow sticky top-0 z-10">
      <button onClick={addRect} className={baseButton}>Rectangle</button>
      <button onClick={addCircle} className={baseButton}>Circle</button>
      <button onClick={addText} className={baseButton}>Text</button>
      <button
        onClick={togglePen}
        className={`${baseButton} ${penMode ? activeButton : ''}`}
      >
        {penMode ? 'Pen (On)' : 'Pen'}
      </button>
      <label className="flex items-center gap-1 text-sm text-gray-700">
        Fill
        <input type="color" value={fillColor} onChange={onFillChange} className="w-6 h-6 p-0 border-0" />
      </label>
      <label className="flex items-center gap-1 text-sm text-gray-700">
        Stroke
        <input type="color" value={strokeColor} onChange={onStrokeChange} className="w-6 h-6 p-0 border-0" />
      </label>
      <button onClick={deleteSelected} className={baseButton}>Delete</button>
      <button onClick={undo} className={baseButton}>Undo</button>
      <button onClick={redo} className={baseButton}>Redo</button>
      <button onClick={exportPNG} className={baseButton}>Export PNG</button>
      <button onClick={exportSVG} className={baseButton}>Export SVG</button>
      <button onClick={shareCanvas} className={baseButton}>Share</button>
    </div>
  );
}