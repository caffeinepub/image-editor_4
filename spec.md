# Image Editor

## Current State
The app is a functional image editor with freehand drawing (strokes) and text boxes. Selection frames show a drag handle (theme-colored bar with dots at top). There is NO figure tool, NO resize handle, and NO rotate handle in the current codebase.

## Requested Changes (Diff)

### Add
1. **Figure tool** — new toolbar button (alongside draw and text) that opens a 3×3 shape picker popup styled identically to the color picker. 9 shapes: line arrow, block arrow, rectangle, triangle, circle, ellipse, star, pentagon, hexagon. Clicking a shape selects it; user then click-drags on canvas to define size/position. Figures use the active color and support undo, selection, drag-to-move.
2. **Resize handle** — upper-right corner of every selection frame (strokes, text, figures). Dragging resizes the object around its center. Maintains aspect ratio by default; hold Shift for free resize.
3. **Rotate handle** — upper-left corner of every selection frame (strokes, text, figures). Dragging rotates the object around its center.

### Modify
- `Layer` type union: add `FigureLayer` with fields: id, type:"figure", shape, x, y, width, height, rotation, color.
- `renderLayers`: add figure rendering branch (draw each shape as canvas path, apply rotation transform).
- `getLayerBounds`: add figure branch.
- `hitTest`: add figure branch.
- Selection overlay: add resize handle (upper-right) and rotate handle (upper-left) corner buttons to the selection frame div — for ALL layer types including text.
- `startHandleDrag` → keep for drag. Add separate `startResizeDrag` and `startRotateDrag` refs.
- Document-level mousemove/mouseup: handle resize and rotate drag states in addition to existing move and draw.
- Tool type: extend from `"text" | "draw"` to include `"figure"`.
- Toolbar: add figure tool button with a shapes icon; clicking opens a Popover with 3×3 grid of shape buttons.

### Remove
- Nothing removed.

## Implementation Plan
1. Add `FigureLayer` type with shape, x, y, width, height, rotation, color.
2. Add figure rendering to `renderLayers` — each shape drawn as canvas path at normalized coords, with rotation applied around center.
3. Add figure bounds to `getLayerBounds`.
4. Add figure hit-test logic.
5. Add `"figure"` to Tool type; add figure toolbar button with shape picker Popover (3×3 grid, same style as color picker).
6. Add figure draw logic to `handleMouseDown`/document mousemove (click-drag to size).
7. Add resize drag state ref and handler — tracks start mouse pos, original bounds; updates width/height (and x/y to keep center fixed) on mousemove.
8. Add rotate drag state ref and handler — tracks start angle from center; updates rotation on mousemove.
9. Add resize handle (corner button, upper-right) and rotate handle (corner button, upper-left) to the selection overlay for ALL layer types.
10. Extend move-drag for FigureLayer (update x/y).
11. Apply rotation transform when rendering figure selection frame.
