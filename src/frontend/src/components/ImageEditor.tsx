import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useActor } from "@/hooks/useActor";
import {
  Download,
  ImageIcon,
  Pencil,
  Redo2,
  Shapes,
  Trash2,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type Tool = "text" | "draw" | "figure";

type FigureShape =
  | "line-arrow"
  | "block-arrow"
  | "rectangle"
  | "triangle"
  | "circle"
  | "ellipse"
  | "star"
  | "pentagon"
  | "hexagon";

interface TextLayer {
  id: string;
  type: "text";
  x: number;
  y: number;
  content: string;
  fontFamily: string;
  fontSize: number;
  color: string;
  rotation: number;
}

interface StrokeLayer {
  id: string;
  type: "stroke";
  points: { x: number; y: number }[];
  color: string;
  thickness: number;
}

interface FigureLayer {
  id: string;
  type: "figure";
  shape: FigureShape;
  x: number; // center x, normalized 0-1
  y: number; // center y, normalized 0-1
  width: number; // normalized 0-1
  height: number; // normalized 0-1
  rotation: number; // radians
  color: string;
}

type Layer = TextLayer | StrokeLayer | FigureLayer;

const FONT_OPTIONS = [
  "Calibri",
  "Arial",
  "Georgia",
  "Courier New",
  "Times New Roman",
];

const PRESET_COLORS = [
  "#000000",
  "#ffffff",
  "#ff0000",
  "#ff6600",
  "#ffcc00",
  "#99ff00",
  "#00cc00",
  "#00aa88",
  "#00ccff",
  "#0066ff",
  "#4400ff",
  "#aa00ff",
  "#ff00aa",
  "#ff00ff",
  "#884400",
  "#888888",
];

const FIGURE_SHAPES: { id: FigureShape; label: string }[] = [
  { id: "line-arrow", label: "Arrow" },
  { id: "block-arrow", label: "Block Arrow" },
  { id: "rectangle", label: "Rectangle" },
  { id: "triangle", label: "Triangle" },
  { id: "circle", label: "Circle" },
  { id: "ellipse", label: "Ellipse" },
  { id: "star", label: "Star" },
  { id: "pentagon", label: "Pentagon" },
  { id: "hexagon", label: "Hexagon" },
];

const DEFAULT_COLOR = "#ff0000";
const DEFAULT_FONT = "Calibri";
const DEFAULT_FONT_SIZE = 24;
const DEFAULT_THICKNESS = 5;
const DRAG_HANDLE_HEIGHT = 12;
const TEXT_PAD = 4;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function drawFigurePath(
  ctx: CanvasRenderingContext2D,
  shape: FigureShape,
  w: number,
  h: number,
) {
  ctx.beginPath();
  switch (shape) {
    case "rectangle":
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      break;
    case "circle":
      ctx.arc(0, 0, Math.min(w, h) / 2, 0, 2 * Math.PI);
      ctx.fill();
      break;
    case "ellipse":
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, 2 * Math.PI);
      ctx.fill();
      break;
    case "triangle":
      ctx.moveTo(0, -h / 2);
      ctx.lineTo(w / 2, h / 2);
      ctx.lineTo(-w / 2, h / 2);
      ctx.closePath();
      ctx.fill();
      break;
    case "pentagon": {
      const rp = Math.min(w, h) / 2;
      for (let i = 0; i < 5; i++) {
        const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
        if (i === 0) ctx.moveTo(rp * Math.cos(angle), rp * Math.sin(angle));
        else ctx.lineTo(rp * Math.cos(angle), rp * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "hexagon": {
      const rh = Math.min(w, h) / 2;
      for (let i = 0; i < 6; i++) {
        const angle = (i * 2 * Math.PI) / 6;
        if (i === 0) ctx.moveTo(rh * Math.cos(angle), rh * Math.sin(angle));
        else ctx.lineTo(rh * Math.cos(angle), rh * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "star": {
      const outerR = Math.min(w, h) / 2;
      const innerR = outerR * 0.4;
      for (let i = 0; i < 10; i++) {
        const angle = (i * Math.PI) / 5 - Math.PI / 2;
        const r = i % 2 === 0 ? outerR : innerR;
        if (i === 0) ctx.moveTo(r * Math.cos(angle), r * Math.sin(angle));
        else ctx.lineTo(r * Math.cos(angle), r * Math.sin(angle));
      }
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "line-arrow": {
      const aw = Math.max(8, Math.min(20, w * 0.25));
      const ah = Math.max(5, Math.min(12, h * 0.4));
      ctx.lineWidth = Math.max(2, h * 0.12);
      ctx.moveTo(-w / 2, 0);
      ctx.lineTo(w / 2 - aw, 0);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(w / 2, 0);
      ctx.lineTo(w / 2 - aw, -ah);
      ctx.lineTo(w / 2 - aw, ah);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "block-arrow": {
      const headW = w * 0.38;
      const bodyH = h * 0.5;
      ctx.moveTo(-w / 2, -bodyH / 2);
      ctx.lineTo(w / 2 - headW, -bodyH / 2);
      ctx.lineTo(w / 2 - headW, -h / 2);
      ctx.lineTo(w / 2, 0);
      ctx.lineTo(w / 2 - headW, h / 2);
      ctx.lineTo(w / 2 - headW, bodyH / 2);
      ctx.lineTo(-w / 2, bodyH / 2);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

function renderLayers(
  ctx: CanvasRenderingContext2D,
  layers: Layer[],
  cw: number,
  ch: number,
  skipId: string | null,
) {
  for (const layer of layers) {
    if (layer.id === skipId) continue;

    if (layer.type === "stroke") {
      if (layer.points.length < 2) continue;
      ctx.save();
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = layer.thickness;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      const first = layer.points[0];
      ctx.moveTo(first.x * cw, first.y * ch);
      for (let i = 1; i < layer.points.length; i++) {
        const p = layer.points[i];
        ctx.lineTo(p.x * cw, p.y * ch);
      }
      ctx.stroke();
      ctx.restore();
    } else if (layer.type === "text") {
      ctx.save();
      ctx.fillStyle = layer.color;
      ctx.font = `${layer.fontSize}px '${layer.fontFamily}', sans-serif`;
      ctx.textBaseline = "top";
      const px = layer.x * cw;
      const py = layer.y * ch;
      const lines = layer.content.split("\n");
      const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 40);
      const textH = lines.length * layer.fontSize * 1.2;
      if (layer.rotation) {
        ctx.translate(px + textW / 2, py + textH / 2);
        ctx.rotate(layer.rotation);
        lines.forEach((line, i) => {
          ctx.fillText(line, -textW / 2, -textH / 2 + i * layer.fontSize * 1.2);
        });
      } else {
        lines.forEach((line, i) => {
          ctx.fillText(line, px, py + i * layer.fontSize * 1.2);
        });
      }
      ctx.restore();
    } else if (layer.type === "figure") {
      const cx = layer.x * cw;
      const cy = layer.y * ch;
      const w = layer.width * cw;
      const h = layer.height * ch;
      if (w < 2 && h < 2) continue;
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(layer.rotation);
      ctx.fillStyle = layer.color;
      ctx.strokeStyle = layer.color;
      ctx.lineWidth = 2;
      drawFigurePath(ctx, layer.shape, w, h);
      ctx.restore();
    }
  }
}

function getLayerBounds(
  layer: Layer,
  cw: number,
  ch: number,
  ctx: CanvasRenderingContext2D,
): { x: number; y: number; w: number; h: number } {
  if (layer.type === "text") {
    ctx.font = `${layer.fontSize}px '${layer.fontFamily}', sans-serif`;
    const lines = layer.content.split("\n");
    const textW = Math.max(...lines.map((l) => ctx.measureText(l).width), 40);
    const textH = lines.length * layer.fontSize * 1.2;
    return {
      x: layer.x * cw - TEXT_PAD,
      y: layer.y * ch - TEXT_PAD,
      w: textW + TEXT_PAD * 2,
      h: textH + TEXT_PAD * 2,
    };
  }
  if (layer.type === "figure") {
    const cx = layer.x * cw;
    const cy = layer.y * ch;
    const hw = (layer.width * cw) / 2 + 6;
    const hh = (layer.height * ch) / 2 + 6;
    return { x: cx - hw, y: cy - hh, w: hw * 2, h: hh * 2 };
  }
  // stroke
  if (layer.points.length === 0) return { x: 0, y: 0, w: 10, h: 10 };
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const p of layer.points) {
    minX = Math.min(minX, p.x * cw);
    minY = Math.min(minY, p.y * ch);
    maxX = Math.max(maxX, p.x * cw);
    maxY = Math.max(maxY, p.y * ch);
  }
  const pad = layer.thickness / 2 + 4;
  return {
    x: minX - pad,
    y: minY - pad,
    w: maxX - minX + pad * 2,
    h: maxY - minY + pad * 2,
  };
}

function DragHandleDots() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "3px",
        height: "100%",
        pointerEvents: "none",
      }}
    >
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 3,
            height: 3,
            borderRadius: "50%",
            background: "rgba(200,200,200,0.9)",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}

function ShapeIcon({ shape }: { shape: FigureShape }) {
  const stroke = "currentColor";
  const fill = "currentColor";
  switch (shape) {
    case "line-arrow":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <line
            x1="3"
            y1="16"
            x2="22"
            y2="16"
            stroke={stroke}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polygon points="29,16 21,11 21,21" fill={fill} />
        </svg>
      );
    case "block-arrow":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M3,13 L19,13 L19,9 L29,16 L19,23 L19,19 L3,19 Z"
            fill={fill}
          />
        </svg>
      );
    case "rectangle":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <rect x="4" y="8" width="24" height="16" fill={fill} />
        </svg>
      );
    case "triangle":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <polygon points="16,4 28,28 4,28" fill={fill} />
        </svg>
      );
    case "circle":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="16" cy="16" r="12" fill={fill} />
        </svg>
      );
    case "ellipse":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <ellipse cx="16" cy="16" rx="14" ry="9" fill={fill} />
        </svg>
      );
    case "star":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <polygon
            points="16,4 18.59,12.44 26.46,12.6 20.18,17.36 22.47,24.9 16,20.4 9.53,24.9 11.82,17.36 5.54,12.6 13.41,12.44"
            fill={fill}
          />
        </svg>
      );
    case "pentagon":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <polygon
            points="16,4 27.46,12.6 23.09,25.9 8.91,25.9 4.54,12.6"
            fill={fill}
          />
        </svg>
      );
    case "hexagon":
      return (
        <svg
          width="32"
          height="32"
          viewBox="0 0 32 32"
          fill="none"
          aria-hidden="true"
        >
          <polygon
            points="27,16 21.5,25.5 10.5,25.5 5,16 10.5,6.5 21.5,6.5"
            fill={fill}
          />
        </svg>
      );
    default:
      return null;
  }
}

// Corner handle component
function CornerHandle({
  style,
  cursor,
  onMouseDown,
  title,
}: {
  style: React.CSSProperties;
  cursor: string;
  onMouseDown: (e: React.MouseEvent) => void;
  title: string;
}) {
  return (
    <div
      title={title}
      style={{
        position: "absolute",
        width: 14,
        height: 14,
        background: "white",
        border: "1px solid hsl(var(--primary))",
        borderRadius: 2,
        zIndex: 30,
        cursor,
        pointerEvents: "all",
        ...style,
      }}
      onMouseDown={onMouseDown}
    />
  );
}

export default function ImageEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { actor } = useActor();

  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [layers, setLayers] = useState<Layer[]>([]);
  const [history, setHistory] = useState<Layer[][]>([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tool, setTool] = useState<Tool>("draw");
  const [selectedShape, setSelectedShape] = useState<FigureShape>("rectangle");
  const [color, setColor] = useState(DEFAULT_COLOR);
  const [hexInput, setHexInput] = useState(DEFAULT_COLOR);
  const [fontFamily, setFontFamily] = useState(DEFAULT_FONT);
  const [fontSize, setFontSize] = useState(DEFAULT_FONT_SIZE);
  const [thickness, setThickness] = useState(DEFAULT_THICKNESS);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isFiguring, setIsFiguring] = useState(false);
  const [isDraggingHandle, setIsDraggingHandle] = useState(false);
  const [dropHighlight, setDropHighlight] = useState(false);
  const [canvasSize, setCanvasSize] = useState({ w: 800, h: 600 });
  const [editCount, setEditCount] = useState<number>(0);

  const layersRef = useRef<Layer[]>([]);
  const historyRef = useRef<Layer[][]>([[]]);
  const historyIndexRef = useRef(0);
  const pushHistoryRef = useRef<(newLayers: Layer[]) => void>(() => {});
  const selectedIdRef = useRef<string | null>(null);
  const handleDragStateRef = useRef<{
    layerId: string;
    startMouseX: number;
    startMouseY: number;
    origX?: number;
    origY?: number;
    origPoints?: { x: number; y: number }[];
  } | null>(null);
  const drawingLayerId = useRef<string | null>(null);
  const isDrawingRef = useRef(false);
  const isFiguringRef = useRef(false);
  const figuringLayerId = useRef<string | null>(null);
  const figureStartRef = useRef<{ nx: number; ny: number } | null>(null);

  const resizeDragStateRef = useRef<{
    layerId: string;
    startMouseX: number;
    startMouseY: number;
    origWidth?: number;
    origHeight?: number;
    origPoints?: { x: number; y: number }[];
    origFontSize?: number;
  } | null>(null);

  const rotateDragStateRef = useRef<{
    layerId: string;
    centerNX: number;
    centerNY: number;
    startAngle: number;
    origRotation?: number;
    origPoints?: { x: number; y: number }[];
    origTextRotation?: number;
  } | null>(null);

  useEffect(() => {
    layersRef.current = layers;
  }, [layers]);
  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    historyIndexRef.current = historyIndex;
  }, [historyIndex]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    isDrawingRef.current = isDrawing;
  }, [isDrawing]);
  useEffect(() => {
    isFiguringRef.current = isFiguring;
  }, [isFiguring]);

  const selectedLayer = layers.find((l) => l.id === selectedId) ?? null;
  const selectedTextLayer =
    selectedLayer?.type === "text" ? (selectedLayer as TextLayer) : null;

  useEffect(() => {
    if (!actor) return;
    actor
      .getDownloadCount()
      .then((n) => setEditCount(Number(n)))
      .catch(() => {});
  }, [actor]);

  useEffect(() => {
    if (!selectedId) return;
    const layer = layersRef.current.find((l) => l.id === selectedId);
    if (layer) {
      setColor(layer.color);
      setHexInput(layer.color);
      if (layer.type === "text") {
        setFontFamily(layer.fontFamily);
        setFontSize(layer.fontSize);
      }
    }
  }, [selectedId]);

  const pushHistory = useCallback((newLayers: Layer[]) => {
    const newHist = historyRef.current.slice(0, historyIndexRef.current + 1);
    newHist.push(newLayers.map((l) => ({ ...l })));
    historyRef.current = newHist;
    historyIndexRef.current = newHist.length - 1;
    setHistory(newHist);
    setHistoryIndex(historyIndexRef.current);
    setLayers(newLayers);
  }, []);

  useEffect(() => {
    pushHistoryRef.current = pushHistory;
  }, [pushHistory]);

  const applyColor = useCallback(
    (val: string) => {
      setColor(val);
      setHexInput(val);
      if (selectedId) {
        setLayers((prev) =>
          prev.map((l) => (l.id === selectedId ? { ...l, color: val } : l)),
        );
      }
    },
    [selectedId],
  );

  // Document-level mouse handlers
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      // Resize drag
      const resize = resizeDragStateRef.current;
      if (resize) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dx = (e.clientX - resize.startMouseX) / rect.width;
        const dy = (e.clientY - resize.startMouseY) / rect.height;
        const shift = e.shiftKey;
        setLayers((prev) =>
          prev.map((l) => {
            if (l.id !== resize.layerId) return l;
            if (
              l.type === "figure" &&
              resize.origWidth !== undefined &&
              resize.origHeight !== undefined
            ) {
              const newW = Math.max(0.005, resize.origWidth + dx * 2);
              let newH: number;
              if (shift) {
                newH = Math.max(0.005, resize.origHeight - dy * 2);
              } else {
                const ratio =
                  resize.origHeight / Math.max(0.001, resize.origWidth);
                newH = newW * ratio;
              }
              return { ...l, width: newW, height: newH };
            }
            if (l.type === "stroke" && resize.origPoints) {
              const pts = resize.origPoints;
              if (pts.length === 0) return l;
              let minX = pts[0].x;
              let maxX = pts[0].x;
              for (const p of pts) {
                if (p.x < minX) minX = p.x;
                if (p.x > maxX) maxX = p.x;
              }
              const origW = maxX - minX;
              if (origW < 0.001) return l;
              const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
              const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
              const sf = Math.max(0.05, (origW + dx * 2) / origW);
              return {
                ...l,
                points: pts.map((p) => ({
                  x: cx + (p.x - cx) * sf,
                  y: cy + (p.y - cy) * sf,
                })),
              };
            }
            if (l.type === "text" && resize.origFontSize !== undefined) {
              const newSize = Math.max(
                6,
                Math.round(resize.origFontSize * (1 + dx * 3)),
              );
              return { ...l, fontSize: newSize };
            }
            return l;
          }),
        );
        return;
      }

      // Rotate drag
      const rotate = rotateDragStateRef.current;
      if (rotate) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = (e.clientX - rect.left) / rect.width;
        const my = (e.clientY - rect.top) / rect.height;
        const angle = Math.atan2(my - rotate.centerNY, mx - rotate.centerNX);
        const delta = angle - rotate.startAngle;
        setLayers((prev) =>
          prev.map((l) => {
            if (l.id !== rotate.layerId) return l;
            if (l.type === "figure" && rotate.origRotation !== undefined) {
              return { ...l, rotation: rotate.origRotation + delta };
            }
            if (l.type === "stroke" && rotate.origPoints) {
              const cx = rotate.centerNX;
              const cy = rotate.centerNY;
              return {
                ...l,
                points: rotate.origPoints.map((p) => {
                  const pdx = p.x - cx;
                  const pdy = p.y - cy;
                  return {
                    x: cx + pdx * Math.cos(delta) - pdy * Math.sin(delta),
                    y: cy + pdx * Math.sin(delta) + pdy * Math.cos(delta),
                  };
                }),
              };
            }
            if (l.type === "text" && rotate.origTextRotation !== undefined) {
              return { ...l, rotation: rotate.origTextRotation + delta };
            }
            return l;
          }),
        );
        return;
      }

      // Handle drag-handle dragging
      const drag = handleDragStateRef.current;
      if (drag) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const dx = (e.clientX - drag.startMouseX) / rect.width;
        const dy = (e.clientY - drag.startMouseY) / rect.height;
        setLayers((prev) =>
          prev.map((l) => {
            if (l.id !== drag.layerId) return l;
            if (
              l.type === "text" &&
              drag.origX !== undefined &&
              drag.origY !== undefined
            ) {
              return { ...l, x: drag.origX + dx, y: drag.origY + dy };
            }
            if (
              l.type === "figure" &&
              drag.origX !== undefined &&
              drag.origY !== undefined
            ) {
              return { ...l, x: drag.origX + dx, y: drag.origY + dy };
            }
            if (l.type === "stroke" && drag.origPoints) {
              return {
                ...l,
                points: drag.origPoints.map((p) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                })),
              };
            }
            return l;
          }),
        );
        return;
      }

      // Continue figuring
      if (
        isFiguringRef.current &&
        figuringLayerId.current &&
        figureStartRef.current
      ) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;
        const start = figureStartRef.current;
        const fw = Math.abs(nx - start.nx);
        const fh = Math.abs(ny - start.ny);
        const cx = (nx + start.nx) / 2;
        const cy = (ny + start.ny) / 2;
        setLayers((prev) =>
          prev.map((l) =>
            l.id === figuringLayerId.current && l.type === "figure"
              ? { ...l, x: cx, y: cy, width: fw, height: fh }
              : l,
          ),
        );
        return;
      }

      // Continue drawing
      if (isDrawingRef.current && drawingLayerId.current) {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const nx = (e.clientX - rect.left) / rect.width;
        const ny = (e.clientY - rect.top) / rect.height;
        setLayers((prev) =>
          prev.map((l) =>
            l.id === drawingLayerId.current && l.type === "stroke"
              ? { ...l, points: [...l.points, { x: nx, y: ny }] }
              : l,
          ),
        );
      }
    };

    const onMouseUp = () => {
      if (resizeDragStateRef.current) {
        resizeDragStateRef.current = null;
        pushHistoryRef.current(layersRef.current);
        return;
      }
      if (rotateDragStateRef.current) {
        rotateDragStateRef.current = null;
        pushHistoryRef.current(layersRef.current);
        return;
      }
      if (handleDragStateRef.current) {
        handleDragStateRef.current = null;
        setIsDraggingHandle(false);
        pushHistoryRef.current(layersRef.current);
        return;
      }
      if (isFiguringRef.current) {
        isFiguringRef.current = false;
        setIsFiguring(false);
        pushHistoryRef.current(layersRef.current);
        figuringLayerId.current = null;
        figureStartRef.current = null;
        return;
      }
      if (isDrawingRef.current) {
        isDrawingRef.current = false;
        setIsDrawing(false);
        pushHistoryRef.current(layersRef.current);
        drawingLayerId.current = null;
      }
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    return () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  const undo = useCallback(() => {
    if (historyIndexRef.current > 0) {
      const idx = historyIndexRef.current - 1;
      historyIndexRef.current = idx;
      setHistoryIndex(idx);
      setLayers(historyRef.current[idx].map((l) => ({ ...l })));
      setSelectedId(null);
    }
  }, []);

  const redo = useCallback(() => {
    if (historyIndexRef.current < historyRef.current.length - 1) {
      const idx = historyIndexRef.current + 1;
      historyIndexRef.current = idx;
      setHistoryIndex(idx);
      setLayers(historyRef.current[idx].map((l) => ({ ...l })));
      setSelectedId(null);
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        redo();
      } else if (mod && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        undo();
      } else if (
        (e.key === "Delete" || e.key === "Backspace") &&
        selectedId &&
        selectedIdRef.current &&
        layersRef.current.find((l) => l.id === selectedIdRef.current)?.type !==
          "text"
      ) {
        e.preventDefault();
        const newLayers = layersRef.current.filter((l) => l.id !== selectedId);
        pushHistoryRef.current(newLayers);
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [undo, redo, selectedId]);

  // Canvas render
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasSize.w, canvasSize.h);
    if (image) {
      ctx.drawImage(image, 0, 0, canvasSize.w, canvasSize.h);
    } else {
      ctx.fillStyle = "#1a1d26";
      ctx.fillRect(0, 0, canvasSize.w, canvasSize.h);
    }
    const skipId = selectedTextLayer ? selectedId : null;
    renderLayers(ctx, layers, canvasSize.w, canvasSize.h, skipId);
  }, [image, layers, canvasSize, selectedId, selectedTextLayer]);

  // Canvas sizing
  useEffect(() => {
    if (!image || !containerRef.current) return;
    const container = containerRef.current;
    const calcSize = () => {
      const cw = container.clientWidth - 48;
      const ch = container.clientHeight - 48;
      const aspect = image.naturalWidth / image.naturalHeight;
      let w = cw;
      let h = w / aspect;
      if (h > ch) {
        h = ch;
        w = h * aspect;
      }
      setCanvasSize({ w: Math.floor(w), h: Math.floor(h) });
    };
    const ro = new ResizeObserver(calcSize);
    ro.observe(container);
    calcSize();
    return () => ro.disconnect();
  }, [image]);

  const loadImageFile = useCallback((file: File) => {
    if (!file.type.match(/image\/(png|jpeg|jpg)/)) {
      toast.error("Please upload a PNG or JPG image.");
      return;
    }
    setImageFile(file);
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setLayers([]);
      historyRef.current = [[]];
      historyIndexRef.current = 0;
      setHistory([[]]);
      setHistoryIndex(0);
      setSelectedId(null);
      URL.revokeObjectURL(url);
    };
    img.src = url;
  }, []);

  const hitTest = useCallback((nx: number, ny: number): string | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const cw = canvas.width;
    const ch = canvas.height;
    for (let i = layersRef.current.length - 1; i >= 0; i--) {
      const layer = layersRef.current[i];
      if (layer.type === "text") {
        ctx.font = `${layer.fontSize}px '${layer.fontFamily}', sans-serif`;
        const lines = layer.content.split("\n");
        const maxW = Math.max(
          ...lines.map((l) => ctx.measureText(l).width),
          20,
        );
        const h = lines.length * layer.fontSize * 1.2;
        const lx = layer.x * cw;
        const ly = layer.y * ch;
        if (
          nx * cw >= lx - 8 &&
          nx * cw <= lx + maxW + 8 &&
          ny * ch >= ly - 8 &&
          ny * ch <= ly + h + 8
        ) {
          return layer.id;
        }
      } else if (layer.type === "stroke") {
        for (const p of layer.points) {
          const dist = Math.sqrt(
            ((nx - p.x) * cw) ** 2 + ((ny - p.y) * ch) ** 2,
          );
          if (dist <= layer.thickness / 2 + 8) return layer.id;
        }
      } else if (layer.type === "figure") {
        const cx = layer.x;
        const cy = layer.y;
        const hw = layer.width / 2 + 8 / cw;
        const hh = layer.height / 2 + 8 / ch;
        if (nx >= cx - hw && nx <= cx + hw && ny >= cy - hh && ny <= cy + hh) {
          return layer.id;
        }
      }
    }
    return null;
  }, []);

  const commitSelectedText = useCallback(() => {
    const sid = selectedIdRef.current;
    if (!sid) return;
    const layer = layersRef.current.find((l) => l.id === sid);
    if (!layer || layer.type !== "text") return;
    if ((layer as TextLayer).content.trim() === "") {
      pushHistoryRef.current(layersRef.current.filter((l) => l.id !== sid));
    } else {
      pushHistoryRef.current(layersRef.current);
    }
  }, []);

  const focusTextarea = useCallback(() => {
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        ta.setSelectionRange(ta.value.length, ta.value.length);
        ta.style.height = "auto";
        ta.style.height = `${ta.scrollHeight}px`;
      }
    }, 0);
  }, []);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    const currentSid = selectedIdRef.current;
    const currentLayer = currentSid
      ? layersRef.current.find((l) => l.id === currentSid)
      : null;
    if (currentLayer?.type === "text") {
      if ((currentLayer as TextLayer).content.trim() === "") {
        pushHistoryRef.current(
          layersRef.current.filter((l) => l.id !== currentSid),
        );
      } else {
        pushHistoryRef.current(layersRef.current);
      }
    }

    const hit = hitTest(nx, ny);
    if (hit) {
      setSelectedId(hit);
      const hitLayer = layersRef.current.find((l) => l.id === hit);
      if (hitLayer?.type === "text") focusTextarea();
      return;
    }

    setSelectedId(null);

    if (tool === "text") {
      const newLayer: TextLayer = {
        id: uid(),
        type: "text",
        x: nx,
        y: ny,
        content: "",
        fontFamily,
        fontSize,
        color,
        rotation: 0,
      };
      setLayers((prev) => [...prev, newLayer]);
      setSelectedId(newLayer.id);
      focusTextarea();
    } else if (tool === "draw") {
      setIsDrawing(true);
      isDrawingRef.current = true;
      const newLayer: StrokeLayer = {
        id: uid(),
        type: "stroke",
        points: [{ x: nx, y: ny }],
        color,
        thickness,
      };
      drawingLayerId.current = newLayer.id;
      setLayers((prev) => [...prev, newLayer]);
      setSelectedId(newLayer.id);
    } else if (tool === "figure") {
      isFiguringRef.current = true;
      setIsFiguring(true);
      figureStartRef.current = { nx, ny };
      const newLayer: FigureLayer = {
        id: uid(),
        type: "figure",
        shape: selectedShape,
        x: nx,
        y: ny,
        width: 0,
        height: 0,
        rotation: 0,
        color,
      };
      figuringLayerId.current = newLayer.id;
      setLayers((prev) => [...prev, newLayer]);
      setSelectedId(newLayer.id);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !drawingLayerId.current) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;
    setLayers((prev) =>
      prev.map((l) =>
        l.id === drawingLayerId.current && l.type === "stroke"
          ? { ...l, points: [...l.points, { x: nx, y: ny }] }
          : l,
      ),
    );
  };

  const handleMouseUp = () => {
    // Handled by document-level mouseup
  };

  const startHandleDrag = (e: React.MouseEvent, layerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layersRef.current.find((l) => l.id === layerId);
    if (!layer) return;
    handleDragStateRef.current = {
      layerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origX:
        layer.type === "text" || layer.type === "figure" ? layer.x : undefined,
      origY:
        layer.type === "text" || layer.type === "figure" ? layer.y : undefined,
      origPoints:
        layer.type === "stroke"
          ? layer.points.map((p) => ({ ...p }))
          : undefined,
    };
    setIsDraggingHandle(true);
  };

  const startResizeDrag = (e: React.MouseEvent, layerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layersRef.current.find((l) => l.id === layerId);
    if (!layer) return;
    resizeDragStateRef.current = {
      layerId,
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      origWidth: layer.type === "figure" ? layer.width : undefined,
      origHeight: layer.type === "figure" ? layer.height : undefined,
      origPoints:
        layer.type === "stroke"
          ? layer.points.map((p) => ({ ...p }))
          : undefined,
      origFontSize: layer.type === "text" ? layer.fontSize : undefined,
    };
  };

  const startRotateDrag = (
    e: React.MouseEvent,
    layerId: string,
    bounds: { x: number; y: number; w: number; h: number },
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const layer = layersRef.current.find((l) => l.id === layerId);
    if (!layer) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Center in normalized coords from bounds
    const centerNX = (bounds.x + bounds.w / 2) / canvasSize.w;
    const centerNY = (bounds.y + bounds.h / 2) / canvasSize.h;
    const rect = canvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top) / rect.height;
    const startAngle = Math.atan2(my - centerNY, mx - centerNX);
    rotateDragStateRef.current = {
      layerId,
      centerNX,
      centerNY,
      startAngle,
      origRotation: layer.type === "figure" ? layer.rotation : undefined,
      origPoints:
        layer.type === "stroke"
          ? layer.points.map((p) => ({ ...p }))
          : undefined,
      origTextRotation:
        layer.type === "text" ? (layer.rotation ?? 0) : undefined,
    };
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    const newLayers = layersRef.current.filter((l) => l.id !== selectedId);
    pushHistoryRef.current(newLayers);
    setSelectedId(null);
  };

  const downloadImage = useCallback(() => {
    if (!image) {
      toast.error("No image loaded.");
      return;
    }
    const ow = image.naturalWidth;
    const oh = image.naturalHeight;
    const offscreen = document.createElement("canvas");
    offscreen.width = ow;
    offscreen.height = oh;
    const ctx = offscreen.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(image, 0, 0, ow, oh);
    renderLayers(ctx, layersRef.current, ow, oh, null);
    offscreen.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const name = imageFile?.name.replace(/\.[^.]+$/, "") ?? "edited";
      a.download = `${name}-edited.png`;
      a.href = url;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Image downloaded!");
      if (actor) {
        actor
          .incrementDownloadCount()
          .then((n) => setEditCount(Number(n)))
          .catch(() => {});
      }
    }, "image/png");
  }, [image, imageFile, actor]);

  // Selection bounds for stroke/figure layers
  const selBounds = useMemo(() => {
    if (!selectedId || selectedTextLayer || isDrawing || isFiguring)
      return null;
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const layer = layers.find((l) => l.id === selectedId);
    if (!layer) return null;
    return getLayerBounds(layer, canvasSize.w, canvasSize.h, ctx);
  }, [
    selectedId,
    selectedTextLayer,
    isDrawing,
    isFiguring,
    layers,
    canvasSize,
  ]);

  const textAreaWidth = useMemo(() => {
    if (!selectedTextLayer) return 80;
    const canvas = canvasRef.current;
    if (!canvas) return 80;
    const ctx = canvas.getContext("2d");
    if (!ctx) return 80;
    ctx.font = `${selectedTextLayer.fontSize}px '${selectedTextLayer.fontFamily}', sans-serif`;
    const lines = selectedTextLayer.content.split("\n");
    return Math.max(
      80,
      Math.max(...lines.map((l) => ctx.measureText(l).width)) + 20,
    );
  }, [selectedTextLayer]);

  // Bounds for text layer handle placement
  const textHandleBounds = useMemo(() => {
    if (!selectedTextLayer) return null;
    const lines = selectedTextLayer.content.split("\n");
    const textH = Math.max(
      lines.length * selectedTextLayer.fontSize * 1.2,
      selectedTextLayer.fontSize * 1.2,
    );
    return {
      x: selectedTextLayer.x * canvasSize.w - TEXT_PAD,
      y: selectedTextLayer.y * canvasSize.h - TEXT_PAD,
      w: textAreaWidth + TEXT_PAD * 2,
      h: textH + TEXT_PAD * 2,
    };
  }, [selectedTextLayer, textAreaWidth, canvasSize]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const handleColorChange = (val: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(val)) return;
    applyColor(val);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex flex-col h-full w-full bg-background">
        {/* Header */}
        <header
          className="relative flex items-center px-3 border-b border-border toolbar-glass z-20 h-14 flex-shrink-0"
          onMouseDown={(e) => {
            if (selectedTextLayer) {
              const target = e.target as HTMLElement;
              if (
                target.tagName !== "INPUT" &&
                target.tagName !== "SELECT" &&
                !target.closest("input") &&
                !target.closest("select")
              ) {
                e.preventDefault();
              }
            }
          }}
        >
          {/* Left zone: logo */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ImageIcon className="w-5 h-5 text-primary" />
            <span className="font-display font-semibold text-sm tracking-tight hidden sm:block">
              Simple Image Editor
            </span>
          </div>

          {/* Center zone: tool controls */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-2">
            {/* Tool buttons */}
            <div className="flex items-center gap-0.5 border border-border rounded-md p-0.5 flex-shrink-0">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-ocid="toolbar.draw_button"
                    variant="ghost"
                    size="sm"
                    className={`h-7 w-7 p-0 ${
                      tool === "draw" ? "tool-btn-active" : ""
                    }`}
                    onClick={() => setTool("draw")}
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Draw freehand</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-ocid="toolbar.text_button"
                    variant="ghost"
                    size="sm"
                    className={`h-7 w-7 p-0 ${
                      tool === "text" ? "tool-btn-active" : ""
                    }`}
                    onClick={() => setTool("text")}
                  >
                    <Type className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Text tool</TooltipContent>
              </Tooltip>
              {/* Figure tool button + picker */}
              <Popover>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <PopoverTrigger asChild>
                      <Button
                        data-ocid="toolbar.figure_button"
                        variant="ghost"
                        size="sm"
                        className={`h-7 w-7 p-0 ${
                          tool === "figure" ? "tool-btn-active" : ""
                        }`}
                        onClick={() => setTool("figure")}
                      >
                        <Shapes className="w-4 h-4" />
                      </Button>
                    </PopoverTrigger>
                  </TooltipTrigger>
                  <TooltipContent>Figure tool</TooltipContent>
                </Tooltip>
                <PopoverContent
                  className="w-48 p-3"
                  side="bottom"
                  align="center"
                  onMouseDown={(e) => {
                    if (selectedTextLayer) {
                      const target = e.target as HTMLElement;
                      if (
                        target.tagName !== "INPUT" &&
                        !target.closest("input")
                      ) {
                        e.preventDefault();
                      }
                    }
                  }}
                >
                  <div className="grid grid-cols-3 gap-1.5">
                    {FIGURE_SHAPES.map((s) => {
                      const isActive = s.id === selectedShape;
                      return (
                        <button
                          key={s.id}
                          type="button"
                          title={s.label}
                          className="w-12 h-12 rounded-md hover:bg-muted transition-colors flex items-center justify-center focus:outline-none"
                          style={{
                            outline: isActive
                              ? "2px solid hsl(var(--primary))"
                              : "none",
                            outlineOffset: isActive ? "2px" : undefined,
                          }}
                          onClick={() => {
                            setSelectedShape(s.id);
                            setTool("figure");
                          }}
                        >
                          <ShapeIcon shape={s.id} />
                        </button>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            {/* Color picker */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex-shrink-0">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-ocid="toolbar.color_input"
                        className="w-7 h-7 rounded-md border border-border cursor-pointer focus:outline-none focus:ring-1 focus:ring-ring"
                        style={{ backgroundColor: color }}
                        aria-label="Pick color"
                      />
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-48 p-3"
                      side="bottom"
                      align="center"
                      onMouseDown={(e) => {
                        if (selectedTextLayer) {
                          const target = e.target as HTMLElement;
                          if (
                            target.tagName !== "INPUT" &&
                            target.tagName !== "SELECT" &&
                            !target.closest("input") &&
                            !target.closest("select")
                          ) {
                            e.preventDefault();
                          }
                        }
                      }}
                    >
                      <div className="grid grid-cols-4 gap-1.5 mb-3">
                        {PRESET_COLORS.map((c) => {
                          const isActive =
                            c.toLowerCase() === color.toLowerCase();
                          return (
                            <button
                              key={c}
                              type="button"
                              className="w-8 h-8 rounded-md hover:scale-110 transition-transform focus:outline-none"
                              style={{
                                backgroundColor: c,
                                border: "none",
                                outline: isActive
                                  ? "2px solid hsl(var(--primary))"
                                  : "none",
                                outlineOffset: isActive ? "2px" : undefined,
                              }}
                              onClick={() => handleColorChange(c)}
                              aria-label={c}
                            />
                          );
                        })}
                      </div>
                      <input
                        type="text"
                        maxLength={7}
                        value={hexInput}
                        onChange={(e) => {
                          const val = e.target.value;
                          setHexInput(val);
                          if (/^#[0-9a-fA-F]{6}$/.test(val)) applyColor(val);
                        }}
                        className="w-full h-7 text-xs text-center rounded-md border border-border bg-input text-foreground px-2 focus:outline-none focus:ring-1 focus:ring-ring font-mono"
                        placeholder="#rrggbb"
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              </TooltipTrigger>
              <TooltipContent>Color</TooltipContent>
            </Tooltip>

            {/* Font options */}
            {(tool === "text" || selectedTextLayer) && (
              <>
                <Select
                  value={fontFamily}
                  onValueChange={(v) => {
                    setFontFamily(v);
                    if (selectedId) {
                      setLayers((prev) =>
                        prev.map((l) =>
                          l.id === selectedId && l.type === "text"
                            ? { ...l, fontFamily: v }
                            : l,
                        ),
                      );
                    }
                  }}
                >
                  <SelectTrigger
                    data-ocid="toolbar.font_select"
                    className="h-7 w-32 text-xs flex-shrink-0"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_OPTIONS.map((f) => (
                      <SelectItem key={f} value={f} style={{ fontFamily: f }}>
                        {f}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <input
                      data-ocid="toolbar.font_size_input"
                      type="number"
                      min={6}
                      max={200}
                      value={fontSize}
                      onChange={(e) => {
                        const v = Math.max(
                          6,
                          Number.parseInt(e.target.value) || 6,
                        );
                        setFontSize(v);
                        if (selectedId) {
                          setLayers((prev) =>
                            prev.map((l) =>
                              l.id === selectedId && l.type === "text"
                                ? { ...l, fontSize: v }
                                : l,
                            ),
                          );
                        }
                      }}
                      className="h-7 w-14 text-xs text-center rounded-md border border-border bg-input text-foreground px-1 focus:outline-none focus:ring-1 focus:ring-ring flex-shrink-0"
                    />
                  </TooltipTrigger>
                  <TooltipContent>Font size</TooltipContent>
                </Tooltip>
              </>
            )}

            {/* Thickness slider */}
            {(tool === "draw" ||
              tool === "figure" ||
              selectedLayer?.type === "stroke" ||
              selectedLayer?.type === "figure") && (
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-xs text-muted-foreground">Size</span>
                <Slider
                  data-ocid="toolbar.thickness_input"
                  min={1}
                  max={30}
                  step={1}
                  value={[thickness]}
                  onValueChange={([v]) => {
                    setThickness(v);
                    if (selectedId && selectedLayer?.type === "stroke") {
                      setLayers((prev) =>
                        prev.map((l) =>
                          l.id === selectedId && l.type === "stroke"
                            ? { ...l, thickness: v }
                            : l,
                        ),
                      );
                    }
                  }}
                  className="w-20"
                />
                <span className="text-xs text-muted-foreground w-4">
                  {thickness}
                </span>
              </div>
            )}
          </div>

          {/* Right zone: trash + undo/redo + upload/download */}
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            {selectedId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    data-ocid="toolbar.delete_button"
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={deleteSelected}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete selected (Del)</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-ocid="toolbar.undo_button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={undo}
                  disabled={!canUndo}
                >
                  <Undo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Undo (Ctrl+Z)</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-ocid="toolbar.redo_button"
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={redo}
                  disabled={!canRedo}
                >
                  <Redo2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Redo (Ctrl+Shift+Z)</TooltipContent>
            </Tooltip>

            <div className="w-px h-5 bg-border mx-1" />

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-ocid="editor.upload_button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-3.5 h-3.5" />
                  Upload
                </Button>
              </TooltipTrigger>
              <TooltipContent>Upload PNG or JPG</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  data-ocid="toolbar.download_button"
                  variant="default"
                  size="sm"
                  className="h-7 text-xs gap-1 bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={downloadImage}
                  disabled={!image}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download
                </Button>
              </TooltipTrigger>
              <TooltipContent>Download edited image</TooltipContent>
            </Tooltip>
          </div>
        </header>

        {/* Canvas workspace */}
        <main
          ref={containerRef}
          className="flex-1 canvas-workspace flex items-center justify-center overflow-hidden relative"
          onDrop={(e) => {
            e.preventDefault();
            setDropHighlight(false);
            const f = e.dataTransfer.files[0];
            if (f) loadImageFile(f);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDropHighlight(true);
          }}
          onDragLeave={() => setDropHighlight(false)}
          data-ocid="editor.dropzone"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) loadImageFile(file);
              e.target.value = "";
            }}
          />

          {!image ? (
            <button
              type="button"
              className={`flex flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed transition-colors duration-200 p-16 cursor-pointer select-none bg-transparent ${
                dropHighlight
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground"
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <ImageIcon className="w-8 h-8 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-display font-semibold text-foreground">
                  Drop an image here
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  or click to browse · PNG or JPG
                </p>
              </div>
            </button>
          ) : (
            <div className="relative shadow-tool rounded-sm">
              <canvas
                ref={canvasRef}
                data-ocid="editor.canvas_target"
                width={canvasSize.w}
                height={canvasSize.h}
                className="block rounded-sm"
                style={{
                  cursor:
                    tool === "text"
                      ? "text"
                      : tool === "figure"
                        ? "crosshair"
                        : "crosshair",
                  touchAction: "none",
                  userSelect: "none",
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
              />

              {/* Stroke/Figure selection overlay */}
              {selBounds && selectedId && (
                <>
                  {/* Drag handle */}
                  <div
                    data-ocid="editor.drag_handle"
                    className="absolute z-20 bg-primary rounded-t-sm select-none overflow-hidden"
                    style={{
                      left: selBounds.x,
                      top: selBounds.y - DRAG_HANDLE_HEIGHT,
                      width: Math.max(selBounds.w, 20),
                      height: DRAG_HANDLE_HEIGHT,
                      cursor: isDraggingHandle ? "grabbing" : "grab",
                      pointerEvents: "all",
                    }}
                    onMouseDown={(e) => startHandleDrag(e, selectedId)}
                  >
                    <DragHandleDots />
                  </div>
                  {/* Selection border */}
                  <div
                    className="absolute z-10 pointer-events-none"
                    style={{
                      left: selBounds.x,
                      top: selBounds.y,
                      width: Math.max(selBounds.w, 20),
                      height: Math.max(selBounds.h, 10),
                      border: "1.5px dashed rgba(255,255,255,0.85)",
                      outline: "1.5px dashed rgba(0,0,0,0.75)",
                      outlineOffset: "2px",
                    }}
                  />
                  {/* Rotate handle — upper-left */}
                  <CornerHandle
                    title="Rotate"
                    cursor="crosshair"
                    style={{
                      left: selBounds.x - 7,
                      top: selBounds.y - 7,
                    }}
                    onMouseDown={(e) =>
                      startRotateDrag(e, selectedId, selBounds)
                    }
                  />
                  {/* Resize handle — upper-right */}
                  <CornerHandle
                    title="Resize"
                    cursor="nwse-resize"
                    style={{
                      left: selBounds.x + Math.max(selBounds.w, 20) - 7,
                      top: selBounds.y - 7,
                    }}
                    onMouseDown={(e) => startResizeDrag(e, selectedId)}
                  />
                </>
              )}

              {/* Text layer overlay */}
              {selectedTextLayer && (
                <>
                  {/* Drag handle */}
                  <div
                    data-ocid="editor.drag_handle"
                    className="absolute z-20 bg-primary rounded-t-sm select-none overflow-hidden"
                    style={{
                      left: selectedTextLayer.x * canvasSize.w,
                      top:
                        selectedTextLayer.y * canvasSize.h - DRAG_HANDLE_HEIGHT,
                      width: textAreaWidth,
                      height: DRAG_HANDLE_HEIGHT,
                      cursor: isDraggingHandle ? "grabbing" : "grab",
                      pointerEvents: "all",
                    }}
                    onMouseDown={(e) =>
                      startHandleDrag(e, selectedTextLayer.id)
                    }
                  >
                    <DragHandleDots />
                  </div>
                  {/* Textarea */}
                  <textarea
                    ref={textareaRef}
                    value={selectedTextLayer.content}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLayers((prev) =>
                        prev.map((l) =>
                          l.id === selectedTextLayer.id && l.type === "text"
                            ? { ...l, content: val }
                            : l,
                        ),
                      );
                      const ta = e.target;
                      ta.style.height = "auto";
                      ta.style.height = `${ta.scrollHeight}px`;
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") {
                        e.preventDefault();
                        commitSelectedText();
                        setSelectedId(null);
                      } else if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        commitSelectedText();
                        setSelectedId(null);
                      }
                    }}
                    className="absolute z-10 bg-transparent outline-none resize-none overflow-hidden min-h-[1em] p-0 m-0"
                    style={{
                      left: selectedTextLayer.x * canvasSize.w,
                      top: selectedTextLayer.y * canvasSize.h,
                      width: textAreaWidth,
                      fontSize: `${selectedTextLayer.fontSize}px`,
                      fontFamily: `'${selectedTextLayer.fontFamily}', sans-serif`,
                      lineHeight: 1.2,
                      color: selectedTextLayer.color,
                      caretColor: selectedTextLayer.color,
                      border: "1.5px dashed rgba(255,255,255,0.85)",
                      outline: "1.5px dashed rgba(0,0,0,0.75)",
                      outlineOffset: "2px",
                      transform: selectedTextLayer.rotation
                        ? `rotate(${selectedTextLayer.rotation}rad)`
                        : undefined,
                      transformOrigin: "top left",
                    }}
                    rows={1}
                    spellCheck={false}
                  />
                  {/* Rotate handle — upper-left of text */}
                  {textHandleBounds && (
                    <CornerHandle
                      title="Rotate"
                      cursor="crosshair"
                      style={{
                        left: textHandleBounds.x - 7,
                        top: textHandleBounds.y - 7,
                      }}
                      onMouseDown={(e) =>
                        startRotateDrag(
                          e,
                          selectedTextLayer.id,
                          textHandleBounds,
                        )
                      }
                    />
                  )}
                  {/* Resize handle — upper-right of text */}
                  {textHandleBounds && (
                    <CornerHandle
                      title="Resize"
                      cursor="nwse-resize"
                      style={{
                        left: textHandleBounds.x + textHandleBounds.w - 7,
                        top: textHandleBounds.y - 7,
                      }}
                      onMouseDown={(e) =>
                        startResizeDrag(e, selectedTextLayer.id)
                      }
                    />
                  )}
                </>
              )}

              {dropHighlight && (
                <div className="absolute inset-0 rounded-sm border-2 border-primary bg-primary/10 flex items-center justify-center pointer-events-none">
                  <p className="font-display font-semibold text-primary">
                    Replace image
                  </p>
                </div>
              )}
            </div>
          )}
        </main>

        {/* Footer */}
        <footer className="flex items-center justify-between px-4 py-1.5 border-t border-border text-xs text-muted-foreground toolbar-glass">
          <span>
            {image
              ? `${image.naturalWidth} × ${image.naturalHeight}px · ${layers.length} layer${
                  layers.length !== 1 ? "s" : ""
                }`
              : "No image loaded"}
          </span>
          <span>
            {editCount} images edited | © {new Date().getFullYear()}. Built with
            love using{" "}
            <a
              href={`https://caffeine.ai?utm_source=caffeine-footer&utm_medium=referral&utm_content=${encodeURIComponent(window.location.hostname)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground transition-colors"
            >
              caffeine.ai
            </a>
          </span>
        </footer>
      </div>
    </TooltipProvider>
  );
}
