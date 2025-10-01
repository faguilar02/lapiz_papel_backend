import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Product } from './product.entity';

@Entity('product_bulk_prices')
export class ProductBulkPrice {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  product_id: string;

  @Column({ type: 'integer' })
  min_quantity: number;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  sale_bundle_total: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  cost_bundle_total: string;

  @Column({ type: 'varchar', default: 'bundle_exact' })
  pricing_mode: string;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @ManyToOne(() => Product, (product) => product.bulk_prices)
  @JoinColumn({ name: 'product_id' })
  product: Product;
}
