export interface SourceLocation {
  line: number;
  column: number;
}

export type DslDirection = 'LR' | 'RL' | 'TB' | 'BT';

export interface CanvasAst {
  title?: string;
  direction: DslDirection;
  statements: DslStatement[];
}

export type DslStatement = DslNode | DslEdge;

export interface DslNode {
  kind: 'node';
  id: string;
  shape: string;
  label: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  cornerRadius?: number;
  textColor?: string;
  fontSize?: number;
  parentId?: string;
  location: SourceLocation;
}

export interface DslEdge {
  kind: 'edge';
  id: string;
  from: string;
  to: string;
  label: string;
  x?: number;
  y?: number;
  points?: { x: number; y: number }[];
  stroke?: string;
  strokeWidth?: number;
  strokeStyle?: 'solid' | 'dashed' | 'dotted';
  edgeStyle?: 'straight' | 'elbow' | 'curved';
  startArrowhead?: 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'bar';
  endArrowhead?: 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'bar';
  location: SourceLocation;
}

export class DslDiagnosticError extends Error {
  constructor(message: string, readonly line: number, readonly column: number) {
    super(`${message} (${line}:${column})`);
    this.name = 'DslDiagnosticError';
  }
}
