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

@Entity('sales_receipts')
export class SalesReceipt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  sale_id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  receipt_number: string;

  @Column({ type: 'varchar', length: 20 })
  series: string;

  @Column({ type: 'int' })
  sequence_number: number;

  @Column({
    type: 'enum',
    enum: ['active', 'cancelled', 'pending'],
    default: 'active',
  })
  status: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  customer_name: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  customer_phone: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  notes: string;

  // === CAMPOS SUNAT ===
  @Column({ type: 'varchar', length: 10, default: '2.1' })
  ubl_version: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  document_type: string; // 01=Factura, 03=Boleta, 07=Nota Crédito, 08=Nota Débito

  @Column({ type: 'varchar', length: 10, default: '0101' })
  operation_type: string; // 0101=Venta Interna

  @Column({
    type: 'timestamp with time zone',
    default: () => 'CURRENT_TIMESTAMP',
  })
  issue_date: Date;

  @Column({ type: 'varchar', length: 10, default: 'PEN' })
  currency: string;

  // Datos del cliente para SUNAT
  @Column({ type: 'varchar', length: 2, nullable: true })
  client_doc_type: string; // 1=DNI, 6=RUC

  @Column({ type: 'varchar', length: 20, nullable: true })
  client_doc_number: string;

  @Column({ type: 'text', nullable: true })
  client_address: string;

  // Campos de procesamiento SUNAT
  @Column({ type: 'text', nullable: true })
  xml_content: string;

  @Column({ type: 'text', nullable: true })
  signed_xml: string;

  @Column({ type: 'text', nullable: true })
  hash: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sunat_ticket: string;

  @Column({ type: 'text', nullable: true })
  sunat_response: string;

  @Column({ type: 'text', nullable: true })
  cdr_content: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  sunat_status_code: string;

  @Column({ type: 'text', nullable: true })
  sunat_status_message: string;

  @Column({ type: 'timestamp with time zone', nullable: true })
  sent_to_sunat_at: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  accepted_by_sunat_at: Date;

  @CreateDateColumn({ type: 'timestamp without time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp without time zone' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Sale, { nullable: false })
  @JoinColumn({ name: 'sale_id' })
  sale: Sale;
}
