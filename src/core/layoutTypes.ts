export type LayoutDirection = 'LR' | 'RL' | 'TB' | 'BT';
export type LayoutAlignment = 'automatic' | 'start' | 'center' | 'end';
export interface LayoutNodeInput { id: string; parentId: string; x: number; y: number; width: number; height: number; locked: boolean }
export interface LayoutEdgeInput { id: string; source: string; target: string; connectorId: string }
export interface LayoutRequest { nodes: LayoutNodeInput[]; edges: LayoutEdgeInput[]; direction: LayoutDirection; alignment: LayoutAlignment; spacing: number }
export interface LayoutNodeResult { id: string; x: number; y: number }
export interface LayoutEdgeResult { connectorId: string; points: { x: number; y: number }[] }
export interface LayoutResult { nodes: LayoutNodeResult[]; edges: LayoutEdgeResult[] }
