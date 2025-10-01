import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddLogoToCompanySettings1727728800000
  implements MigrationInterface
{
  name = 'AddLogoToCompanySettings1727728800000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_settings" ADD "logo_base64" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "company_settings" DROP COLUMN "logo_base64"`,
    );
  }
}
