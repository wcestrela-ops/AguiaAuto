import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DispatchModule } from '../dispatches/dispatch.module';
import { DispatchService } from '../dispatches/application/dispatch.service';
import { QueueModule } from '../../shared/queue/queue.module';
import { DispatchQueueService } from '../../shared/queue/dispatch-queue.service';
import { InternalDispatchController } from './presentation/internal-dispatch.controller';
import { AguiaServiceGuard } from '../../shared/guards/aguia-service.guard';

@Module({
  imports: [DispatchModule, QueueModule],
  controllers: [InternalDispatchController],
  providers: [AguiaServiceGuard],
})
export class InternalModule implements OnModuleInit {
  constructor(
    private readonly dispatchService: DispatchService,
    private readonly queueService: DispatchQueueService,
  ) {}

  onModuleInit() {
    if (this.queueService.isReady()) {
      this.dispatchService.setQueueService(this.queueService);
    }
  }
}
