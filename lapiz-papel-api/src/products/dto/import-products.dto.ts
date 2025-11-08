export class ImportProductDto {
  nombre: string;
  marca?: string;
  categoria?: string;
  unidad?: string;
  precio_venta: number;
  precio_compra?: number;
  cantidad_stock?: number;
  stock_minimo?: number;
  mayoreo_3?: number;
  mayoreo_6?: number;
  mayoreo_25?: number;
  mayoreo_50?: number;
  sku?: string;
}

export class ImportProductsResponseDto {
  success: boolean;
  total_rows: number;
  imported: number;
  failed: number;
  sheets_processed: number;
  errors: Array<{
    row: number;
    sheet: string;
    product_name: string;
    error: string;
  }>;
  created_products: Array<{
    row: number;
    sheet: string;
    product_name: string;
    product_id: string;
    bulk_prices_created: number;
  }>;
}
