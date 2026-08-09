/**
 * Auto-layout algorithm for DSL shapes without explicit positions
 */

import type { DSLShape, Position, DSLConnector } from './types';

interface LayoutNode {
  id: string;
  width: number;
  height: number;
  dependencies: string[];
  level: number;
  position?: Position;
}

/**
 * Calculate auto-layout for shapes without explicit positions
 */
export function calculateLayout(shapes: DSLShape[], connectors: DSLConnector[]): Map<string, Position> {
  const positionMap = new Map<string, Position>();
  const nodes = buildLayoutGraph(shapes, connectors);
  
  // Assign levels using topological sort
  assignLevels(nodes, connectors);
  
  // Calculate positions based on levels
  calculatePositions(nodes, positionMap);
  
  return positionMap;
}

/**
 * Build dependency graph from shapes and connectors
 */
function buildLayoutGraph(shapes: DSLShape[], connectors: DSLConnector[]): Map<string, LayoutNode> {
  const nodes = new Map<string, LayoutNode>();
  
  // Initialize nodes
  for (const shape of shapes) {
    nodes.set(shape.id, {
      id: shape.id,
      width: getDefaultWidth(shape.type),
      height: getDefaultHeight(shape.type),
      dependencies: [],
      level: 0
    });
  }
  
  // Build dependencies from connectors
  for (const conn of connectors) {
    const fromNode = nodes.get(conn.from);
    const toNode = nodes.get(conn.to);
    
    if (fromNode && toNode && !fromNode.dependencies.includes(conn.to)) {
      fromNode.dependencies.push(conn.to);
    }
  }
  
  return nodes;
}

/**
 * Assign levels to nodes using topological sort
 */
function assignLevels(nodes: Map<string, LayoutNode>, connectors: DSLConnector[]): void {
  const visited = new Set<string>();
  const visiting = new Set<string>();
  
  function dfs(id: string, level: number): void {
    if (visiting.has(id)) {
      // Circular dependency detected
      console.warn(`Circular dependency detected involving node: ${id}`);
      return;
    }
    
    if (visited.has(id)) {
      return;
    }
    
    visiting.add(id);
    const node = nodes.get(id);
    if (!node) return;
    
    node.level = Math.max(node.level, level);
    
    for (const depId of node.dependencies) {
      dfs(depId, level + 1);
    }
    
    visiting.delete(id);
    visited.add(id);
  }
  
  // Start DFS from nodes with no incoming edges
  const hasIncoming = new Set<string>();
  for (const conn of connectors) {
    hasIncoming.add(conn.to);
  }
  
  for (const [id] of nodes) {
    if (!hasIncoming.has(id)) {
      dfs(id, 0);
    }
  }
  
  // Handle disconnected nodes
  for (const [id] of nodes) {
    if (!visited.has(id)) {
      dfs(id, 0);
    }
  }
}

/**
 * Calculate positions based on levels
 */
function calculatePositions(nodes: Map<string, LayoutNode>, positionMap: Map<string, Position>): void {
  const H_SPACING = 200;
  const V_SPACING = 120;
  
  // Group nodes by level
  const levelGroups = new Map<number, LayoutNode[]>();
  for (const node of nodes.values()) {
    if (!levelGroups.has(node.level)) {
      levelGroups.set(node.level, []);
    }
    levelGroups.get(node.level)!.push(node);
  }
  
  // Calculate positions for each level
  for (const [level, levelNodes] of levelGroups) {
    const totalWidth = levelNodes.reduce((sum, node) => sum + node.width + H_SPACING, 0) - H_SPACING;
    let currentX = -totalWidth / 2;
    
    for (const node of levelNodes) {
      const position: Position = {
        x: currentX + node.width / 2,
        y: level * V_SPACING
      };
      
      positionMap.set(node.id, position);
      currentX += node.width + H_SPACING;
    }
  }
}

/**
 * Get default width for shape type
 */
function getDefaultWidth(type: string): number {
  switch (type) {
    case 'diamond': return 120;
    case 'ellipse': return 140;
    case 'dbtable':
    case 'dbview': return 220;
    case 'dbenum': return 160;
    case 'image': return 200;
    default: return 160;
  }
}

/**
 * Get default height for shape type
 */
function getDefaultHeight(type: string): number {
  switch (type) {
    case 'diamond': return 80;
    case 'ellipse': return 60;
    case 'dbtable': return 100; // Will be calculated based on columns
    case 'dbview': return 60;
    case 'dbenum': return 52;
    case 'image': return 150;
    case 'text': return 30;
    default: return 52;
  }
}
