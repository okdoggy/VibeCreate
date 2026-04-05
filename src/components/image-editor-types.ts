export type Tool = "pointer" | "lasso";

export type Point = {
  x: number;
  y: number;
};

export type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

export type LassoSelection = {
  layerId: string;
  points: Point[];
  closed: boolean;
  bounds: Bounds;
};

export type LassoDraft = {
  layerId: string;
  pointerId: number;
  points: Point[];
};

export type ImageLayer = {
  id: string;
  name: string;
  src: string;
  width: number;
  height: number;
  visible: boolean;
  x: number;
  y: number;
  opacity: number;
};

export type ResizeHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";

export type DragState = {
  layerId: string;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  lastClientX: number;
  lastClientY: number;
  lastTimestamp: number;
  velocityX: number;
  velocityY: number;
};

export type ResizeState = {
  layerId: string;
  pointerId: number;
  handle: ResizeHandle;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  lastClientX: number;
  lastClientY: number;
  lastTimestamp: number;
  velocityX: number;
  velocityY: number;
};

export type ActiveInteraction =
  | {
      layerId: string;
      mode: "drag";
    }
  | {
      handle: ResizeHandle;
      layerId: string;
      mode: "resize";
    };

export type DocumentSnapshot = {
  layers: ImageLayer[];
  selectedLayerId: string | null;
};

export type HistoryState = {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
};
