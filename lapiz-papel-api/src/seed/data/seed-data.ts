import { UserRole } from '../../auth/models/enums';

export const seedData = {
  users: [
    {
      full_name: 'Fernando García',
      email: 'fernando@lapizpapel.com',
      password: 'Admin123!',
      role: UserRole.ADMIN,
    },
    {
      full_name: 'Fernando Aguilar',
      email: 'davidfer.aguilar02@gmail.com',
      password: 'Feragui02',
      role: UserRole.ADMIN,
    },
    {
      full_name: 'Ana López',
      email: 'ana@lapizpapel.com',
      password: 'Warehouse123!',
      role: UserRole.WAREHOUSE,
    },
    {
      full_name: 'Carlos Martínez',
      email: 'carlos@lapizpapel.com',
      password: 'Cashier123!',
      role: UserRole.CASHIER,
    },
    {
      full_name: 'María González',
      email: 'maria@lapizpapel.com',
      password: 'Cashier123!',
      role: UserRole.CASHIER,
    },
  ],

  categories: [
    {
      name: 'Electrónicos y Tecnología',
      description:
        'Dispositivos electrónicos, computadoras y accesorios tecnológicos',
    },
    {
      name: 'Hogar y Jardín',
      description: 'Artículos para el hogar, muebles y jardinería',
    },
    {
      name: 'Oficina y Papelería',
      description: 'Suministros de oficina, papelería y material escolar',
    },
    {
      name: 'Deportes y Recreación',
      description: 'Artículos deportivos y de entretenimiento',
    },
    {
      name: 'Ropa y Accesorios',
      description: 'Vestimenta y accesorios de moda',
    },
  ],

  customers: [
    {
      display_name: 'María González Silva',
      document_type: 'dni',
      document_number: '12345678',
      email: 'maria.gonzalez@email.com',
      phone: '+1234567890',
      address: 'Calle Principal 123, Apt 2B, Ciudad',
    },
    {
      display_name: 'Juan Pérez',
      document_type: 'dni',
      document_number: '87654321',
      email: 'juan.perez@email.com',
      phone: '+0987654321',
      address: 'Avenida Central 456, Ciudad',
    },
    {
      display_name: 'Ana Rodriguez',
      document_type: 'dni',
      document_number: '11223344',
      email: 'ana.rodriguez@email.com',
      phone: '+1122334455',
      address: 'Plaza Mayor 789, Centro',
    },
    {
      display_name: 'Carlos Mendoza',
      document_type: 'dni',
      document_number: '55667788',
      email: 'carlos.mendoza@email.com',
      phone: '+5566778899',
      address: 'Calle Comercio 321, Norte',
    },
    {
      display_name: 'Empresa Constructora SAC',
      document_type: 'ruc',
      document_number: '20123456789',
      email: 'contacto@constructora.com',
      phone: '+9988776655',
      address: 'Av. Industrial 123, Lima',
      status: 'ACTIVO',
      condition: 'HABIDO',
    },
  ],

  suppliers: [
    {
      name: 'TechnoSupply Corp',
      contact_person: 'Carlos Martínez Rivera',
      ruc: '20123456789',
      phone: '+1122334456',
      address: 'Zona Industrial Norte, Lote 15',
    },
    {
      name: 'Distribuidora El Sol',
      contact_person: 'Ana López',
      ruc: '20987654321',
      phone: '+5566778899',
      address: 'Calle Comercio 789, Centro',
    },
    {
      name: 'Muebles Modernos SA',
      contact_person: 'Roberto Silva',
      ruc: '20112233445',
      phone: '+3344556677',
      address: 'Carretera Industrial Km 5',
    },
    {
      name: 'Papelería Total',
      contact_person: 'Lucía Vargas',
      ruc: '20556677889',
      phone: '+7788990011',
      address: 'Centro Comercial Plaza, Local 45',
    },
  ],

  products: {
    electronics: [
      {
        name: 'Smartphone Samsung Galaxy A54',
        sku: 'SAM-GAL-A54',
        unit: 'pieza',
        sale_price: 599.99,
        cost_price: 450.0,
        stock_quantity: 25,
        minimum_stock: 5,
        status: 'active',
        image_url: 'https://example.com/images/samsung-galaxy-a54.jpg',
      },
      {
        name: 'Laptop Dell Inspiron 15',
        sku: 'DELL-INS-15',
        unit: 'pieza',
        sale_price: 899.99,
        cost_price: 700.0,
        stock_quantity: 10,
        minimum_stock: 2,
        status: 'active',
      },
      {
        name: 'Auriculares Sony WH-1000XM4',
        sku: 'SONY-WH-1000XM4',
        unit: 'pieza',
        sale_price: 299.99,
        cost_price: 200.0,
        stock_quantity: 15,
        minimum_stock: 3,
        status: 'active',
      },
    ],
    home: [
      {
        name: 'Mesa de Centro de Madera',
        sku: 'MESA-CEN-MAD',
        unit: 'pieza',
        sale_price: 150.0,
        cost_price: 100.0,
        stock_quantity: 8,
        minimum_stock: 2,
        status: 'active',
      },
      {
        name: 'Silla Ergonómica de Oficina',
        sku: 'SILLA-ERG-OF',
        unit: 'pieza',
        sale_price: 199.99,
        cost_price: 130.0,
        stock_quantity: 12,
        minimum_stock: 3,
        status: 'active',
      },
    ],
    office: [
      {
        name: 'Cuaderno Universitario',
        sku: 'CUAD-UNI-100',
        unit: 'pieza',
        sale_price: 5.99,
        cost_price: 3.5,
        stock_quantity: 200,
        minimum_stock: 50,
        status: 'active',
      },
      {
        name: 'Bolígrafos BIC Pack x12',
        sku: 'BOLI-BIC-12',
        unit: 'pack',
        sale_price: 8.99,
        cost_price: 5.0,
        stock_quantity: 75,
        minimum_stock: 20,
        status: 'active',
      },
    ],
    sports: [
      {
        name: 'Pelota de Fútbol Profesional',
        sku: 'PELOTA-FUT-PRO',
        unit: 'pieza',
        sale_price: 45.99,
        cost_price: 30.0,
        stock_quantity: 20,
        minimum_stock: 5,
        status: 'active',
      },
    ],
  },

  purchases: [
    {
      supplierName: 'TechnoSupply Corp',
      userRole: UserRole.WAREHOUSE,
      total_amount: 2250.0,
      notes: 'Compra mensual de inventario electrónicos',
      items: [
        {
          productSku: 'SAM-GAL-A54',
          quantity: 5,
          unit_cost: 450.0,
        },
      ],
    },
    {
      supplierName: 'Distribuidora El Sol',
      userRole: UserRole.WAREHOUSE,
      total_amount: 1400.0,
      notes: 'Reposición de stock bajo - laptops',
      items: [
        {
          productSku: 'DELL-INS-15',
          quantity: 2,
          unit_cost: 700.0,
        },
      ],
    },
    {
      supplierName: 'TechnoSupply Corp',
      userRole: UserRole.WAREHOUSE,
      total_amount: 1000.0,
      notes: 'Compra de auriculares premium',
      items: [
        {
          productSku: 'SONY-WH-1000XM4',
          quantity: 5,
          unit_cost: 200.0,
        },
      ],
    },
  ],

  sales: [
    {
      customerName: 'María González Silva',
      userRole: UserRole.CASHIER,
      subtotal: 508.47, // Base imponible (599.99 / 1.18)
      discount_amount: 0,
      includes_igv: true,
      igv_rate: 0.18,
      igv_amount: 91.52, // 18% IGV
      total_amount: 599.99,
      payment_method: 'credit_card',
      receipt_type: 'boleta',
      notes: 'Venta con IGV incluido - Cliente satisfecho',
      items: [
        {
          productSku: 'SAM-GAL-A54',
          quantity: 1,
          unit_price: 599.99,
        },
      ],
    },
    {
      customerName: 'Juan Pérez',
      userRole: UserRole.CASHIER,
      subtotal: 847.44, // Base imponible sin descuento
      discount_amount: 50.0,
      includes_igv: true,
      igv_rate: 0.18,
      igv_amount: 152.55, // IGV sobre total con descuento
      total_amount: 999.99,
      payment_method: 'cash',
      receipt_type: 'boleta',
      notes: 'Descuento por cliente frecuente - IGV incluido',
      items: [
        {
          productSku: 'DELL-INS-15',
          quantity: 1,
          unit_price: 899.99,
        },
        {
          productSku: 'MESA-CEN-MAD',
          quantity: 1,
          unit_price: 150.0,
        },
      ],
    },
    {
      customerName: 'Empresa Constructora SAC',
      userRole: UserRole.CASHIER,
      subtotal: 500.0, // Sin IGV para empresa
      discount_amount: 0,
      includes_igv: false,
      igv_rate: 0.18,
      igv_amount: 90.0, // IGV a agregar
      total_amount: 590.0, // Total con IGV
      payment_method: 'transfer',
      receipt_type: 'factura',
      notes: 'Venta empresarial - Factura con IGV separado',
      items: [
        {
          productSku: 'MESA-CEN-MAD',
          quantity: 2,
          unit_price: 150.0,
        },
        {
          productSku: 'SILLA-ERG-OF',
          quantity: 1,
          unit_price: 199.99,
        },
      ],
    },
  ],

  inventoryMovements: [
    {
      productSku: 'SAM-GAL-A54',
      movement_type: 'adjustment',
      quantity: 2,
      reason: 'Ajuste por inventario físico - productos encontrados',
      userRole: UserRole.ADMIN,
    },
    {
      productSku: 'DELL-INS-15',
      movement_type: 'adjustment',
      quantity: -1,
      reason: 'Ajuste por producto dañado',
      userRole: UserRole.ADMIN,
    },
    {
      productSku: 'MESA-CEN-MAD',
      movement_type: 'entry',
      quantity: 5,
      reason: 'Entrada manual - transferencia entre almacenes',
      userRole: UserRole.ADMIN,
    },
  ],
};
