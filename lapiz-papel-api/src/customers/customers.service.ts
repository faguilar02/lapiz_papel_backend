import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Customer, DocumentType } from './entities/customer.entity';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  SearchCustomersDto,
} from './dto';
import { PaginationDto } from '../auth/dto';
import { PaginatedResponse } from '../auth/interfaces/paginated-response.interface';
import { createPaginatedResponse } from '../auth/utils/pagination.helper';
import { DocumentVerificationService } from './services/document-verification.service';

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private readonly customerRepository: Repository<Customer>,
    private readonly documentVerificationService: DocumentVerificationService,
  ) {}

  async create(createCustomerDto: CreateCustomerDto): Promise<Customer> {
    const customer = this.customerRepository.create(createCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async findAll(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponse<Customer>> {
    const { limit = 10, offset = 0 } = paginationDto;

    const [data, total] = await this.customerRepository
      .createQueryBuilder('customer')
      .addSelect('customer.is_active')
      .orderBy('customer.created_at', 'DESC')
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    return createPaginatedResponse(data, total, limit, offset);
  }

  async findOne(id: string): Promise<Customer> {
    const customer = await this.customerRepository.findOne({
      where: { id },
      relations: ['sales'],
    });

    if (!customer) {
      throw new NotFoundException('Customer not found');
    }

    return customer;
  }

  async update(
    id: string,
    updateCustomerDto: UpdateCustomerDto,
  ): Promise<Customer> {
    const customer = await this.findOne(id);
    Object.assign(customer, updateCustomerDto);
    return await this.customerRepository.save(customer);
  }

  async remove(id: string): Promise<void> {
    const customer = await this.findOne(id);
    customer.is_active = false;
    await this.customerRepository.save(customer);
  }

  async search(
    searchDto: SearchCustomersDto,
  ): Promise<PaginatedResponse<Customer>> {
    const {
      search,
      document_number,
      document_type,
      limit = 20,
      offset = 0,
    } = searchDto;

    console.log('🔍 Customers Service: search called with:', searchDto);

    const queryBuilder = this.customerRepository
      .createQueryBuilder('customer')
      .addSelect('customer.is_active')
      .orderBy('customer.created_at', 'DESC');

    // Búsqueda específica por número de documento
    if (document_number) {
      if (document_type) {
        queryBuilder.where(
          'customer.document_number = :document_number AND customer.document_type = :document_type',
          { document_number, document_type },
        );
      } else {
        queryBuilder.where('customer.document_number = :document_number', {
          document_number,
        });
      }
    }
    // Búsqueda general
    else if (search) {
      queryBuilder.where(
        '(customer.display_name ILIKE :search OR customer.email ILIKE :search OR customer.phone ILIKE :search OR customer.document_number ILIKE :search)',
        { search: `%${search}%` },
      );
    }

    const [data, total] = await queryBuilder
      .take(limit)
      .skip(offset)
      .getManyAndCount();

    console.log('🔍 Customers Service: found', total, 'customers');
    return createPaginatedResponse(data, total, limit, offset);
  }

  async findByDocument(
    document_number: string,
    document_type: DocumentType,
  ): Promise<Customer | any> {
    console.log(
      `🔍 Searching for ${document_type.toUpperCase()}: ${document_number}`,
    );

    // First, try to find in database
    const existingCustomer = await this.customerRepository.findOne({
      where: { document_number, document_type },
    });

    if (existingCustomer) {
      console.log('✅ Customer found in database');
      return {
        found_in_database: true,
        customer: existingCustomer,
      };
    }

    console.log('❌ Customer not found in database, calling external API...');

    // If not found, call external API
    if (document_type === DocumentType.DNI) {
      const dniData = await this.documentVerificationService.verifyDNI(
        document_number,
      );
      if (dniData) {
        return {
          found_in_database: false,
          external_data: {
            document_type: DocumentType.DNI,
            document_number: dniData.dni,
            display_name: dniData.nombreCompleto,
            suggested_data: {
              display_name: dniData.nombreCompleto,
              document_type: DocumentType.DNI,
              document_number: dniData.dni,
            },
          },
        };
      }
    } else if (document_type === DocumentType.RUC) {
      const rucData = await this.documentVerificationService.verifyRUC(
        document_number,
      );
      if (rucData) {
        return {
          found_in_database: false,
          external_data: {
            document_type: DocumentType.RUC,
            document_number: rucData.ruc,
            display_name: rucData.razonSocial,
            status: rucData.estado,
            condition: rucData.condicion,
            address: rucData.direccion,
            suggested_data: {
              display_name: rucData.razonSocial,
              document_type: DocumentType.RUC,
              document_number: rucData.ruc,
              status: rucData.estado,
              condition: rucData.condicion,
              address: rucData.direccion,
            },
          },
        };
      }
    }

    throw new NotFoundException(
      'Document not found in database or external API',
    );
  }

  /**
   * Encuentra o crea un cliente basado en el número de documento
   * Útil para crear ventas con clientes nuevos automáticamente
   */
  async findOrCreateByDocument(
    document_number: string,
    document_type: DocumentType,
    additionalData?: Partial<CreateCustomerDto>,
  ): Promise<Customer> {
    console.log(
      `🔍 Finding or creating customer for ${document_type.toUpperCase()}: ${document_number}`,
    );

    // First, try to find in database
    const existingCustomer = await this.customerRepository.findOne({
      where: { document_number, document_type },
    });

    if (existingCustomer) {
      console.log('✅ Customer found in database');
      return existingCustomer;
    }

    console.log(
      '❌ Customer not found, attempting to create from external API...',
    );

    // Try to get data from external API
    let customerData: Partial<CreateCustomerDto> = {
      document_number,
      document_type,
      ...additionalData,
    };

    if (document_type === DocumentType.DNI) {
      const dniData = await this.documentVerificationService.verifyDNI(
        document_number,
      );
      if (dniData) {
        customerData.display_name = dniData.nombreCompleto;
      }
    } else if (document_type === DocumentType.RUC) {
      const rucData = await this.documentVerificationService.verifyRUC(
        document_number,
      );
      if (rucData) {
        customerData.display_name = rucData.razonSocial;
        customerData.status = rucData.estado;
        customerData.condition = rucData.condicion;
        customerData.address = rucData.direccion;
      }
    }

    // If no display_name from API, create a fallback
    if (!customerData.display_name) {
      customerData.display_name =
        additionalData?.display_name ||
        `Cliente ${document_type} ${document_number}`;
    }

    console.log('🆕 Creating new customer with data:', customerData);

    // Create the customer
    const newCustomer = this.customerRepository.create(customerData);
    const savedCustomer = await this.customerRepository.save(newCustomer);

    console.log('✅ Customer created successfully with ID:', savedCustomer.id);
    return savedCustomer;
  }

  async activate(id: string): Promise<Customer> {
    const customer = await this.findOne(id);
    customer.is_active = true;
    return await this.customerRepository.save(customer);
  }

  async deactivate(id: string): Promise<Customer> {
    const customer = await this.findOne(id);
    customer.is_active = false;
    return await this.customerRepository.save(customer);
  }
}
