import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { GatewayStatus, GatewayType } from '../domain/gateway.enums';

@Entity('sms_gateways')
export class SmsGatewayEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 255 })
  name!: string;

  @Column({ type: 'enum', enum: GatewayType, enumName: 'gateway_type' })
  type!: GatewayType;

  @Column({ type: 'int', default: 1 })
  priority!: number;

  @Column({ type: 'boolean', default: true })
  active!: boolean;

  @Column({ type: 'enum', enum: GatewayStatus, enumName: 'gateway_status', default: GatewayStatus.ONLINE })
  status!: GatewayStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
