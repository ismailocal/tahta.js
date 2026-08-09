export interface PerformanceMetrics {
  fps: number;
  frameTime: number;
  avgFrameTime: number;
  totalShapes: number;
  renderedShapes: number;
}

export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  
  private frameCount = 0;
  private lastFpsUpdate = performance.now();
  private currentFps = 0;
  
  private frameTimes: number[] = [];
  private maxHistory = 60;
  
  private metrics: PerformanceMetrics = {
    fps: 0,
    frameTime: 0,
    avgFrameTime: 0,
    totalShapes: 0,
    renderedShapes: 0
  };

  private startTime = 0;

  public static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  public beginFrame(): void {
    this.startTime = performance.now();
  }

  public endFrame(totalShapes: number, renderedShapes: number): void {
    const endTime = performance.now();
    const duration = endTime - this.startTime;
    
    this.frameCount++;
    this.frameTimes.push(duration);
    if (this.frameTimes.length > this.maxHistory) {
      this.frameTimes.shift();
    }

    const now = performance.now();
    const elapsed = now - this.lastFpsUpdate;
    
    if (elapsed >= 1000) {
      this.currentFps = Math.round((this.frameCount * 1000) / elapsed);
      this.frameCount = 0;
      this.lastFpsUpdate = now;
    }

    const avg = this.frameTimes.reduce((a, b) => a + b, 0) / this.frameTimes.length;

    this.metrics = {
      fps: this.currentFps,
      frameTime: duration,
      avgFrameTime: avg,
      totalShapes,
      renderedShapes
    };
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }
}
