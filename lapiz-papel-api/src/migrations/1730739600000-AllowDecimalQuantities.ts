import { MigrationInterface, QueryRunner } from 'typeorm';

export class AllowDecimalQuantities1730739600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Cambiar quantity de integer a numeric en sale_items
    await queryRunner.query(`
      ALTER TABLE sale_items 
      ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::numeric(12,3)
    `);

    // Cambiar quantity de integer a numeric en purchase_items
    await queryRunner.query(`
      ALTER TABLE purchase_items 
      ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::numeric(12,3)
    `);

    // Cambiar quantity de integer a numeric en inventory_movements
    await queryRunner.query(`
      ALTER TABLE inventory_movements 
      ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::numeric(12,3)
    `);

    // Cambiar stock_quantity de integer a numeric en products
    await queryRunner.query(`
      ALTER TABLE products 
      ALTER COLUMN stock_quantity TYPE NUMERIC(12,3) USING stock_quantity::numeric(12,3)
    `);

    // Cambiar minimum_stock de integer a numeric en products
    await queryRunner.query(`
      ALTER TABLE products 
      ALTER COLUMN minimum_stock TYPE NUMERIC(12,3) USING minimum_stock::numeric(12,3)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Revertir los cambios (con ROUND para evitar pérdida de datos)
    await queryRunner.query(`
      ALTER TABLE sale_items 
      ALTER COLUMN quantity TYPE INTEGER USING ROUND(quantity)::integer
    `);

    await queryRunner.query(`
      ALTER TABLE purchase_items 
      ALTER COLUMN quantity TYPE INTEGER USING ROUND(quantity)::integer
    `);

    await queryRunner.query(`
      ALTER TABLE inventory_movements 
      ALTER COLUMN quantity TYPE INTEGER USING ROUND(quantity)::integer
    `);

    await queryRunner.query(`
      ALTER TABLE products 
      ALTER COLUMN stock_quantity TYPE INTEGER USING ROUND(stock_quantity)::integer
    `);

    await queryRunner.query(`
      ALTER TABLE products 
      ALTER COLUMN minimum_stock TYPE INTEGER USING ROUND(minimum_stock)::integer
    `);
  }
}
