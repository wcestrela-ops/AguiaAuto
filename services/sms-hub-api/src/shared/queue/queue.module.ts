import { Module } from '@nestjs/common';
import { DispatchModule } from '../../modules/dispatches/dispatch.module';
import { DispatchQueueService } from './dispatch-queue.service';

@Module({
  imports: [DispatchModule],
  providers: [DispatchQueueService],
  exports: [DispatchQueueService],
})
export class QueueModule {}
