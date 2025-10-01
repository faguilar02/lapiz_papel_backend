import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('company_settings')
export class CompanySettings {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Datos fiscales de la empresa
  @Column({ type: 'varchar', length: 20, unique: true })
  ruc: string;

  @Column({ type: 'varchar', length: 255 })
  business_name: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  trade_name: string;

  @Column({ type: 'varchar', length: 10 })
  ubigeo: string;

  @Column({ type: 'varchar', length: 100 })
  department: string;

  @Column({ type: 'varchar', length: 100 })
  province: string;

  @Column({ type: 'varchar', length: 100 })
  district: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  urbanization: string;

  @Column({ type: 'varchar', length: 255 })
  address: string;

  // Series y correlativos
  @Column({ type: 'varchar', length: 10, default: 'F001' })
  invoice_series: string;

  @Column({ type: 'varchar', length: 10, default: 'B001' })
  ticket_series: string;

  @Column({ type: 'varchar', length: 10, default: 'BC01' })
  credit_note_series: string;

  @Column({ type: 'varchar', length: 10, default: 'BD01' })
  debit_note_series: string;

  @Column({ type: 'int', default: 1 })
  invoice_correlative: number;

  @Column({ type: 'int', default: 1 })
  ticket_correlative: number;

  @Column({ type: 'int', default: 1 })
  credit_note_correlative: number;

  @Column({ type: 'int', default: 1 })
  debit_note_correlative: number;

  // Configuración general
  @Column({ type: 'varchar', length: 10, default: 'PEN' })
  default_currency: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 18.0 })
  default_igv_rate: number;

  @Column({ type: 'text', nullable: true })
  logo_base64: string;

  @Column({ type: 'boolean', default: true })
  is_active: boolean;

  @CreateDateColumn({ type: 'timestamp without time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp without time zone' })
  updated_at: Date;
}
