import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CpeEmissionService } from './services/cpe-emission.service';
import { TestXadesService } from './test-xades.service';
import { InvoiceDto } from './dto/invoice.dto';

@Controller('cpe')
export class CpeController {
  constructor(
    private readonly emission: CpeEmissionService,
    private readonly testXades: TestXadesService,
  ) {}

  @Post('invoices')
  createInvoice(@Body() dto: InvoiceDto) {
    return this.emission.emitInvoice(dto, '01');
  }

  @Post('boletas')
  createBoleta(@Body() dto: InvoiceDto) {
    return this.emission.emitInvoice(dto, '03');
  }

  @Get('test/xades-connection')
  async testXadesConnection() {
    return this.testXades.testConnection();
  }

  @Get('test/xades-signing')
  async testXadesSigning() {
    return this.testXades.testSigning();
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.emission.findOne(id);
  }
}
