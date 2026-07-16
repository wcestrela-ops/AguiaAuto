import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { DispatchStatus } from '../../gateways/domain/gateway.enums';

@Entity('command_dispatches')
export class CommandDispatchEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  phone!: string;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  action!: string | null;

  @Column({ name: 'vehicle_id', type: 'varchar', length: 50, nullable: true })
  vehicleId!: string | null;

  @Column({ name: 'user_id', type: 'varchar', length: 50, nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 50, default: 'aguia' })
  source!: string;

  @Column({ name: 'gateway_id', type: 'uuid', nullable: true })
  gatewayId!: string | null;

  @Column({ type: 'enum', enum: DispatchStatus, enumName: 'dispatch_status', default: DispatchStatus.QUEUED })
  status!: DispatchStatus;

  @Column({ name: 'external_id', type: 'varchar', length: 100, nullable: true })
  externalId!: string | null;

  @Column({ name: 'error_message', type: 'text', nullable: true })
  errorMessage!: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
