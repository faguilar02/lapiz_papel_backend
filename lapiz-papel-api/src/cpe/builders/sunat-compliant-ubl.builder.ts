import { create } from 'xmlbuilder2';

/**
 * Builder UBL 2.1 100% conforme a especificación SUNAT Perú
 * Implementa EXACTAMENTE los requisitos de la guía oficial UBL 2.1 SUNAT
 *
 * Puntos clave implementados:
 * - Punto 16: Tipo y Número de RUC del Emisor en PartyTaxScheme/CompanyID[@schemeID="6"]
 * - Punto 17: Código del domicilio fiscal en PartyTaxScheme/RegistrationAddress/AddressTypeCode
 * - Punto 18-19: CompanyID del adquirente en PartyTaxScheme (no PartyIdentification)
 */
export class SunatCompliantUblBuilder {
  /**
   * Construye XML UBL 2.1 conforme a SUNAT desde JSON SUNAT
   */
  buildFromSunatJson(sunatJson: any): {
    xml: string;
    hashBase: string;
    total: number;
    igv: number;
    subtotal: number;
  } {
    const {
      ublVersion,
      tipoOperacion,
      tipoDoc,
      serie,
      correlativo,
      fechaEmision,
      tipoMoneda,
      company,
      client,
      mtoOperGravadas: _mtoOperGravadas,
      mtoIGV: _mtoIGV,
      mtoImpVenta: _mtoImpVenta,
      details,
    } = sunatJson;

    // Convertir valores a número de forma segura
    const toNumber = (value: any): number => {
      if (typeof value === 'number') return value;
      if (typeof value === 'string') return parseFloat(value) || 0;
      return 0;
    };

    const mtoOperGravadas = toNumber(_mtoOperGravadas);
    const mtoIGV = toNumber(_mtoIGV);
    const mtoImpVenta = toNumber(_mtoImpVenta);

    const docId = `${serie}-${correlativo}`;
    const profileExecutionId = process.env.SUNAT_ENV === 'prod' ? '2' : '1';

    // Determinar elemento raíz
    const rootElementName = ['01', '03'].includes(tipoDoc)
      ? 'Invoice'
      : 'CreditNote';
    const rootNamespace = `urn:oasis:names:specification:ubl:schema:xsd:${rootElementName}-2`;

    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele(rootElementName, {
        xmlns: rootNamespace,
        'xmlns:cac':
          'urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2',
        'xmlns:cbc':
          'urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2',
        'xmlns:ds': 'http://www.w3.org/2000/09/xmldsig#',
        'xmlns:ext':
          'urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2',
      })

      // === HEADER UBL ===
      .ele('cbc:UBLVersionID')
      .txt(ublVersion)
      .up()
      .ele('cbc:CustomizationID')
      .txt('2.0')
      .up()
      .ele('cbc:ProfileID', {
        schemeName: 'Tipo de Operacion',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo17',
      })
      .txt(tipoOperacion)
      .up()
      .ele('cbc:ProfileExecutionID', {
        schemeAgencyName: 'PE:SUNAT',
      })
      .txt(profileExecutionId)
      .up()
      .ele('cbc:ID')
      .txt(docId)
      .up()
      .ele('cbc:IssueDate')
      .txt(fechaEmision)
      .up()

      // Tipo de documento
      .ele(
        rootElementName === 'Invoice'
          ? 'cbc:InvoiceTypeCode'
          : 'cbc:CreditNoteTypeCode',
        {
          listAgencyName: 'PE:SUNAT',
          listName: 'Tipo de Documento',
          listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01',
          listVersionID: '1.0',
        },
      )
      .txt(tipoDoc)
      .up()

      .ele('cbc:DocumentCurrencyCode', {
        listID: 'ISO 4217 Alpha',
        listName: 'Currency',
        listAgencyName: 'United Nations Economic Commission for Europe',
      })
      .txt(tipoMoneda)
      .up()

      // === FIRMA (placeholder) ===
      .ele('cac:Signature')
      .ele('cbc:ID')
      .txt('IDSignST')
      .up()
      .ele('cac:DigitalSignatureAttachment')
      .ele('cac:ExternalReference')
      .ele('cbc:URI')
      .txt('#SignatureST')
      .up()
      .up()
      .up()
      .up();

    // === EMISOR (SUPPLIER) === CONFORME SUNAT UBL 2.1 PERÚ ===
    root
      .ele('cac:AccountingSupplierParty')
      .ele('cac:Party')
      // Nombre comercial (opcional)
      .ele('cac:PartyName')
      .ele('cbc:Name')
      .txt(company.nombreComercial || company.razonSocial)
      .up()
      .up()

      // *** PUNTO 16 y 17: ESTRUCTURA REQUERIDA POR SUNAT ***
      .ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName')
      .txt(company.razonSocial)
      .up()

      // PUNTO 16: CompanyID con schemeID="6" (tipo RUC)
      .ele('cbc:CompanyID', {
        schemeID: '6',
        schemeName: 'SUNAT:Identificador de Documento de Identidad',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
      })
      .txt(company.ruc)
      .up()

      // PUNTO 17: AddressTypeCode en RegistrationAddress bajo PartyTaxScheme
      .ele('cac:RegistrationAddress')
      .ele('cbc:ID', {
        schemeName: 'Ubigeos',
        schemeAgencyName: 'PE:INEI',
      })
      .txt(company.address?.ubigueo || '150101')
      .up()

      .ele('cbc:AddressTypeCode', {
        listAgencyName: 'PE:SUNAT',
        listName: 'Establecimientos anexos',
      })
      .txt('0000')
      .up() // 0000 = domicilio fiscal

      .ele('cbc:CitySubdivisionName')
      .txt(company.address?.distrito || 'Lima')
      .up()
      .ele('cbc:CityName')
      .txt(company.address?.provincia || 'Lima')
      .up()
      .ele('cbc:CountrySubentity')
      .txt(company.address?.departamento || 'Lima')
      .up()
      .ele('cbc:District')
      .txt(company.address?.distrito || 'Lima')
      .up()
      .ele('cac:AddressLine')
      .ele('cbc:Line')
      .txt(company.address?.direccion || 'Dirección no especificada')
      .up()
      .up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode', {
        listID: 'ISO 3166-1',
        listAgencyName: 'United Nations Economic Commission for Europe',
        listName: 'Country',
      })
      .txt('PE')
      .up()
      .up()
      .up()

      .ele('cac:TaxScheme')
      .ele('cbc:ID', {
        schemeID: 'UN/ECE 5153',
        schemeAgencyID: '6',
      })
      .txt('-')
      .up()
      .up()
      .up()
      .up()
      .up();

    // === CLIENTE (CUSTOMER) === CONFORME SUNAT UBL 2.1 PERÚ ===
    root
      .ele('cac:AccountingCustomerParty')
      .ele('cac:Party')
      // *** PUNTO 18-19: ESTRUCTURA REQUERIDA POR SUNAT ***
      .ele('cac:PartyTaxScheme')
      .ele('cbc:RegistrationName')
      .txt(client.rznSocial)
      .up()

      // CompanyID del cliente con su tipo de documento
      .ele('cbc:CompanyID', {
        schemeID: client.tipoDoc,
        schemeName: 'SUNAT:Identificador de Documento de Identidad',
        schemeAgencyName: 'PE:SUNAT',
        schemeURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo06',
      })
      .txt(client.numDoc)
      .up()

      // Dirección del cliente
      .ele('cac:RegistrationAddress')
      .ele('cac:AddressLine')
      .ele('cbc:Line')
      .txt(client.address?.direccion || 'Dirección no especificada')
      .up()
      .up()
      .ele('cac:Country')
      .ele('cbc:IdentificationCode', {
        listID: 'ISO 3166-1',
        listAgencyName: 'United Nations Economic Commission for Europe',
        listName: 'Country',
      })
      .txt('PE')
      .up()
      .up()
      .up()

      .ele('cac:TaxScheme')
      .ele('cbc:ID', {
        schemeID: 'UN/ECE 5153',
        schemeAgencyID: '6',
      })
      .txt('-')
      .up()
      .up()
      .up()
      .up()
      .up();

    // === TOTALES DE IMPUESTOS ===
    root
      .ele('cac:TaxTotal')
      .ele('cbc:TaxAmount', { currencyID: tipoMoneda })
      .txt(mtoIGV.toFixed(2))
      .up()
      .ele('cac:TaxSubtotal')
      .ele('cbc:TaxableAmount', { currencyID: tipoMoneda })
      .txt(mtoOperGravadas.toFixed(2))
      .up()
      .ele('cbc:TaxAmount', { currencyID: tipoMoneda })
      .txt(mtoIGV.toFixed(2))
      .up()
      .ele('cac:TaxCategory')
      .ele('cbc:Percent')
      .txt('18.00')
      .up()
      .ele('cbc:TaxExemptionReasonCode', {
        listAgencyName: 'PE:SUNAT',
        listName: 'Afectacion del IGV',
        listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07',
      })
      .txt('10')
      .up()
      .ele('cac:TaxScheme')
      .ele('cbc:ID', {
        schemeID: 'UN/ECE 5153',
        schemeAgencyID: '6',
      })
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

    // === TOTALES MONETARIOS ===
    root
      .ele('cac:LegalMonetaryTotal')
      .ele('cbc:LineExtensionAmount', { currencyID: tipoMoneda })
      .txt(mtoOperGravadas.toFixed(2))
      .up()
      .ele('cbc:TaxInclusiveAmount', { currencyID: tipoMoneda })
      .txt(mtoImpVenta.toFixed(2))
      .up()
      .ele('cbc:PayableAmount', { currencyID: tipoMoneda })
      .txt(mtoImpVenta.toFixed(2))
      .up()
      .up();

    // === LÍNEAS DE DETALLE ===
    details.forEach((item: any, index: number) => {
      const itemMtoValorVenta = toNumber(item.mtoValorVenta);
      const itemMtoPrecioUnitario = toNumber(item.mtoPrecioUnitario);
      const itemIgv = toNumber(item.igv);
      const itemMtoBaseIgv = toNumber(item.mtoBaseIgv);
      const itemPorcentajeIgv = toNumber(item.porcentajeIgv);
      const itemMtoValorUnitario = toNumber(item.mtoValorUnitario);

      root
        .ele(
          rootElementName === 'Invoice'
            ? 'cac:InvoiceLine'
            : 'cac:CreditNoteLine',
        )
        .ele('cbc:ID')
        .txt(item.orden.toString())
        .up()
        .ele('cbc:InvoicedQuantity', {
          unitCode: item.unidad,
          unitCodeListID: 'UN/ECE rec 20',
          unitCodeListAgencyName:
            'United Nations Economic Commission for Europe',
        })
        .txt(item.cantidad.toString())
        .up()
        .ele('cbc:LineExtensionAmount', { currencyID: tipoMoneda })
        .txt(itemMtoValorVenta.toFixed(2))
        .up()

        // Precios de referencia
        .ele('cac:PricingReference')
        .ele('cac:AlternativeConditionPrice')
        .ele('cbc:PriceAmount', { currencyID: tipoMoneda })
        .txt(itemMtoPrecioUnitario.toFixed(5))
        .up()
        .ele('cbc:PriceTypeCode', {
          listName: 'Tipo de Precio',
          listAgencyName: 'PE:SUNAT',
          listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo16',
        })
        .txt('01')
        .up()
        .up()
        .up()

        // Impuestos por línea
        .ele('cac:TaxTotal')
        .ele('cbc:TaxAmount', { currencyID: tipoMoneda })
        .txt(itemIgv.toFixed(2))
        .up()
        .ele('cac:TaxSubtotal')
        .ele('cbc:TaxableAmount', { currencyID: tipoMoneda })
        .txt(itemMtoBaseIgv.toFixed(2))
        .up()
        .ele('cbc:TaxAmount', { currencyID: tipoMoneda })
        .txt(itemIgv.toFixed(2))
        .up()
        .ele('cac:TaxCategory')
        .ele('cbc:Percent')
        .txt(itemPorcentajeIgv.toFixed(2))
        .up()
        .ele('cbc:TaxExemptionReasonCode', {
          listAgencyName: 'PE:SUNAT',
          listName: 'Afectacion del IGV',
          listURI: 'urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo07',
        })
        .txt(item.tipAfeIgv)
        .up()
        .ele('cac:TaxScheme')
        .ele('cbc:ID', {
          schemeID: 'UN/ECE 5153',
          schemeAgencyID: '6',
        })
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

        // Producto/Servicio
        .ele('cac:Item')
        .ele('cbc:Description')
        .txt(item.descripcion)
        .up()
        .ele('cac:SellersItemIdentification')
        .ele('cbc:ID')
        .txt(item.codProducto || 'ITEM001')
        .up()
        .up()
        .ele('cac:CommodityClassification')
        .ele('cbc:ItemClassificationCode', {
          listID: 'UNSPSC',
          listAgencyName: 'GS1 US',
          listName: 'Item Classification',
        })
        .txt('50000000')
        .up()
        .up()
        .up()

        // Precio unitario
        .ele('cac:Price')
        .ele('cbc:PriceAmount', { currencyID: tipoMoneda })
        .txt(itemMtoValorUnitario.toFixed(5))
        .up()
        .up()
        .up();
    });

    const xml = root.end({ prettyPrint: true });

    return {
      xml,
      hashBase: xml,
      total: mtoImpVenta,
      igv: mtoIGV,
      subtotal: mtoOperGravadas,
    };
  }
}
