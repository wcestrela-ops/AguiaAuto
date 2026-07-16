import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { DispatchService } from '../../modules/dispatches/application/dispatch.service';

@Injectable()
export class DispatchQueueService implements OnModuleInit, OnModuleDestroy {
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private ready = false;

  constructor(private readonly dispatchService: DispatchService) {}

  isReady() {
    return this.ready;
  }

  onModuleInit() {
    if (process.env.SMS_HUB_QUEUE_ENABLED === 'false') {
      console.warn('SMS Hub queue disabled (SMS_HUB_QUEUE_ENABLED=false). Dispatch runs synchronously.');
      return;
    }

    try {
      const url = process.env.SMS_HUB_REDIS_URL || 'redis://localhost:6380';
      const connection = { url };

      this.queue = new Queue('sms-dispatch', { connection });
      this.worker = new Worker(
        'sms-dispatch',
        async (job) => {
          await this.dispatchService.processDispatch(String(job.data.dispatchId));
        },
        { connection, concurrency: 3 },
      );

      this.worker.on('failed', (job, err) => {
        console.error(`Dispatch job ${job?.id} failed:`, err.message);
      });

      this.ready = true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      console.warn(`Redis indisponível — dispatch síncrono: ${message}`);
      this.ready = false;
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.queue?.close();
  }

  async enqueue(dispatchId: string): Promise<boolean> {
    if (!this.ready || !this.queue) return false;

    await this.queue.add(
      'process-dispatch',
      { dispatchId },
      {
        jobId: dispatchId,
        removeOnComplete: 1000,
        removeOnFail: 5000,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    );
    return true;
  }
}
