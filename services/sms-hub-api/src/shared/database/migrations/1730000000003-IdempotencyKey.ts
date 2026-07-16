import { MigrationInterface, QueryRunner } from 'typeorm';

export class IdempotencyKey1730000000003 implements MigrationInterface {
  name = 'IdempotencyKey1730000000003';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE command_dispatches
        ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(128);

      CREATE UNIQUE INDEX IF NOT EXISTS idx_command_dispatches_idempotency
        ON command_dispatches(idempotency_key)
        WHERE idempotency_key IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_command_dispatches_idempotency');
    await queryRunner.query('ALTER TABLE command_dispatches DROP COLUMN IF EXISTS idempotency_key');
  }
}
