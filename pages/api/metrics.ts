import { NextApiRequest, NextApiResponse } from 'next';
import { register } from 'prom-client';
import { MonitoringService } from '@/services/monitoring';

// Initialize monitoring service
const monitoring = MonitoringService.getInstance();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  try {
    // Get all metrics
    const metrics = await register.metrics();
    
    // Set Prometheus format header
    res.setHeader('Content-Type', register.contentType);
    res.status(200).send(metrics);
  } catch (error) {
    console.error('[Metrics] Error collecting metrics:', error);
    res.status(500).json({ error: 'Error collecting metrics' });
  }
} 