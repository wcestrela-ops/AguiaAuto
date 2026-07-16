import { MigrationInterface, QueryRunner } from 'typeorm';

export class CompanyIdDispatches1730000000004 implements MigrationInterface {
  name = 'CompanyIdDispatches1730000000004';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE command_dispatches
        ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES companies(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_command_dispatches_company ON command_dispatches(company_id);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS idx_command_dispatches_company');
    await queryRunner.query('ALTER TABLE command_dispatches DROP COLUMN IF EXISTS company_id');
  }
}
