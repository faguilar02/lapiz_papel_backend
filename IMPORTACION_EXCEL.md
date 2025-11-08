# Guía de Importación Masiva de Productos desde Excel

## 📋 Endpoint

**POST** `/api/products/import`

### Autenticación
- Requiere token JWT
- Solo usuarios con rol `ADMIN`

### Headers
```
Authorization: Bearer <token>
Content-Type: multipart/form-data
```

---

## 📊 Formato del Excel

**IMPORTANTE**: El sistema acepta los nombres de columnas **tal como los tiene tu cliente**, en español con espacios y mayúsculas iniciales. También acepta nombres técnicos con guiones bajos.

### Columnas Requeridas
| Columna (Español) | Columna (Técnica) | Tipo | Requerido | Descripción |
|-------------------|-------------------|------|-----------|-------------|
| `Nombre de producto` o `Nombre` | `nombre` | Texto | ✅ Sí | Nombre del producto |
| `Precio de venta` | `precio_venta` | Número | ✅ Sí | Precio de venta unitario |

### Columnas Opcionales
| Columna (Español) | Columna (Técnica) | Tipo | Descripción | Valor por Defecto |
|-------------------|-------------------|------|-------------|-------------------|
| `Sku` | `sku` | Texto | Código SKU único | Se genera automáticamente |
| `Marca` | `marca` | Texto | Marca del producto | null |
| `Categoria` | `categoria` | Texto | Nombre de la categoría (debe existir) | null |
| `Unidad` | `unidad` | Texto | Unidad de medida | "unit" |
| `Precio de compra` | `precio_compra` | Número | Precio de costo/compra | 0 |
| `Cantidad de stock` | `cantidad_stock` | Número | Cantidad inicial en stock | 0 |
| `Stock minimo` | `stock_minimo` | Número | Stock mínimo para alertas | 0 |
| `Mayoreo a partir de 3` | `mayoreo_3` | Número | Precio total por 3 unidades | No se crea |
| `Mayoreo a partir de 6` | `mayoreo_6` | Número | Precio total por 6 unidades | No se crea |
| `Mayoreo a partir de 25` | `mayoreo_25` | Número | Precio total por 25 unidades | No se crea |
| `Mayoreo a partir de 50` | `mayoreo_50` | Número | Precio total por 50 unidades | No se crea |

**✨ El sistema normaliza automáticamente los nombres**:
- Convierte a minúsculas
- Elimina acentos
- Ignora espacios extras
- Mapea ambos formatos (español y técnico)

---

## 📝 Ejemplo de Excel

### Hoja 1: "Productos" (Formato del Cliente)

| Nombre de producto | Marca | Categoria | Unidad | Precio de venta | Precio de compra | Cantidad de stock | Stock minimo | Mayoreo a partir de 3 | Mayoreo a partir de 6 | Mayoreo a partir de 25 | Mayoreo a partir de 50 |
|-------------------|-------|-----------|--------|-----------------|------------------|-------------------|--------------|-----------------------|-----------------------|------------------------|------------------------|
| Cuaderno Profesional | Scribe | Papelería | pieza | 45.00 | 30.00 | 100 | 20 | 120.00 | 240.00 | 950.00 | 1800.00 |
| Pluma BIC Cristal Azul | BIC | Papelería | pieza | 8.00 | 4.50 | 500 | 50 | 21.00 | 42.00 | | |
| Pioner A4 2 anillos Fucsia | Norma | Carpetas | pieza | 85.00 | 55.00 | 50 | 10 | | 480.00 | 2000.00 | |
| Resistol 850 | Resistol | Pegamentos | pieza | 35.00 | 22.00 | 75 | 15 | 99.00 | | | |

### Formato Alternativo (También Aceptado)

También puedes usar los nombres técnicos con guiones bajos:

| nombre | marca | categoria | unidad | precio_venta | precio_compra | cantidad_stock | stock_minimo | mayoreo_3 | mayoreo_6 | mayoreo_25 | mayoreo_50 |
|--------|-------|-----------|--------|--------------|---------------|----------------|--------------|-----------|-----------|------------|------------|
| Cuaderno Profesional | Scribe | Papelería | pieza | 45.00 | 30.00 | 100 | 20 | 120.00 | 240.00 | 950.00 | 1800.00 |

### Notas Importantes:
- ✅ Las columnas de mayoreo pueden estar vacías si el producto no tiene ese nivel de precio
- ✅ El sistema **solo creará** precios de mayoreo para las columnas que tengan valores
- ✅ La categoría debe existir previamente en el sistema (si no existe, se ignorará)
- ✅ Si no se proporciona SKU, se generará automáticamente
- ✅ Los valores numéricos pueden tener decimales (ej: 45.50)

---

## 🔄 Request Example (Frontend)

### Usando FormData
```javascript
const fileInput = document.getElementById('excelFile');
const file = fileInput.files[0];

const formData = new FormData();
formData.append('file', file);

const response = await fetch('http://localhost:3000/api/products/import', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
console.log(result);
```

### Usando Axios
```javascript
import axios from 'axios';

const handleImport = async (file) => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await axios.post(
      'http://localhost:3000/api/products/import',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    
    console.log('Importación exitosa:', response.data);
  } catch (error) {
    console.error('Error en importación:', error.response.data);
  }
};
```

---

## ✅ Response Example

### Importación Exitosa (200 OK)
```json
{
  "success": true,
  "total_rows": 4,
  "imported": 4,
  "failed": 0,
  "errors": [],
  "created_products": [
    {
      "row": 2,
      "product_name": "Cuaderno Profesional",
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "bulk_prices_created": 4
    },
    {
      "row": 3,
      "product_name": "Pluma BIC Cristal Azul",
      "product_id": "550e8400-e29b-41d4-a716-446655440001",
      "bulk_prices_created": 2
    },
    {
      "row": 4,
      "product_name": "Pioner A4 2 anillos Fucsia",
      "product_id": "550e8400-e29b-41d4-a716-446655440002",
      "bulk_prices_created": 2
    },
    {
      "row": 5,
      "product_name": "Resistol 850",
      "product_id": "550e8400-e29b-41d4-a716-446655440003",
      "bulk_prices_created": 1
    }
  ]
}
```

### Importación Parcial (200 OK con errores)
```json
{
  "success": false,
  "total_rows": 4,
  "imported": 2,
  "failed": 2,
  "errors": [
    {
      "row": 3,
      "product_name": "Producto sin precio",
      "error": "Campos requeridos faltantes: nombre y precio_venta son obligatorios"
    },
    {
      "row": 5,
      "product_name": "Producto Duplicado",
      "error": "Product SKU already exists"
    }
  ],
  "created_products": [
    {
      "row": 2,
      "product_name": "Cuaderno Profesional",
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "bulk_prices_created": 4
    },
    {
      "row": 4,
      "product_name": "Pluma BIC",
      "product_id": "550e8400-e29b-41d4-a716-446655440001",
      "bulk_prices_created": 0
    }
  ]
}
```

---

## ⚠️ Validaciones y Errores

### Validaciones del Archivo
- ❌ **400 Bad Request**: No se subió ningún archivo
- ❌ **400 Bad Request**: Tipo de archivo inválido (solo .xls y .xlsx)
- ❌ **400 Bad Request**: Archivo mayor a 5MB

### Errores por Fila
- ❌ Campos requeridos faltantes (`nombre` o `precio_venta`)
- ❌ SKU duplicado (si ya existe en la base de datos)
- ❌ Categoría no encontrada (se ignora, pero el producto se crea sin categoría)
- ❌ Valores numéricos inválidos

### Warnings (no detienen la importación)
- ⚠️ No se puede crear precio de mayoreo duplicado para la misma cantidad

---

## 🎯 Comportamiento Importante

### Generación Automática de SKU
Si no se proporciona SKU, se genera automáticamente con el formato:
```
[CAT]-[PRO]-[0000]
```
- **CAT**: 3 primeras letras de la categoría (o "GEN" si no tiene)
- **PRO**: 3 primeras letras del producto
- **0000**: Número secuencial de 4 dígitos

Ejemplo: `PAP-CUA-0001` (Papelería - Cuaderno - 0001)

### Precios de Mayoreo Opcionales
- Solo se crean los precios de mayoreo que tengan valores en el Excel
- Un producto puede tener 0, 1, 2, 3 o 4 niveles de mayoreo
- Si una columna está vacía, null o con valor 0, NO se crea ese nivel

### Manejo de Errores Resiliente
- Si una fila falla, las demás continúan procesándose
- El response incluye detalles de qué filas fallaron y por qué
- Los productos creados exitosamente NO se revierten si otras filas fallan

---

## 💡 Recomendaciones para el Frontend

### UI/UX Sugerida
1. **Input File con validación**
   - Solo aceptar .xls y .xlsx
   - Mostrar tamaño del archivo
   - Validar tamaño máximo antes de enviar

2. **Preview antes de importar (opcional)**
   - Leer el Excel en el frontend
   - Mostrar tabla con vista previa
   - Permitir confirmar o cancelar

3. **Progress Indicator**
   - Loading spinner durante la importación
   - Mostrar mensaje "Procesando X productos..."

4. **Resultados de la Importación**
   - Resumen: X de Y productos importados
   - Lista de productos creados exitosamente (verde)
   - Lista de errores con detalles (rojo)
   - Opción para descargar reporte de errores

5. **Manejo de Errores**
   ```javascript
   if (!result.success) {
     showWarning(`${result.imported} productos importados, ${result.failed} fallaron`);
     showErrorDetails(result.errors);
   } else {
     showSuccess(`¡${result.imported} productos importados exitosamente!`);
   }
   ```

### Ejemplo de Componente React
```jsx
const ImportProducts = () => {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    
    // Validar tipo
    const validTypes = [
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ];
    
    if (!validTypes.includes(selectedFile.type)) {
      alert('Solo se permiten archivos Excel (.xls, .xlsx)');
      return;
    }
    
    // Validar tamaño
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert('El archivo debe ser menor a 5MB');
      return;
    }
    
    setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;
    
    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post('/api/products/import', formData, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setResult(response.data);
      
      if (response.data.success) {
        alert(`¡${response.data.imported} productos importados exitosamente!`);
      } else {
        alert(`${response.data.imported} productos importados, ${response.data.failed} fallaron`);
      }
    } catch (error) {
      alert('Error al importar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>Importar Productos desde Excel</h2>
      
      <input 
        type="file" 
        accept=".xls,.xlsx" 
        onChange={handleFileChange}
        disabled={loading}
      />
      
      <button 
        onClick={handleImport} 
        disabled={!file || loading}
      >
        {loading ? 'Importando...' : 'Importar'}
      </button>

      {result && (
        <div>
          <h3>Resultados</h3>
          <p>Total: {result.total_rows}</p>
          <p>Importados: {result.imported}</p>
          <p>Fallidos: {result.failed}</p>
          
          {result.errors.length > 0 && (
            <div>
              <h4>Errores:</h4>
              <ul>
                {result.errors.map((error, idx) => (
                  <li key={idx}>
                    Fila {error.row}: {error.product_name} - {error.error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

## 📥 Plantilla de Excel

Puedes descargar una plantilla de ejemplo con las columnas correctas en:
`/assets/plantilla_importacion_productos.xlsx` (próximamente)

O crear tu propio archivo Excel con las columnas mencionadas en la sección "Formato del Excel".

---

## 🔍 Testing del Endpoint

### Con cURL
```bash
curl -X POST http://localhost:3000/api/products/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "file=@/path/to/productos.xlsx"
```

### Con Postman
1. Método: POST
2. URL: `http://localhost:3000/api/products/import`
3. Headers: `Authorization: Bearer YOUR_TOKEN`
4. Body: `form-data`
   - Key: `file` (tipo: File)
   - Value: Seleccionar archivo Excel

---

## ✨ Ventajas del Sistema

✅ **Flexible**: Soporta productos con o sin precios de mayoreo  
✅ **Resiliente**: Continúa procesando aunque algunas filas fallen  
✅ **Detallado**: Reporte completo de éxitos y errores  
✅ **Escalable**: Puede procesar cientos de productos  
✅ **Seguro**: Solo usuarios ADMIN pueden importar  
✅ **Inteligente**: Genera SKUs automáticamente  

---

¿Preguntas? Consulta con el equipo de backend 🚀
