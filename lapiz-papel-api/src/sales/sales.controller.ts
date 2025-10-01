import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { SalesService } from './sales.service';
import { SunatDocumentService } from './services/sunat-document.service';
import {
  CreateSaleDto,
  UpdateSaleDto,
  CreateSaleReceiptDto,
  SearchReceiptsDto,
  SearchSalesDto,
  CalculateIGVDto,
} from './dto';
import { UpdateSaleReceiptDto } from './dto/update-sale-receipt.dto';
import {
  UpdateReceiptForSunatDto,
  SunatResponseDto,
  MarkAsSentDto,
} from './dto/sunat-document.dto';
import { PaginationDto } from '../auth/dto';
import { Auth, GetUser } from '../auth/decorators';
import { UserRole } from '../auth/models/enums';
import { User } from '../auth/entities/user.entity';
import { IGVCalculatorUtil } from './utils/igv-calculator.util';

@Controller('sales')
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly sunatDocumentService: SunatDocumentService,
  ) {}

  @Get('debug/ping')
  ping() {
    return { ok: true, from: 'SalesController', msg: 'holaa 4' };
  }

  @Post()
  @Auth()
  // Creates a sale and automatically generates a sales receipt with default or custom series
  create(@Body() createSaleDto: CreateSaleDto, @GetUser() user: User) {
    return this.salesService.create(createSaleDto, user);
  }

  @Get()
  @Auth()
  findAll(@Query() paginationDto: PaginationDto) {
    return this.salesService.findAll(paginationDto);
  }

  @Get('search')
  @Auth()
  search(@Query() searchDto: SearchSalesDto) {
    console.log('🔍 Sales: search called with:', searchDto);
    return this.salesService.search(searchDto);
  }

  @Get('reports')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  getSalesReport(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    return this.salesService.getSalesReport(
      new Date(startDate),
      new Date(endDate),
    );
  }

  @Get('nota-venta/:id')
  async getNotaVenta(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.generateNotaVenta(id);
  }

  @Get('company-logo')
  async getCompanyLogo() {
    return this.salesService.getCompanyLogo();
  }

  @Get(':id')
  @Auth()
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.findOne(id);
  }

  @Patch(':id')
  @Auth(UserRole.ADMIN, UserRole.WAREHOUSE)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSaleDto: UpdateSaleDto,
  ) {
    return this.salesService.update(id, updateSaleDto);
  }

  @Delete(':id')
  @Auth(UserRole.ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.remove(id);
  }

  @Post('calculate-igv')
  @Auth()
  calculateIGV(@Body() calculateIGVDto: CalculateIGVDto) {
    const { amount, includes_igv, igv_rate = 0.18 } = calculateIGVDto;

    const calculation = IGVCalculatorUtil.autoCalculateIGV(
      amount,
      includes_igv,
      igv_rate,
    );

    return {
      calculation,
      formatted: {
        subtotal: IGVCalculatorUtil.formatAmount(calculation.subtotal),
        igv_amount: IGVCalculatorUtil.formatAmount(calculation.igv_amount),
        total_amount: IGVCalculatorUtil.formatAmount(calculation.total_amount),
        igv_rate: IGVCalculatorUtil.formatRate(igv_rate),
      },
      breakdown: {
        base_amount: amount,
        includes_igv,
        igv_rate,
        description: includes_igv
          ? `Total incluye IGV. Base imponible: ${IGVCalculatorUtil.formatAmount(
              calculation.subtotal,
            )}, IGV: ${IGVCalculatorUtil.formatAmount(calculation.igv_amount)}`
          : `Subtotal sin IGV. IGV a agregar: ${IGVCalculatorUtil.formatAmount(
              calculation.igv_amount,
            )}, Total: ${IGVCalculatorUtil.formatAmount(
              calculation.total_amount,
            )}`,
      },
    };
  }

  @Post('receipts')
  @Auth()
  createReceipt(@Body() createReceiptDto: CreateSaleReceiptDto) {
    return this.salesService.createReceipt(createReceiptDto);
  }

  @Get('receipts/search')
  @Auth()
  searchReceipts(@Query() searchDto: SearchReceiptsDto) {
    return this.salesService.searchReceipts(searchDto);
  }

  @Get('receipts/all')
  @Auth()
  getAllReceipts(
    @Query('limit') limit: string = '20',
    @Query('offset') offset: string = '0',
  ) {
    return this.salesService.getAllReceipts(parseInt(limit), parseInt(offset));
  }

  @Get('receipts/:id')
  @Auth()
  getReceiptById(@Param('id', ParseUUIDPipe) id: string) {
    return this.salesService.getReceiptById(id);
  }

  @Patch('receipts/:id')
  @Auth(UserRole.ADMIN)
  updateReceipt(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateSaleReceiptDto: UpdateSaleReceiptDto,
  ) {
    return this.salesService.updateReceipt(id, updateSaleReceiptDto);
  }

  // === ENDPOINTS SUNAT ===

  @Post('receipts/:id/sunat/prepare')
  @Auth(UserRole.ADMIN)
  async prepareReceiptForSunat(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateReceiptDto: UpdateReceiptForSunatDto,
  ) {
    return this.sunatDocumentService.updateReceiptForSunat(id, {
      forceDocumentType: updateReceiptDto.forceDocumentType,
      clientData: updateReceiptDto.clientData,
    });
  }

  @Get('receipts/:id/sunat/json')
  @Auth(UserRole.ADMIN)
  async generateSunatJson(@Param('id', ParseUUIDPipe) id: string) {
    return this.sunatDocumentService.generateSunatJson(id);
  }

  @Post('receipts/:id/sunat/xml')
  @Auth(UserRole.ADMIN)
  async generateSunatXml(@Param('id', ParseUUIDPipe) id: string) {
    try {
      const xmlData = await this.sunatDocumentService.generateSunatXml(id);
      return {
        success: true,
        message: 'XML UBL 2.1 generado exitosamente',
        data: {
          documentId: xmlData.documentId,
          total: xmlData.total,
          igv: xmlData.igv,
          subtotal: xmlData.subtotal,
          xmlGenerated: true,
          xmlLength: xmlData.xml.length,
        },
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('receipts/:id/sunat/emit')
  @Auth(UserRole.ADMIN)
  async emitToSunat(@Param('id', ParseUUIDPipe) id: string) {
    try {
      const result = await this.sunatDocumentService.generateAndEmitToSunat(id);
      return {
        success: true,
        message: 'Documento emitido completamente a SUNAT',
        data: result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('receipts/:id/sunat/xml')
  @Auth(UserRole.ADMIN)
  async getSunatXml(@Param('id', ParseUUIDPipe) id: string, @Res() res) {
    try {
      const xml = await this.sunatDocumentService.getGeneratedXml(id);
      res.set({
        'Content-Type': 'application/xml',
        'Content-Disposition': 'attachment; filename="document.xml"',
      });
      res.send(xml);
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get('receipts/:id/sunat/signed-xml')
  @Auth(UserRole.ADMIN)
  async getSignedXml(@Param('id', ParseUUIDPipe) id: string, @Res() res) {
    try {
      // Primero intentar obtener desde la base de datos
      const receipt = await this.salesService.getReceiptById(id);

      if (receipt.signed_xml) {
        res.set({
          'Content-Type': 'application/xml',
          'Content-Disposition': 'attachment; filename="signed-document.xml"',
        });
        res.send(receipt.signed_xml);
        return;
      }

      // Si no hay XML firmado guardado, generar uno nuevo
      throw new BadRequestException(
        'Signed XML not available. The document may not have been processed through SUNAT emission yet. Try running the full SUNAT sequence first.',
      );
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Post('receipts/:id/sunat/mark-sent')
  @Auth(UserRole.ADMIN)
  async markReceiptAsSent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() markAsSentDto: MarkAsSentDto,
  ) {
    await this.sunatDocumentService.markAsSentToSunat(id, markAsSentDto.ticket);
    return { message: 'Receipt marked as sent to SUNAT', receiptId: id };
  }

  @Post('receipts/:id/sunat/update-response')
  @Auth(UserRole.ADMIN)
  async updateSunatResponse(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() responseDto: SunatResponseDto,
  ) {
    await this.sunatDocumentService.updateSunatResponse(
      id,
      responseDto.statusCode,
      responseDto.statusMessage,
      responseDto.cdrContent,
    );
    return { message: 'SUNAT response updated', receiptId: id };
  }
}
