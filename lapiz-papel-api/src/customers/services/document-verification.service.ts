import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DNIResponse {
  dni: string;
  nombres: string;
  apellidoPaterno: string;
  apellidoMaterno: string;
  nombreCompleto: string;
  digitoVerificador: number;
}

export interface RUCResponse {
  ruc: string;
  razonSocial: string;
  estado: string;
  condicion: string;
  tipoPersona: string;
  ubigeo: string;
  direccion: string;
}

// API Response structures
export interface PeruDevsDNIApiResponse {
  estado: boolean;
  mensaje: string;
  resultado: {
    id: string;
    nombres: string;
    apellido_paterno: string;
    apellido_materno: string;
    nombre_completo: string;
    codigo_verificacion: string;
  };
}

export interface PeruDevsRUCApiResponse {
  estado: boolean;
  mensaje: string;
  resultado: {
    id: string;
    razon_social: string;
    estado: string;
    condicion: string;
    direccion: string;
    [key: string]: any; // For other fields we don't need
  };
}

@Injectable()
export class DocumentVerificationService {
  private readonly logger = new Logger(DocumentVerificationService.name);
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.apiKey = this.configService.get<string>('PERU_DEVS_API_KEY');
  }

  async verifyDNI(dni: string): Promise<DNIResponse | null> {
    try {
      this.logger.log(`Verifying DNI: ${dni}`);

      const url = `https://api.perudevs.com/api/v1/dni/simple?document=${dni}&key=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(`DNI API returned status: ${response.status}`);
        return null;
      }

      const apiData: PeruDevsDNIApiResponse = await response.json();

      if (!apiData.estado || !apiData.resultado) {
        this.logger.warn(`DNI not found or invalid: ${dni}`);
        return null;
      }

      this.logger.log(`DNI verification successful for: ${dni}`);

      // Transform API response to our expected format
      return {
        dni: apiData.resultado.id,
        nombres: apiData.resultado.nombres,
        apellidoPaterno: apiData.resultado.apellido_paterno,
        apellidoMaterno: apiData.resultado.apellido_materno,
        nombreCompleto: apiData.resultado.nombre_completo,
        digitoVerificador: parseInt(apiData.resultado.codigo_verificacion),
      };
    } catch (error) {
      this.logger.error(`Error verifying DNI ${dni}:`, error.message);
      return null;
    }
  }

  async verifyRUC(ruc: string): Promise<RUCResponse | null> {
    try {
      this.logger.log(`Verifying RUC: ${ruc}`);

      const url = `https://api.perudevs.com/api/v1/ruc?document=${ruc}&key=${this.apiKey}`;

      const response = await fetch(url);

      if (!response.ok) {
        this.logger.warn(`RUC API returned status: ${response.status}`);
        return null;
      }

      const apiData: PeruDevsRUCApiResponse = await response.json();

      if (!apiData.estado || !apiData.resultado) {
        this.logger.warn(`RUC not found or invalid: ${ruc}`);
        return null;
      }

      this.logger.log(`RUC verification successful for: ${ruc}`);

      // Transform API response to our expected format
      return {
        ruc: apiData.resultado.id,
        razonSocial: apiData.resultado.razon_social,
        estado: apiData.resultado.estado,
        condicion: apiData.resultado.condicion,
        direccion: apiData.resultado.direccion,
        tipoPersona: '', // Not provided in this API response
        ubigeo: '', // Not provided in this API response
      };
    } catch (error) {
      this.logger.error(`Error verifying RUC ${ruc}:`, error.message);
      return null;
    }
  }
}
