# 🚀 Guía de Migración - Cantidades Decimales

## Cuando hagas deploy en VPS

### Opción 1: Si tienes `synchronize: true` (automático)
```bash
# Solo reinicia el contenedor
docker-compose restart nest-api
```
⚠️ **ADVERTENCIA:** `synchronize: true` en producción es peligroso

---

### Opción 2: Ejecutar migración SQL manualmente (RECOMENDADO)

#### Paso 1: Conectarte a tu VPS
```bash
ssh usuario@tu-vps
cd /ruta/a/tu/proyecto
```

#### Paso 2: Ejecutar las migraciones en orden
```bash
# 1. Cambiar quantity en sale_items
docker exec -i nombre-contenedor-postgres psql -U postgres -d lapizpapeldb -c "ALTER TABLE sale_items ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::numeric(12,3);"

# 2. Cambiar quantity en purchase_items
docker exec -i nombre-contenedor-postgres psql -U postgres -d lapizpapeldb -c "ALTER TABLE purchase_items ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::numeric(12,3);"

# 3. Cambiar quantity en inventory_movements
docker exec -i nombre-contenedor-postgres psql -U postgres -d lapizpapeldb -c "ALTER TABLE inventory_movements ALTER COLUMN quantity TYPE NUMERIC(12,3) USING quantity::numeric(12,3);"

# 4. Cambiar stock_quantity en products
docker exec -i nombre-contenedor-postgres psql -U postgres -d lapizpapeldb -c "ALTER TABLE products ALTER COLUMN stock_quantity TYPE NUMERIC(12,3) USING stock_quantity::numeric(12,3);"

# 5. Cambiar minimum_stock en products
docker exec -i nombre-contenedor-postgres psql -U postgres -d lapizpapeldb -c "ALTER TABLE products ALTER COLUMN minimum_stock TYPE NUMERIC(12,3) USING minimum_stock::numeric(12,3);"
```

#### Paso 3: Verificar los cambios
```bash
docker exec -i nombre-contenedor-postgres psql -U postgres -d lapizpapeldb -c "\d sale_items"
```

Deberías ver:
```
quantity | numeric(12,3)
```

#### Paso 4: Reiniciar la API
```bash
docker-compose restart nest-api
# o
docker restart nombre-contenedor-api
```

---

## 🔍 Verificación

### Verificar que los tipos se cambiaron correctamente:
```bash
docker exec -i nombre-contenedor-postgres psql -U postgres -d lapizpapeldb << EOF
SELECT 
  table_name, 
  column_name, 
  data_type, 
  numeric_precision, 
  numeric_scale
FROM information_schema.columns
WHERE table_name IN ('sale_items', 'purchase_items', 'inventory_movements', 'products')
  AND column_name IN ('quantity', 'stock_quantity', 'minimum_stock')
ORDER BY table_name, column_name;
EOF
```

Resultado esperado:
```
inventory_movements | quantity       | numeric | 12 | 3
products           | minimum_stock  | numeric | 12 | 3
products           | stock_quantity | numeric | 12 | 3
purchase_items     | quantity       | numeric | 12 | 3
sale_items         | quantity       | numeric | 12 | 3
```

---

## ⚠️ IMPORTANTE

**SIEMPRE** haz un backup antes de ejecutar migraciones en producción:

```bash
# Backup de la base de datos
docker exec nombre-contenedor-postgres pg_dump -U postgres lapizpapeldb > backup_antes_decimales_$(date +%Y%m%d_%H%M%S).sql
```

Para restaurar si algo sale mal:
```bash
docker exec -i nombre-contenedor-postgres psql -U postgres lapizpapeldb < backup_antes_decimales_YYYYMMDD_HHMMSS.sql
```
