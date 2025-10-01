import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

@Entity('cpe_sequences')
export class CpeSequence {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 2 })
  doc_type: string; // 01 factura, 03 boleta

  @Column({ type: 'varchar', length: 8 })
  series: string; // F001, B001

  @Column({ type: 'int', default: 0 })
  last_number: number;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at: Date;
}
