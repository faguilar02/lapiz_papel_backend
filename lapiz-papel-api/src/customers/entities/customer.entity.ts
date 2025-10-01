import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Sale } from '../../sales/entities/sale.entity';

export enum DocumentType {
  DNI = 'dni',
  RUC = 'ruc',
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 255 })
  display_name: string;

  @Column({ type: 'enum', enum: DocumentType })
  document_type: DocumentType;

  @Column({ type: 'varchar', length: 11, unique: true })
  document_number: string;

  @Column({ type: 'text', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  phone: string;

  @Column({ type: 'text', nullable: true })
  address: string;

  // Campos específicos para RUC (empresas)
  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string; // Solo para RUC

  @Column({ type: 'varchar', length: 50, nullable: true })
  condition: string; // Solo para RUC

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  is_active: boolean;

  // Relations
  @OneToMany(() => Sale, (sale) => sale.customer)
  sales: Sale[];
}
