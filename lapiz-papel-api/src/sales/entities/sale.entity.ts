import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { Customer } from '../../customers/entities/customer.entity';
import { User } from '../../auth/entities/user.entity';
import { SaleItem } from './sale-item.entity';
import { SalesReceipt } from './sales-receipt.entity';
import { PaymentMethod } from '../../auth/models/enums';

export enum ReceiptType {
  NOTA = 'nota',
  BOLETA = 'boleta',
  FACTURA = 'factura',
}

@Entity('sales')
export class Sale {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  customer_id: string;

  @Column({ type: 'numeric' })
  subtotal: number;

  @Column({ type: 'numeric', default: 0 })
  discount_amount: number;

  @Column({ type: 'boolean', default: false })
  includes_igv: boolean;

  @Column({ type: 'numeric', default: 0 })
  igv_rate: number; // 0.18 for 18%

  @Column({ type: 'numeric', default: 0 })
  igv_amount: number;

  @Column({ type: 'numeric' })
  total_amount: number;

  @Column({
    type: 'enum',
    enum: PaymentMethod,
    default: PaymentMethod.CASH,
  })
  payment_method: PaymentMethod;

  @Column({
    type: 'enum',
    enum: ReceiptType,
    default: ReceiptType.BOLETA,
  })
  receipt_type: ReceiptType;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'uuid', nullable: true })
  created_by: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  is_active: boolean;

  // Relations
  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customer: Customer;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'created_by' })
  creator: User;

  @OneToMany(() => SaleItem, (saleItem) => saleItem.sale)
  items: SaleItem[];

  @OneToMany(() => SalesReceipt, (receipt) => receipt.sale)
  receipts: SalesReceipt[];
}
