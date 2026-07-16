import { MigrationInterface, QueryRunner } from 'typeorm';

export class DispatchesGateways1730000000002 implements MigrationInterface {
  name = 'DispatchesGateways1730000000002';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE gateway_type AS ENUM ('FAKE', 'ANDROID', 'SMSMARKET');
      CREATE TYPE gateway_status AS ENUM ('ONLINE', 'OFFLINE', 'DEGRADED');
      CREATE TYPE dispatch_status AS ENUM (
        'QUEUED', 'PROCESSING', 'ACCEPTED_BY_GATEWAY', 'SENT', 'FAILED', 'UNKNOWN'
      );
    `);

    await queryRunner.query(`
      CREATE TABLE sms_gateways (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        type gateway_type NOT NULL,
        priority INT NOT NULL DEFAULT 1,
        active BOOLEAN NOT NULL DEFAULT true,
        status gateway_status NOT NULL DEFAULT 'ONLINE',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    await queryRunner.query(`
      CREATE TABLE command_dispatches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        phone VARCHAR(30) NOT NULL,
        message TEXT NOT NULL,
        action VARCHAR(50),
        vehicle_id VARCHAR(50),
        user_id VARCHAR(50),
        source VARCHAR(50) NOT NULL DEFAULT 'aguia',
        gateway_id UUID REFERENCES sms_gateways(id) ON DELETE SET NULL,
        status dispatch_status NOT NULL DEFAULT 'QUEUED',
        external_id VARCHAR(100),
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX idx_command_dispatches_vehicle ON command_dispatches(vehicle_id);
      CREATE INDEX idx_command_dispatches_phone ON command_dispatches(phone);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS command_dispatches');
    await queryRunner.query('DROP TABLE IF EXISTS sms_gateways');
    await queryRunner.query('DROP TYPE IF EXISTS dispatch_status');
    await queryRunner.query('DROP TYPE IF EXISTS gateway_status');
    await queryRunner.query('DROP TYPE IF EXISTS gateway_type');
  }
}
