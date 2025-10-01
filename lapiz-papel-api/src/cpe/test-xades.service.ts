import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class TestXadesService {
  private readonly logger = new Logger(TestXadesService.name);
  private readonly baseUrl = process.env.XADES_URL || 'http://localhost:8080';

  constructor(private readonly http: HttpService) {}

  /**
   * Prueba la conexión con el servicio XAdES
   */
  async testConnection(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      this.logger.log(`Testing connection to XAdES service at ${this.baseUrl}`);

      const response = await firstValueFrom(
        this.http.get(`${this.baseUrl}/health`, { timeout: 5000 }),
      );

      if (response.status === 200) {
        return {
          success: true,
          message: 'XAdES service is reachable and healthy',
        };
      }

      return {
        success: false,
        message: `XAdES service returned status: ${response.status}`,
      };
    } catch (error) {
      this.logger.error('Error testing XAdES service connection:', error);

      let errorMessage = 'Unknown error';
      if (error.code === 'ECONNREFUSED') {
        errorMessage = 'Connection refused - XAdES service may not be running';
      } else if (error.code === 'ETIMEDOUT') {
        errorMessage =
          'Connection timeout - XAdES service may be slow to respond';
      } else {
        errorMessage = error.message || 'Network error';
      }

      return {
        success: false,
        message: 'Failed to connect to XAdES service',
        error: errorMessage,
      };
    }
  }

  /**
   * Prueba la firma con un XML de ejemplo
   */
  async testSigning(): Promise<{
    success: boolean;
    message: string;
    error?: string;
  }> {
    try {
      const testXml = `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
  <ID>TEST-001</ID>
  <IssueDate>2025-09-29</IssueDate>
</Invoice>`;

      this.logger.log('Testing XML signing with XAdES service');

      const body = {
        xml: testXml,
        keyAlias: 'prod',
      };

      const response = await firstValueFrom(
        this.http.post(`${this.baseUrl}/sign-xades`, body, {
          timeout: 10000,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      const data = response.data;

      if (data.error) {
        return {
          success: false,
          message: 'XAdES service returned an error',
          error: data.error,
        };
      }

      if (data.signedXml && data.signedXml.includes('<ds:Signature')) {
        return {
          success: true,
          message: 'XML signed successfully - XAdES signature detected',
        };
      }

      return {
        success: false,
        message: 'XML returned but no XAdES signature found',
        error: 'Missing ds:Signature element',
      };
    } catch (error) {
      this.logger.error('Error testing XML signing:', error);

      return {
        success: false,
        message: 'Failed to sign test XML',
        error: error.message || 'Unknown signing error',
      };
    }
  }
}
