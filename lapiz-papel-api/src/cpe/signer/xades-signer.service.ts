import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { createHash } from 'crypto';

@Injectable()
export class XadesSignerService {
  private readonly logger = new Logger(XadesSignerService.name);
  private readonly baseUrl = process.env.XADES_URL;
  private readonly enabled = !!process.env.XADES_URL;

  constructor(private readonly http: HttpService) {
    if (!this.enabled) {
      this.logger.warn(
        '⚠️  XAdES signing is DISABLED - XADES_URL not configured. CPE emission will be skipped.',
      );
    }
  }

  /**
   * Ya no necesitamos cargar certificados aquí - se maneja en el servicio Java
   */
  loadCertificate(pfxPath: string, password: string) {
    // Método mantenido por compatibilidad - ya no se usa
    this.logger.debug('Certificate loading delegated to Java service');
  }

  /**
   * Verifica si el servicio XAdES está habilitado
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Firma XML usando el servicio Java XAdES
   */
  async sign(xml: string): Promise<{ signedXml: string; digestValue: string }> {
    // Verificar si el servicio está habilitado
    if (!this.enabled) {
      throw new Error(
        'XAdES signing service is disabled. Set XADES_URL environment variable to enable CPE signing.',
      );
    }

    try {
      this.logger.debug(`Sending XML to XAdES service at ${this.baseUrl}`);

      const body = {
        xml,
        keyAlias: 'prod', // Usa el alias configurado en docker-compose
      };

      const response = await firstValueFrom(
        this.http.post(`${this.baseUrl}/sign-xades`, body, {
          timeout: 15000,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      const data = response.data;

      if (data.error) {
        throw new Error(`XAdES Service Error: ${data.error}`);
      }

      if (!data.signedXml) {
        throw new Error('No signed XML received from XAdES service');
      }

      // Generar hash del XML firmado para persistencia
      const digestValue = createHash('sha256')
        .update(data.signedXml)
        .digest('base64');

      this.logger.debug('XML signed successfully by Java service');

      return {
        signedXml: data.signedXml,
        digestValue,
      };
    } catch (error) {
      this.logger.error('Error signing XML with Java service:', error);

      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          'XAdES signing service unavailable. The service is not running or not reachable.',
        );
      }

      throw new Error(`XAdES signing failed: ${error.message}`);
    }
  }
}
