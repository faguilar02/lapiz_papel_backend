import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';
import { Product } from '../../products/entities/product.entity';

@Entity('sale_items')
export class SaleItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  sale_id: string;

  @Column({ type: 'uuid', nullable: false })
  product_id: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  unit_price: number;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  total_price: number;

  // === CAMPOS SUNAT ===
  @Column({ type: 'varchar', length: 50, nullable: true })
  product_code: string; // Código del producto para SUNAT

  @Column({ type: 'text', nullable: true })
  description: string; // Descripción del producto

  @Column({ type: 'varchar', length: 10, default: 'NIU' })
  unit_code: string; // Código de unidad de medida SUNAT (NIU, ZZ, etc.)

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  unit_value: number; // Valor unitario sin IGV

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  sale_value: number; // Valor de venta (quantity * unit_value)

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  igv_base_amount: number; // Base imponible IGV

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 18.0 })
  igv_rate: number; // Tasa de IGV

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  igv_amount: number; // Monto IGV

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  total_taxes: number; // Total impuestos

  @Column({ type: 'numeric', precision: 12, scale: 2, nullable: true })
  total_amount: number; // Precio unitario con IGV (unit_price en la práctica)

  @Column({ type: 'varchar', length: 10, default: '10' })
  tax_affectation_type: string; // 10=Gravado, 20=Exonerado, 30=Inafecto

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  // Relations
  @ManyToOne(() => Sale, { nullable: false })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;

  @ManyToOne(() => Product, { nullable: false })
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
