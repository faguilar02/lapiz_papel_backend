import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Category } from '../../categories/entities/category.entity';
import { ProductImage } from './product-image.entity';
import { ProductBulkPrice } from './product-bulk-price.entity';

@Entity('products')
export class Product {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', unique: true })
  sku: string;

  @Column({ type: 'text', nullable: true })
  brand: string;

  @Column({ type: 'uuid', nullable: true })
  category_id: string;

  @Column({ type: 'text', default: 'unit' })
  unit: string;

  @Column({ type: 'numeric' })
  sale_price: number;

  @Column({ type: 'numeric', default: 0 })
  cost_price: number;

  @Column({ type: 'numeric', precision: 12, scale: 3, default: 0 })
  stock_quantity: number;

  @Column({ type: 'numeric', precision: 12, scale: 3, default: 0 })
  minimum_stock: number;

  @Column({ type: 'text', nullable: true })
  image_url: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  is_active: boolean;

  // Relations
  @ManyToOne(() => Category, { nullable: true })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @OneToMany(() => ProductImage, (image) => image.product)
  images: ProductImage[];

  @OneToMany(() => ProductBulkPrice, (bulkPrice) => bulkPrice.product)
  bulk_prices: ProductBulkPrice[];
}
