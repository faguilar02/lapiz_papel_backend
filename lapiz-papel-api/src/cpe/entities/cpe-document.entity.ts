import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';
import { CpeStatus } from '../enums/cpe-status.enum';

@Entity('cpe_documents')
export class CpeDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2 })
  doc_type: string; // 01 factura, 03 boleta

  @Column({ type: 'varchar', length: 8 })
  series: string;

  @Column({ type: 'int' })
  number: number;

  @Column({ type: 'uuid', nullable: true })
  sale_id: string | null;

  @Column({ type: 'text' })
  filename: string; // RUC-TIPO-SERIE-NUMERO

  @Column({ type: 'text' })
  hash: string;

  @Column({ type: 'text' })
  xml_path: string;

  @Column({ type: 'text' })
  zip_path: string;

  @Column({ type: 'text', nullable: true })
  cdr_path: string | null;

  @Column({
    type: 'enum',
    enum: CpeStatus,
    default: CpeStatus.PENDING,
  })
  status: CpeStatus;

  @Column({ type: 'varchar', length: 50, nullable: true })
  sunat_code: string | null; // CDR code

  @Column({ type: 'text', nullable: true })
  sunat_description: string | null;

  @Column({ type: 'int', default: 0 })
  retries: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at: Date;
}
