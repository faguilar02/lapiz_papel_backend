// 🎨 GUÍA FRONTEND - Manejo de Cantidades Decimales

// ============================================
// 1. CÓMO LLEGAN LOS DATOS DEL BACKEND
// ============================================

// Ejemplo de respuesta del backend:
const saleItem = {
  product_id: "123-abc",
  quantity: 2.5,        // ← Puede ser entero (5) o decimal (2.5)
  unit_price: 25.50,
  total_price: 63.75
};

// ============================================
// 2. FORMATEO PARA MOSTRAR AL USUARIO
// ============================================

// Opción A: Mostrar solo decimales necesarios (RECOMENDADO)
export const formatQuantity = (quantity) => {
  // Si es entero, no mostrar decimales
  if (Number.isInteger(quantity)) {
    return quantity.toString();
  }
  // Si tiene decimales, mostrar hasta 3 decimales sin ceros innecesarios
  return parseFloat(quantity.toFixed(3)).toString();
};

// Ejemplos:
formatQuantity(5)      // "5"
formatQuantity(2.5)    // "2.5"
formatQuantity(1.250)  // "1.25"
formatQuantity(0.333)  // "0.333"


// Opción B: Mostrar con unidad de medida
export const formatQuantityWithUnit = (quantity, unit) => {
  const formatted = formatQuantity(quantity);
  return `${formatted} ${unit}`;
};

// Ejemplos:
formatQuantityWithUnit(2.5, 'kg')      // "2.5 kg"
formatQuantityWithUnit(5, 'unidades')  // "5 unidades"
formatQuantityWithUnit(0.75, 'lt')     // "0.75 lt"


// Opción C: Formateo contextual (por tipo de producto)
export const formatQuantityByProductType = (quantity, product) => {
  const unit = product.unit || 'unidad';
  
  // Productos que se venden al peso/volumen → mostrar decimales
  const decimalUnits = ['kg', 'g', 'lt', 'ml', 'm', 'cm'];
  
  if (decimalUnits.includes(unit.toLowerCase())) {
    return parseFloat(quantity.toFixed(3)) + ' ' + unit;
  }
  
  // Productos por unidad → redondear
  return Math.round(quantity) + ' ' + unit;
};

// ============================================
// 3. INPUT PARA CANTIDAD
// ============================================

// React / Vue / Angular - Ejemplo genérico
const QuantityInput = ({ product, value, onChange }) => {
  const unit = product.unit || 'unidad';
  const isDecimalUnit = ['kg', 'g', 'lt', 'ml', 'm', 'cm'].includes(unit.toLowerCase());
  
  return (
    <div className="quantity-input">
      <label>Cantidad ({unit})</label>
      <input
        type="number"
        step={isDecimalUnit ? "0.001" : "1"}  // Decimales solo si es necesario
        min="0.001"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
        placeholder={isDecimalUnit ? "Ej: 2.5" : "Ej: 5"}
      />
      <small className="hint">
        {isDecimalUnit 
          ? "Puedes usar decimales (ej: 0.5, 1.250)" 
          : "Cantidad en unidades enteras"}
      </small>
    </div>
  );
};

// ============================================
// 4. VALIDACIÓN DE CANTIDAD
// ============================================

export const validateQuantity = (quantity) => {
  // Convertir a número
  const num = parseFloat(quantity);
  
  // Validaciones
  if (isNaN(num)) {
    return { valid: false, error: "La cantidad debe ser un número" };
  }
  
  if (num <= 0) {
    return { valid: false, error: "La cantidad debe ser mayor a 0" };
  }
  
  // Verificar que no tenga más de 3 decimales
  const decimalPart = quantity.toString().split('.')[1];
  if (decimalPart && decimalPart.length > 3) {
    return { valid: false, error: "Máximo 3 decimales permitidos" };
  }
  
  return { valid: true, value: num };
};

// Uso:
const result = validateQuantity("2.5");
if (result.valid) {
  // Enviar al backend
  createSale({ quantity: result.value });
} else {
  // Mostrar error
  alert(result.error);
}

// ============================================
// 5. CÁLCULO DE PRECIO TOTAL EN TIEMPO REAL
// ============================================

export const calculateItemTotal = (quantity, unitPrice) => {
  const total = quantity * unitPrice;
  return parseFloat(total.toFixed(2)); // Redondear a 2 decimales para precio
};

// Ejemplo en componente React:
const SaleItemRow = ({ product, quantity, setQuantity }) => {
  const unitPrice = product.sale_price;
  const total = calculateItemTotal(quantity, unitPrice);
  
  return (
    <tr>
      <td>{product.name}</td>
      <td>
        <input 
          type="number" 
          step="0.001"
          value={quantity}
          onChange={(e) => setQuantity(parseFloat(e.target.value))}
        />
      </td>
      <td>S/ {unitPrice.toFixed(2)}</td>
      <td className="total">S/ {total.toFixed(2)}</td>
    </tr>
  );
};

// ============================================
// 6. TABLA DE VENTAS - MOSTRAR CANTIDADES
// ============================================

const SalesTable = ({ sales }) => {
  return (
    <table>
      <thead>
        <tr>
          <th>Producto</th>
          <th>Cantidad</th>
          <th>P. Unitario</th>
          <th>Total</th>
        </tr>
      </thead>
      <tbody>
        {sales.map(sale => (
          <tr key={sale.id}>
            <td>{sale.product.name}</td>
            <td>
              {formatQuantityWithUnit(sale.quantity, sale.product.unit)}
            </td>
            <td>S/ {sale.unit_price.toFixed(2)}</td>
            <td>S/ {sale.total_price.toFixed(2)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

// ============================================
// 7. EJEMPLOS DE USO COMPLETO
// ============================================

// Ejemplo 1: Venta de arroz (por kg)
const rice = {
  name: "Arroz Extra",
  unit: "kg",
  sale_price: 3.50
};

formatQuantity(2.5);           // "2.5"
formatQuantityWithUnit(2.5, "kg");  // "2.5 kg"
calculateItemTotal(2.5, 3.50); // 8.75

// Ejemplo 2: Venta de cervezas (por unidad)
const beer = {
  name: "Cerveza Cusqueña",
  unit: "unidad",
  sale_price: 5.00
};

formatQuantity(6);                    // "6"
formatQuantityWithUnit(6, "unidad");  // "6 unidad"
calculateItemTotal(6, 5.00);          // 30.00

// ============================================
// 8. TIPS DE UX/UI
// ============================================

/*
1. AYUDAS VISUALES:
   - Mostrar la unidad de medida junto al input
   - Si es por peso, mostrar ejemplo: "Ej: 0.5, 1.250, 2.5"
   - Si es por unidad, bloquear decimales: step="1"

2. FEEDBACK EN TIEMPO REAL:
   - Calcular y mostrar el total mientras el usuario escribe
   - Resaltar si la cantidad es inválida

3. STOCK:
   - Mostrar el stock disponible
   - Si el producto se vende por peso, mostrar: "Stock: 15.5 kg"
   - Si es por unidad, mostrar: "Stock: 20 unidades"

4. FORMATO CONSISTENTE:
   - Cantidades: hasta 3 decimales
   - Precios: siempre 2 decimales
   - Totales: siempre 2 decimales
*/

// ============================================
// 9. INTEGRACIÓN CON EL BACKEND
// ============================================

// Al enviar una venta al backend:
const createSale = async (saleData) => {
  const payload = {
    customer_id: saleData.customerId,
    subtotal: parseFloat(saleData.subtotal.toFixed(2)),
    total_amount: parseFloat(saleData.total.toFixed(2)),
    items: saleData.items.map(item => ({
      product_id: item.productId,
      quantity: parseFloat(item.quantity),  // ← Enviar como número
      unit_price: parseFloat(item.unitPrice.toFixed(2))
    }))
  };
  
  const response = await fetch('/api/sales', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  return response.json();
};

// Ejemplo de datos que se enviarían:
const exampleSaleData = {
  customerId: "abc-123",
  subtotal: 25.75,
  total: 30.39,  // con IGV
  items: [
    {
      productId: "prod-1",
      quantity: 2.5,      // ← Decimal
      unitPrice: 10.30
    },
    {
      productId: "prod-2",
      quantity: 5,        // ← Entero
      unitPrice: 2.50
    }
  ]
};
