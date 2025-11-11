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

### Características Principales

✅ **Procesa TODAS las pestañas** del archivo Excel automáticamente  
✅ **Mapeo automático** de columnas en español  
✅ **Creación automática** de categorías si no existen  
✅ **Precios de mayoreo opcionales** (solo crea los niveles con valores)  
✅ **Reporte detallado** de éxitos y errores por fila y pestaña  
✅ **Generación automática** de SKU si no se proporciona  
✅ **Resiliente**: continúa procesando aunque algunas filas fallen

---

## 📊 Formato del Excel

**IMPORTANTE**: El sistema acepta los nombres de columnas **exactamente como los tiene tu cliente**, en español con espacios y mayúsculas iniciales. También acepta nombres técnicos con guiones bajos.

### ⚠️ Nombres Exactos que Detecta el Sistema

El backend normaliza automáticamente (quita acentos, convierte a minúsculas) pero **debe coincidir el texto**:

- ✅ "Nombre del producto" → detectado
- ✅ "Nombre de producto" → detectado
- ✅ "Nombre" → detectado
- ✅ "Categoría" (con o sin acento) → detectado
- ✅ "Mayoreo a partir de 3" → detectado

### Columnas Requeridas

| Columna (Español)                | Columna (Técnica) | Tipo   | Requerido | Descripción              |
| -------------------------------- | ----------------- | ------ | --------- | ------------------------ |
| `Nombre del producto` o `Nombre` | `nombre`          | Texto  | ✅ Sí     | Nombre del producto      |
| `Precio de venta`                | `precio_venta`    | Número | ✅ Sí     | Precio de venta unitario |

### Columnas Opcionales

| Columna (Español)       | Columna (Técnica) | Tipo   | Descripción                                     | Valor por Defecto                        |
| ----------------------- | ----------------- | ------ | ----------------------------------------------- | ---------------------------------------- |
| `Sku`                   | `sku`             | Texto  | Código SKU único                                | Se genera automáticamente (CAT-PRO-0001) |
| `Marca`                 | `marca`           | Texto  | Marca del producto                              | null                                     |
| `Categoria`             | `categoria`       | Texto  | **Se crea automáticamente si no existe**        | null                                     |
| `Unidad`                | `unidad`          | Texto  | Unidad de medida (pieza, kg, litro, etc.)       | "unit"                                   |
| `Precio de compra`      | `precio_compra`   | Número | Precio de costo/compra                          | 0                                        |
| `Cantidad de stock`     | `cantidad_stock`  | Número | Cantidad inicial en stock (soporta decimales)   | 0                                        |
| `Stock minimo`          | `stock_minimo`    | Número | Stock mínimo para alertas (soporta decimales)   | 0                                        |
| `Mayoreo a partir de X` | `mayoreo_X`       | Número | **Precio total** por X unidades ✨ **DINÁMICO** | No se crea si está vacío                 |

**🎯 Mayoreo Dinámico:** Puedes agregar columnas de mayoreo para **cualquier cantidad**:

- `Mayoreo a partir de 3`, `Mayoreo a partir de 6`, `Mayoreo a partir de 25`, `Mayoreo a partir de 50`
- `Mayoreo a partir de 100`, `Mayoreo a partir de 200`, `Mayoreo a partir de 500` ✅
- También acepta: `Mayoreo 100`, `mayoreo_100` (sin "a partir de")
- El sistema detecta automáticamente el número y crea el precio correspondiente

**✨ El sistema normaliza automáticamente los nombres**:

- Convierte a minúsculas
- Elimina acentos
- Ignora espacios extras
- Mapea ambos formatos (español y técnico)

---

## 📝 Ejemplo de Excel

### Hoja 1: "Productos" (Formato del Cliente)

| Nombre de producto         | Marca    | Categoria  | Unidad | Precio de venta | Precio de compra | Cantidad de stock | Stock minimo | Mayoreo a partir de 3 | Mayoreo a partir de 6 | Mayoreo a partir de 25 | Mayoreo a partir de 50 |
| -------------------------- | -------- | ---------- | ------ | --------------- | ---------------- | ----------------- | ------------ | --------------------- | --------------------- | ---------------------- | ---------------------- |
| Cuaderno Profesional       | Scribe   | Papelería  | pieza  | 45.00           | 30.00            | 100               | 20           | 120.00                | 240.00                | 950.00                 | 1800.00                |
| Pluma BIC Cristal Azul     | BIC      | Papelería  | pieza  | 8.00            | 4.50             | 500               | 50           | 21.00                 | 42.00                 |                        |                        |
| Pioner A4 2 anillos Fucsia | Norma    | Carpetas   | pieza  | 85.00           | 55.00            | 50                | 10           |                       | 480.00                | 2000.00                |                        |
| Resistol 850               | Resistol | Pegamentos | pieza  | 35.00           | 22.00            | 75                | 15           | 99.00                 |                       |                        |                        |

### Formato Alternativo (También Aceptado)

También puedes usar los nombres técnicos con guiones bajos:

| nombre               | marca  | categoria | unidad | precio_venta | precio_compra | cantidad_stock | stock_minimo | mayoreo_3 | mayoreo_6 | mayoreo_25 | mayoreo_50 |
| -------------------- | ------ | --------- | ------ | ------------ | ------------- | -------------- | ------------ | --------- | --------- | ---------- | ---------- |
| Cuaderno Profesional | Scribe | Papelería | pieza  | 45.00        | 30.00         | 100            | 20           | 120.00    | 240.00    | 950.00     | 1800.00    |

### Notas Importantes:

- ✅ Las columnas de mayoreo pueden estar vacías si el producto no tiene ese nivel de precio
- ✅ El sistema **solo creará** precios de mayoreo para las columnas que tengan valores
- ✅ **La categoría se crea automáticamente** si no existe en el sistema
- ✅ Si no se proporciona SKU, se generará automáticamente con formato `CAT-PRO-0001`
- ✅ Los valores numéricos pueden tener decimales (ej: 45.50, 0.5, 125.99)
- ✅ Los precios de mayoreo son el **precio total del paquete**, no el precio unitario
- ✅ Si una fila falla, las demás continúan procesándose

---

## 🔄 Actualización de Productos Existentes

**El sistema detecta automáticamente productos duplicados** y los actualiza en lugar de crear copias.

### ¿Cómo detecta duplicados?

Busca por: **Nombre del producto + Marca** (case-insensitive)

### Comportamiento:

**Si el producto YA EXISTE:**

- ✅ **Actualiza** precio de venta, precio de compra, stock, categoría, unidad
- ✅ **Actualiza** precios de mayoreo existentes si vienen en el Excel
- ✅ **Agrega** nuevos precios de mayoreo sin borrar los existentes
- ✅ Retorna `"action": "updated"` en la respuesta

**Si el producto NO EXISTE:**

- ✅ **Crea** un nuevo producto con SKU autogenerado
- ✅ **Crea** todos los precios de mayoreo indicados
- ✅ Retorna `"action": "created"` en la respuesta

### Ejemplo práctico:

**Primera importación (Lunes):**

```
Excel: 50 productos con precios normales
Resultado: 50 productos creados
```

**Segunda importación (Viernes - Promoción):**

```
Excel: Los mismos 50 productos con precios rebajados + 10 productos nuevos
Resultado:
  - 50 productos actualizados (action: "updated")
  - 10 productos nuevos creados (action: "created")
  - Total en DB: 60 productos (no 110 duplicados ✅)
```

**Tercera importación (Lunes siguiente):**

```
Excel: Los 60 productos, precios normales de vuelta
Resultado: 60 productos actualizados con precios originales
```

### Ventajas:

- 🎯 Puedes usar el Excel como "fuente de verdad" y re-importar cuando quieras
- 🔄 Actualiza precios masivamente (Black Friday, cambios de temporada)
- 🧹 Mantiene la base de datos limpia (sin duplicados)
- 📊 Agrega nuevos niveles de mayoreo sin tocar los existentes

---

## 📚 Procesamiento de Múltiples Pestañas

El sistema **procesa automáticamente TODAS las pestañas (sheets)** de tu archivo Excel.

### Ejemplo de Excel con 3 Pestañas

```
📂 MisProductos.xlsx
  ├── 📄 Papelería (50 productos)
  ├── 📄 Librería (30 productos)
  └── 📄 Útiles Escolares (75 productos)
```

**El sistema:**

- ✅ Detecta las 3 pestañas automáticamente
- ✅ Procesa cada una de forma secuencial
- ✅ Registra de qué pestaña viene cada producto
- ✅ Retorna `sheets_processed: 3` en la respuesta
- ✅ Cada producto incluye el campo `"sheet"` con el nombre de la pestaña

**Respuesta esperada:**

```json
{
  "success": true,
  "total_rows": 155,
  "imported": 155,
  "failed": 0,
  "sheets_processed": 3,
  "created_products": [
    {
      "row": 2,
      "sheet": "Papelería",
      "product_name": "Cuaderno Profesional",
      "product_id": "...",
      "bulk_prices_created": 4
    },
    {
      "row": 2,
      "sheet": "Librería",
      "product_name": "Libro de Cuentos",
      "product_id": "...",
      "bulk_prices_created": 0
    },
    {
      "row": 2,
      "sheet": "Útiles Escolares",
      "product_name": "Mochila Escolar",
      "product_id": "...",
      "bulk_prices_created": 2
    }
  ]
}
```

**Ventajas:**

- 🎯 Organiza tus productos por categorías en diferentes pestañas
- 📊 Fácil seguimiento de qué pestaña generó cada producto
- 🔄 Si falla una fila, las demás continúan sin problema

---

## 🔄 Request Example (Frontend)

### Usando FormData

```javascript
const fileInput = document.getElementById("excelFile");
const file = fileInput.files[0];

const formData = new FormData();
formData.append("file", file);

const response = await fetch("http://localhost:3000/api/products/import", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${token}`,
  },
  body: formData,
});

const result = await response.json();
console.log(result);
```

### Usando Axios

```javascript
import axios from "axios";

const handleImport = async (file) => {
  const formData = new FormData();
  formData.append("file", file);

  try {
    const response = await axios.post(
      "http://localhost:3000/api/products/import",
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    console.log("Importación exitosa:", response.data);
  } catch (error) {
    console.error("Error en importación:", error.response.data);
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
  "sheets_processed": 1,
  "errors": [],
  "created_products": [
    {
      "row": 2,
      "sheet": "Hoja1",
      "product_name": "Cuaderno Profesional",
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "created",
      "bulk_prices_created": 4,
      "bulk_prices_updated": 0
    },
    {
      "row": 3,
      "sheet": "Hoja1",
      "product_name": "Pluma BIC Cristal Azul",
      "product_id": "550e8400-e29b-41d4-a716-446655440001",
      "action": "created",
      "bulk_prices_created": 2,
      "bulk_prices_updated": 0
    },
    {
      "row": 4,
      "sheet": "Hoja1",
      "product_name": "Pioner A4 2 anillos Fucsia",
      "product_id": "550e8400-e29b-41d4-a716-446655440002",
      "action": "created",
      "bulk_prices_created": 2,
      "bulk_prices_updated": 0
    },
    {
      "row": 5,
      "sheet": "Hoja1",
      "product_name": "Resistol 850",
      "product_id": "550e8400-e29b-41d4-a716-446655440003",
      "action": "created",
      "bulk_prices_created": 1,
      "bulk_prices_updated": 0
    }
  ]
}
```

**Interpretación:**

- `action`: `"created"` (nuevo) o `"updated"` (actualizado)
- `bulk_prices_created`: Nuevos niveles de mayoreo creados
- `bulk_prices_updated`: Niveles de mayoreo actualizados
- Si `bulk_prices_created: 0` y `bulk_prices_updated: 0` → el producto no tiene precios de mayoreo

````

### Importación Parcial (200 OK con errores)
```json
{
  "success": false,
  "total_rows": 4,
  "imported": 2,
  "failed": 2,
  "sheets_processed": 1,
  "errors": [
    {
      "row": 3,
      "sheet": "Hoja1",
      "product_name": "Desconocido",
      "error": "Campos requeridos faltantes: nombre y precio_venta son obligatorios"
    },
    {
      "row": 5,
      "sheet": "Hoja1",
      "product_name": "Producto Duplicado",
      "error": "Product SKU already exists"
    }
  ],
  "created_products": [
    {
      "row": 2,
      "sheet": "Hoja1",
      "product_name": "Cuaderno Profesional",
      "product_id": "550e8400-e29b-41d4-a716-446655440000",
      "action": "created",
      "bulk_prices_created": 4,
      "bulk_prices_updated": 0
    },
    {
      "row": 4,
      "sheet": "Hoja1",
      "product_name": "Pluma BIC",
      "product_id": "550e8400-e29b-41d4-a716-446655440001",
      "action": "updated",
      "bulk_prices_created": 0,
      "bulk_prices_updated": 2
    }
  ]
}
```

**Interpretación:**
- `success: false` → Hubo al menos un error
- Los productos que sí se pudieron crear/actualizar aparecen en `created_products`
- Los que fallaron aparecen en `errors` con el número de fila y motivo
- Si `product_name: "Desconocido"` → la fila no tenía nombre o no se pudo leer
- `action: "updated"` → El producto ya existía y se actualizó
- `bulk_prices_updated: 2` → Se actualizaron 2 precios de mayoreo existentes

````

### Ejemplo con Mayoreo Dinámico (100 unidades)

```json
{
  "success": true,
  "total_rows": 1,
  "imported": 1,
  "failed": 0,
  "sheets_processed": 1,
  "errors": [],
  "created_products": [
    {
      "row": 2,
      "sheet": "Hoja1",
      "product_name": "Papel Bond Resma 500 hojas",
      "product_id": "550e8400-e29b-41d4-a716-446655440005",
      "action": "created",
      "bulk_prices_created": 5,
      "bulk_prices_updated": 0
    }
  ]
}
```

**Excel utilizado:**
| Nombre del producto | Mayoreo a partir de 3 | Mayoreo a partir de 6 | Mayoreo a partir de 25 | Mayoreo a partir de 100 | Mayoreo a partir de 500 |
|---|---|---|---|---|---|
| Papel Bond Resma 500 hojas | 280.00 | 550.00 | 2200.00 | 8500.00 | 40000.00 |

✨ **El sistema detectó automáticamente la columna "Mayoreo a partir de 100" y "Mayoreo a partir de 500"** y creó los precios correspondientes.

---

## ⚠️ Validaciones y Errores

### Validaciones del Archivo

- ❌ **400 Bad Request**: No se subió ningún archivo
- ❌ **400 Bad Request**: Tipo de archivo inválido (solo .xls y .xlsx)
- ❌ **400 Bad Request**: Archivo mayor a 5MB

### Errores por Fila

- ❌ Campos requeridos faltantes (`nombre` o `precio_venta`)
- ❌ SKU duplicado (si ya existe en la base de datos)
- ❌ Valores numéricos inválidos

### Warnings (no detienen la importación)

- ⚠️ **Categoría se crea automáticamente** si no existe (NUEVO)
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

### ✨ Creación Automática de Categorías (NUEVO)

- Si una categoría **NO existe** en la base de datos, **se crea automáticamente**
- La categoría creada tendrá:
  - `name`: El nombre exacto del Excel
  - `description`: "Categoría importada desde Excel"
  - `is_active`: true
- Puedes ver en los logs del servidor mensajes como:
  ```
  📁 Creando nueva categoría: "Papelería"
  ✅ Categoría creada con ID: abc-123-def
  ```

### Precios de Mayoreo Opcionales

- Solo se crean los precios de mayoreo que tengan valores en el Excel
- Un producto puede tener 0, 1, 2, 3 o 4 niveles de mayoreo
- Si una columna está vacía, null o con valor 0, NO se crea ese nivel
- **Los precios son totales del paquete, no unitarios**
  - Ejemplo: Si "Mayoreo a partir de 3" = 120, significa que 3 unidades cuestan $120 en total

### Manejo de Errores Resiliente

- Si una fila falla, las demás continúan procesándose
- El response incluye detalles de qué filas fallaron y por qué
- Los productos creados exitosamente NO se revierten si otras filas fallan
- Ideal para importaciones grandes donde algunos productos pueden tener errores

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
     showWarning(
       `${result.imported} productos importados, ${result.failed} fallaron`
     );
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
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      alert("Solo se permiten archivos Excel (.xls, .xlsx)");
      return;
    }

    // Validar tamaño
    if (selectedFile.size > 5 * 1024 * 1024) {
      alert("El archivo debe ser menor a 5MB");
      return;
    }

    setFile(selectedFile);
  };

  const handleImport = async () => {
    if (!file) return;

    setLoading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post("/api/products/import", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
      });

      setResult(response.data);

      if (response.data.success) {
        alert(`¡${response.data.imported} productos importados exitosamente!`);
      } else {
        alert(
          `${response.data.imported} productos importados, ${response.data.failed} fallaron`
        );
      }
    } catch (error) {
      alert("Error al importar: " + error.message);
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

      <button onClick={handleImport} disabled={!file || loading}>
        {loading ? "Importando..." : "Importar"}
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
✅ **Automático**: Crea categorías que no existen  
✅ **Tolerante**: Acepta decimales en cantidades y stocks  
✅ **Multilenguaje**: Mapea columnas en español e inglés

---

¿Preguntas? Consulta con el equipo de backend 🚀
