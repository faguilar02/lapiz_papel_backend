import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as zlib from 'zlib';
import * as AdmZip from 'adm-zip';

export interface SunatResponse {
  success: boolean;
  code?: string;
  description?: string;
  cdrContent?: Buffer;
  rawResponse: string;
}

@Injectable()
export class SunatSoapClient {
  private readonly logger = new Logger(SunatSoapClient.name);

  async sendBill(params: {
    endpoint: string;
    username: string;
    password: string;
    fileName: string;
    zipContent: Buffer;
  }): Promise<SunatResponse> {
    const { endpoint, username, password, fileName, zipContent } = params;
    const zipBase64 = zipContent.toString('base64');
    const soapEnvelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ser="http://service.sunat.gob.pe" xmlns:wsse="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd">
  <soapenv:Header>
    <wsse:Security>
      <wsse:UsernameToken>
        <wsse:Username>${username}</wsse:Username>
        <wsse:Password>${password}</wsse:Password>
      </wsse:UsernameToken>
    </wsse:Security>
  </soapenv:Header>
  <soapenv:Body>
    <ser:sendBill>
      <fileName>${fileName}</fileName>
      <contentFile>${zipBase64}</contentFile>
    </ser:sendBill>
  </soapenv:Body>
</soapenv:Envelope>`;

    try {
      const { data } = await axios.post(endpoint, soapEnvelope, {
        headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '' },
        timeout: 30000,
      });

      return this.parseSoapResponse(data);
    } catch (error) {
      this.logger.error('Error sending bill to SUNAT:', error);
      throw error;
    }
  }

  private parseSoapResponse(soapResponse: string): SunatResponse {
    try {
      // Debug logging - formatted for better readability
      console.log('\n=== SUNAT RESPONSE DEBUG ===');
      console.log('Response Length:', soapResponse.length);
      console.log('Full Response:\n', soapResponse);
      console.log('=== END SUNAT RESPONSE ===\n');

      // Check for SOAP fault first
      if (
        soapResponse.includes('soap:Fault') ||
        soapResponse.includes('soapenv:Fault')
      ) {
        const faultCode =
          this.extractValue(soapResponse, 'faultcode') || 'SOAP_FAULT';
        const faultString =
          this.extractValue(soapResponse, 'faultstring') ||
          'Unknown SOAP fault';

        return {
          success: false,
          code: faultCode,
          description: faultString,
          rawResponse: soapResponse,
        };
      }

      // Extract successful response
      const applicationResponse = this.extractValue(
        soapResponse,
        'applicationResponse',
      );
      if (!applicationResponse) {
        return {
          success: false,
          code: 'NO_RESPONSE',
          description: 'No application response found',
          rawResponse: soapResponse,
        };
      }

      // Decode base64 CDR
      const cdrBuffer = Buffer.from(applicationResponse, 'base64');

      // Extract XML from CDR ZIP
      const zip = new AdmZip(cdrBuffer);
      const entries = zip.getEntries();
      const xmlEntry = entries.find((entry) =>
        entry.entryName.endsWith('.xml'),
      );

      if (!xmlEntry) {
        return {
          success: false,
          code: 'NO_CDR_XML',
          description: 'CDR XML not found in response',
          cdrContent: cdrBuffer,
          rawResponse: soapResponse,
        };
      }

      const cdrXml = xmlEntry.getData().toString('utf8');

      // Extract response code and description from CDR XML
      const responseCode = this.extractValue(cdrXml, 'cbc:ResponseCode') || '0';
      const description =
        this.extractValue(cdrXml, 'cbc:Description') || 'Accepted';

      return {
        success: responseCode === '0',
        code: responseCode,
        description: description,
        cdrContent: cdrBuffer,
        rawResponse: soapResponse,
      };
    } catch (error) {
      this.logger.error('Error parsing SOAP response:', error);
      return {
        success: false,
        code: 'PARSE_ERROR',
        description: `Error parsing response: ${error.message}`,
        rawResponse: soapResponse,
      };
    }
  }

  private extractValue(xml: string, tagName: string): string | null {
    const regex = new RegExp(`<${tagName}[^>]*>([^<]*)</${tagName}>`, 'i');
    const match = xml.match(regex);
    return match ? match[1].trim() : null;
  }
}
