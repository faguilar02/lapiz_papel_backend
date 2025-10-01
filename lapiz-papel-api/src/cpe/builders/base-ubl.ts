import { InvoiceDto } from '../dto/invoice.dto';
import { CpeItemDto } from '../dto/cpe-item.dto';
import { create } from 'xmlbuilder2';

interface BuildParams {
  dto: InvoiceDto;
  docType: '01' | '03';
  ruc: string;
  companyName: string;
  series: string;
  number: number;
  issueDateISO: string; // YYYY-MM-DD
  igvRate: number; // 0.18
}

export class BaseUblBuilder {
  buildInvoiceXML(params: BuildParams): {
    xml: string;
    hashBase: string;
    total: number;
    igv: number;
    subtotal: number;
  } {
    const {
      dto,
      docType,
      ruc,
      companyName,
      series,
      number,
      issueDateISO,
      igvRate,
    } = params;

    // Totales
    let subtotal = 0;
    let igvTotal = 0;
    let total = 0;

    dto.items.forEach((item: CpeItemDto) => {
      const lineTotal = item.quantity * item.unitPrice;
      total += lineTotal;
    });

    if (dto.includesIgv) {
      subtotal = total / (1 + igvRate);
      igvTotal = total - subtotal;
    } else {
      subtotal = total;
      igvTotal = subtotal * igvRate;
      total = subtotal + igvTotal;
    }

    subtotal = Number(subtotal.toFixed(2));
    igvTotal = Number(igvTotal.toFixed(2));
    total = Number(total.toFixed(2));

    const paddedNumber = number.toString().padStart(8, '0');
    const docId = `${series}-${paddedNumber}`;
    const profileExecutionId = process.env.SUNAT_ENV === 'prod' ? '2' : '1'; // 1=beta, 2=prod

    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('Invoice', {
        xmlns: 'urn:oasis:names:specification:ubl:schema:xsd:Invoice-2',
        'xmlns:cac':
          'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc':
          'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:ext':
          'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      })
      .ele('cbc:UBLVersionID')
      .txt('2.1')
      .up()
      .ele('cbc:CustomizationID')
      .txt('2.0')
      .up()
      .ele('cbc:ProfileID')
      .txt('0101')
      .up()
      .ele('cbc:ProfileExecutionID')
      .txt(profileExecutionId)
      .up()
      .ele('cbc:ID')
      .txt(docId)
      .up()
      .ele('cbc:IssueDate')
      .txt(issueDateISO)
      .up()
      .ele('cbc:InvoiceTypeCode', {
        listAgencyName: 'PE:SUNAT',
        listName: 'Tipo de Documento',
        listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01',
        listVersionID: '1.0',
      })
      .txt(docType)
      .up()
      .ele('cbc:DocumentCurrencyCode', {
        listID: 'ISO 4217 Alpha',
        listName: 'Currency',
        listAgencyName: 'United Nations Economic Commission for Europe',
      })
      .txt(dto.currency)
      .up()

      // Firma (placeholder)
      .ele('cac:Signature')
      .ele('cbc:ID')
      .txt('SIGN')
      .up()
      .ele('cac:DigitalSignatureAttachment')
      .ele('cac:ExternalReference')
      .ele('cbc:URI')
      .txt('#SIGN')
      .up()
      .up()
      .up()
      .up()

      // === Emisor (SUNAT) === UBL 2.1 Perú correcto
      .ele('cac:AccountingSupplierParty')
      .ele('cac:Party')
      // Opcional: Nombre comercial
      .ele('cac:PartyName')
      .ele('cbc:Name')
      .txt(companyName)
      .up()
      .up()

      .ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName')
      .txt(companyName)
      .up()
      .ele('cbc:CompanyID', {
        schemeID: '6',
        schemeName: 'SUNAT:Identificador de Documento de Identidad',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
      })
      .txt(ruc)
      .up()
      .ele('cac:RegistrationAddress')
      // 0000 = domicilio fiscal principal o DF
      .ele('cbc:AddressTypeCode')
      .txt('0000')
      .up()
      .up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt('-')
      .up()
      .up()
      .up()
      .up()
      .up()

      // === Cliente ===
      .ele('cac:AccountingCustomerParty')
      .ele('cac:Party')
      .ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName')
      .txt(dto.customer.name)
      .up()
      .ele('cbc:CompanyID', {
        schemeID: dto.customer.docType, // '1'=DNI, '6'=RUC, etc.
        schemeName: 'SUNAT:Identificador de Documento de Identidad',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
      })
      .txt(dto.customer.docNumber)
      .up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt('-')
      .up()
      .up()
      .up()
      .up()
      .up();

    // TaxTotal
    root
      .ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: dto.currency })
      .txt(igvTotal.toFixed(2))
      .up()
      .ele('cac:TaxSubtotal')
      .ele('cbc:TaxableAmount', { currencyID: dto.currency })
      .txt(subtotal.toFixed(2))
      .up()
      .ele('cbc:TaxAmount', { currencyID: dto.currency })
      .txt(igvTotal.toFixed(2))
      .up()
      .ele('cac:TaxCategory')
      .ele('cac:TaxScheme')
      .ele('cbc:ID')
      .txt('1000')
      .up()
      .ele('cbc:Name')
      .txt('IGV')
      .up()
      .ele('cbc:TaxTypeCode')
      .txt('VAT')
      .up()
      .up()
      .up()
      .up()
      .up();

    // Totales monetarios
    root
      .ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: dto.currency })
      .txt(subtotal.toFixed(2))
      .up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: dto.currency })
      .txt(total.toFixed(2))
      .up()
      .ele('cbc:PayableAmount', { currencyID: dto.currency })
      .txt(total.toFixed(2))
      .up()
      .up();

    // Líneas
    dto.items.forEach((item, index) => {
      const lineTotal = item.quantity * item.unitPrice;
      let lineSubtotal: number;
      let lineIgv: number;
      if (dto.includesIgv) {
        lineSubtotal = lineTotal / (1 + igvRate);
        lineIgv = lineTotal - lineSubtotal;
      } else {
        lineSubtotal = lineTotal;
        lineIgv = lineSubtotal * igvRate;
      }

      root
        .ele('cac:InvoiceLine')
        .ele('cbc:ID')
        .txt((index + 1).toString())
        .up()
        .ele('cbc:InvoicedQuantity', { unitCode: item.unitCode })
        .txt(item.quantity.toString())
        .up()
        .ele('cbc:LineExtensionAmount', { currencyID: dto.currency })
        .txt(lineSubtotal.toFixed(2))
        .up()

        .ele('cac:PricingReference')
        .ele('cac:AlternativeConditionPrice')
        .ele('cbc:PriceAmount', { currencyID: dto.currency })
        .txt(item.unitPrice.toFixed(2))
        .up()
        .ele('cbc:PriceTypeCode')
        .txt('01')
        .up()
        .up()
        .up()

        .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: dto.currency })
        .txt(lineIgv.toFixed(2))
        .up()
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: dto.currency })
        .txt(lineSubtotal.toFixed(2))
        .up()
        .ele('cbc:TaxAmount', { currencyID: dto.currency })
        .txt(lineIgv.toFixed(2))
        .up()
        .ele('cac:TaxCategory')
        .ele('cbc:Percent')
        .txt((igvRate * 100).toFixed(2))
        .up()
        .ele('cbc:TaxExemptionReasonCode')
        .txt('10')
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID')
        .txt('1000')
        .up()
        .ele('cbc:Name')
        .txt('IGV')
        .up()
        .ele('cbc:TaxTypeCode')
        .txt('VAT')
        .up()
        .up()
        .up()
        .up()
        .up()

        .ele('cac:Item')
        .ele('cbc:Description')
        .txt(item.description)
        .up()
        .up()

        .ele('cac:Price')
        .ele('cbc:PriceAmount', { currencyID: dto.currency })
        .txt((lineSubtotal / item.quantity).toFixed(5))
        .up()
        .up()

        .up();
    });

    const xml = root.end({ prettyPrint: true });

    return { xml, hashBase: xml, total, igv: igvTotal, subtotal };
  }
}
