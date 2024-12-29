import { Histogram, Counter, Gauge } from 'prom-client';

/**
 * Metrics for video processing pipeline
 */
interface VideoProcessingMetrics {
  processingTime: Histogram;
  queueLength: Gauge;
  processingErrors: Counter;
  processingStatus: Gauge;
  videoSize: Histogram;
}

/**
 * Metrics for API dependencies
 */
interface APIMetrics {
  geminiLatency: Histogram;
  openaiLatency: Histogram;
  pineconeLatency: Histogram;
  apiErrors: Counter;
  rateLimitHits: Counter;
}

/**
 * Metrics for system resources
 */
interface SystemMetrics {
  memoryUsage: Gauge;
  cpuUsage: Gauge;
  diskUsage: Gauge;
  activeWorkers: Gauge;
}

/**
 * Service for collecting and exposing metrics
 */
export class MonitoringService {
  private static instance: MonitoringService;
  private videoMetrics: VideoProcessingMetrics;
  private apiMetrics: APIMetrics;
  private systemMetrics: SystemMetrics;

  private constructor() {
    // Initialize Video Processing Metrics
    this.videoMetrics = {
      processingTime: new Histogram({
        name: 'video_processing_duration_seconds',
        help: 'Time taken to process videos',
        labelNames: ['status', 'stage'],
        buckets: [1, 5, 10, 30, 60, 120, 300]
      }),
      queueLength: new Gauge({
        name: 'video_queue_length',
        help: 'Number of videos waiting to be processed',
        labelNames: ['priority']
      }),
      processingErrors: new Counter({
        name: 'video_processing_errors_total',
        help: 'Total number of video processing errors',
        labelNames: ['error_type', 'stage']
      }),
      processingStatus: new Gauge({
        name: 'video_processing_status',
        help: 'Current status of video processing',
        labelNames: ['status']
      }),
      videoSize: new Histogram({
        name: 'video_size_bytes',
        help: 'Size of processed videos in bytes',
        buckets: [1e6, 5e6, 1e7, 5e7, 1e8] // 1MB to 100MB
      })
    };

    // Initialize API Metrics
    this.apiMetrics = {
      geminiLatency: new Histogram({
        name: 'gemini_api_latency_seconds',
        help: 'Gemini API request latency',
        labelNames: ['operation'],
        buckets: [0.1, 0.5, 1, 2, 5]
      }),
      openaiLatency: new Histogram({
        name: 'openai_api_latency_seconds',
        help: 'OpenAI API request latency',
        labelNames: ['operation'],
        buckets: [0.1, 0.5, 1, 2, 5]
      }),
      pineconeLatency: new Histogram({
        name: 'pinecone_api_latency_seconds',
        help: 'Pinecone API request latency',
        labelNames: ['operation'],
        buckets: [0.1, 0.5, 1, 2, 5]
      }),
      apiErrors: new Counter({
        name: 'api_errors_total',
        help: 'Total number of API errors',
        labelNames: ['api', 'error_type']
      }),
      rateLimitHits: new Counter({
        name: 'rate_limit_hits_total',
        help: 'Number of rate limit hits',
        labelNames: ['api']
      })
    };

    // Initialize System Metrics
    this.systemMetrics = {
      memoryUsage: new Gauge({
        name: 'system_memory_usage_bytes',
        help: 'System memory usage in bytes',
        labelNames: ['type']
      }),
      cpuUsage: new Gauge({
        name: 'system_cpu_usage_percent',
        help: 'System CPU usage percentage',
        labelNames: ['core']
      }),
      diskUsage: new Gauge({
        name: 'system_disk_usage_bytes',
        help: 'System disk usage in bytes',
        labelNames: ['mount']
      }),
      activeWorkers: new Gauge({
        name: 'system_active_workers',
        help: 'Number of active worker processes',
        labelNames: ['type']
      })
    };
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  /**
   * Record video processing metrics
   */
  public recordVideoProcessing(options: {
    duration: number;
    status: string;
    stage: string;
    size?: number;
  }): void {
    const { duration, status, stage, size } = options;
    
    this.videoMetrics.processingTime.labels(status, stage).observe(duration);
    this.videoMetrics.processingStatus.labels(status).inc();
    
    if (size) {
      this.videoMetrics.videoSize.observe(size);
    }
    
    console.log('[Monitoring] Recorded video processing metrics:', {
      duration,
      status,
      stage,
      size
    });
  }

  /**
   * Record API latency
   */
  public recordAPILatency(options: {
    api: 'gemini' | 'openai' | 'pinecone';
    operation: string;
    duration: number;
  }): void {
    const { api, operation, duration } = options;
    
    switch (api) {
      case 'gemini':
        this.apiMetrics.geminiLatency.labels(operation).observe(duration);
        break;
      case 'openai':
        this.apiMetrics.openaiLatency.labels(operation).observe(duration);
        break;
      case 'pinecone':
        this.apiMetrics.pineconeLatency.labels(operation).observe(duration);
        break;
    }
    
    console.log('[Monitoring] Recorded API latency:', {
      api,
      operation,
      duration
    });
  }

  /**
   * Record API error
   */
  public recordAPIError(options: {
    api: string;
    errorType: string;
    isRateLimit?: boolean;
  }): void {
    const { api, errorType, isRateLimit } = options;
    
    this.apiMetrics.apiErrors.labels(api, errorType).inc();
    
    if (isRateLimit) {
      this.apiMetrics.rateLimitHits.labels(api).inc();
    }
    
    console.log('[Monitoring] Recorded API error:', {
      api,
      errorType,
      isRateLimit
    });
  }

  /**
   * Update queue length
   */
  public updateQueueLength(length: number, priority: string = 'default'): void {
    this.videoMetrics.queueLength.labels(priority).set(length);
    console.log('[Monitoring] Updated queue length:', { length, priority });
  }

  /**
   * Update system metrics
   */
  public updateSystemMetrics(options: {
    memory?: { [key: string]: number };
    cpu?: { [key: string]: number };
    disk?: { [key: string]: number };
    workers?: { [key: string]: number };
  }): void {
    const { memory, cpu, disk, workers } = options;
    
    if (memory) {
      Object.entries(memory).forEach(([type, value]) => {
        this.systemMetrics.memoryUsage.labels(type).set(value);
      });
    }
    
    if (cpu) {
      Object.entries(cpu).forEach(([core, value]) => {
        this.systemMetrics.cpuUsage.labels(core).set(value);
      });
    }
    
    if (disk) {
      Object.entries(disk).forEach(([mount, value]) => {
        this.systemMetrics.diskUsage.labels(mount).set(value);
      });
    }
    
    if (workers) {
      Object.entries(workers).forEach(([type, value]) => {
        this.systemMetrics.activeWorkers.labels(type).set(value);
      });
    }
    
    console.log('[Monitoring] Updated system metrics:', options);
  }
} 