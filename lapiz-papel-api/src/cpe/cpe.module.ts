import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { CpeController } from './cpe.controller';
import { CpeEmissionService } from './services/cpe-emission.service';
import { CpeSequence } from './entities/cpe-sequence.entity';
import { CpeDocument } from './entities/cpe-document.entity';
import { SunatSoapClient } from './soap/sunat-soap.client';
import { XadesSignerService } from './signer/xades-signer.service';
import { CpeStorageService } from './services/cpe-storage.service';
import { TestXadesService } from './test-xades.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([CpeSequence, CpeDocument]),
    HttpModule.register({
      timeout: 15000,
    }),
  ],
  controllers: [CpeController],
  providers: [
    CpeEmissionService,
    SunatSoapClient,
    XadesSignerService,
    CpeStorageService,
    TestXadesService,
  ],
  exports: [CpeEmissionService],
})
export class CpeModule {}
