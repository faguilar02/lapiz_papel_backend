import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Sale } from './sale.entity';

export enum ReceiptStatus {
  ACTIVE = 'active',
  CANCELLED = 'cancelled',
}

@Entity('sales_receipts')
export class SaleReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  sale_id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  receipt_number: string; // E.g., NV-001-0001234

  @Column({ type: 'varchar', length: 20 })
  series: string; // E.g., NV-001 (Nota de Venta)

  @Column({ type: 'integer' })
  sequence_number: number; // E.g., 1234

  @Column({
    type: 'enum',
    enum: ReceiptStatus,
    default: ReceiptStatus.ACTIVE,
  })
  status: ReceiptStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_name: string; // Nombre del cliente

  @Column({ type: 'varchar', length: 20, nullable: true })
  customer_phone: string; // Teléfono del cliente

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string; // Notas adicionales

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => Sale, (sale) => sale.receipts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;
}
