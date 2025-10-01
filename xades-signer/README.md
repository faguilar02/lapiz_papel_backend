# XAdES Signer - Microservicio de Firma Digital para SUNAT

Microservicio Spring Boot para firmar documentos UBL 2.1 (Facturas, Boletas, Notas de Crédito/Débito) con firma digital XAdES-BES compatible con SUNAT.

## Características

- ✅ Firma XAdES-BES con RSA-SHA256
- ✅ Compatible con documentos UBL 2.1 de SUNAT
- ✅ Inserción automática en UBLExtensions
- ✅ Validación de certificados PKCS#12
- ✅ API REST simple
- ✅ Contenedor Docker

## Endpoints

### Health Check

```
GET /health
```

Respuesta: `200 OK`

### Firma de Documentos

#### Modo 1: Certificado Base64 (Desarrollo/Testing)

```
POST /sign-xades
Content-Type: application/json

{
  "xml": "<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\">...</Invoice>",
  "p12Base64": "MIIC...==",
  "password": "******"
}
```

#### Modo 2: Alias de Certificado (Producción - Recomendado)

```
POST /sign-xades
Content-Type: application/json

{
  "xml": "<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\">...</Invoice>",
  "keyAlias": "cert_prod"
}
```

**Respuesta exitosa:**

```json
{
  "signedXml": "<Invoice>...<ext:UBLExtensions>...<ds:Signature>...</ds:Signature>...</ext:UBLExtensions>...</Invoice>"
}
```

**Respuesta con error:**

```json
{
  "error": "XML inválido"
}
```

```
POST /sign-xades
Content-Type: application/json

{
  "xml": "<Invoice xmlns=\"urn:oasis:names:specification:ubl:schema:xsd:Invoice-2\">...</Invoice>",
  "p12Base64": "MIIC...==",
  "password": "mi-password"
}
```

**Respuesta exitosa:**

```json
{
  "signedXml": "<Invoice>...<ext:UBLExtensions>...<ds:Signature>...</ds:Signature>...</ext:UBLExtensions>...</Invoice>"
}
```

**Respuesta con error:**

```json
{
  "error": "XML inválido"
}
```

## Configuración de Certificados por Alias (Producción)

Para mayor seguridad, se recomienda usar el modo de alias en lugar de enviar certificados en cada petición.

### Configuración con Variables de Entorno

```bash
# Para alias "cert_prod"
export CERT_CERT_PROD_PATH="/app/certs/certificado_produccion.p12"
export CERT_CERT_PROD_PASSWORD="password_seguro_prod"

# Para alias "cert_test"
export CERT_CERT_TEST_PATH="/app/certs/certificado_test.p12"
export CERT_CERT_TEST_PASSWORD="password_test"
```

### Configuración con Docker Compose

```yaml
services:
  xades-signer:
    environment:
      - CERT_PROD_PATH=/app/certs/cert_prod.p12
      - CERT_PROD_PASSWORD=mi_password_prod
      - CERT_TEST_PATH=/app/certs/cert_test.p12
      - CERT_TEST_PASSWORD=mi_password_test
    volumes:
      - ./certificados:/app/certs:ro
```

### Uso con Alias

```bash
# Firmar con certificado de producción
curl -X POST http://xades-signer:8080/sign-xades \
  -H "Content-Type: application/json" \
  -d '{
    "xml": "<?xml version=\"1.0\"?>...",
    "keyAlias": "prod"
  }'

# Firmar con certificado de testing
curl -X POST http://xades-signer:8080/sign-xades \
  -H "Content-Type: application/json" \
  -d '{
    "xml": "<?xml version=\"1.0\"?>...",
    "keyAlias": "test"
  }'
```

## Especificaciones Técnicas

### Algoritmos de Firma

- **SignatureMethod**: RSA-SHA256 (`http://www.w3.org/2001/04/xmldsig-more#rsa-sha256`)
- **DigestMethod**: SHA-256 (`http://www.w3.org/2001/04/xmlenc#sha256`)
- **Canonicalization**: C14N 20010315 (`http://www.w3.org/TR/2001/REC-xml-c14n-20010315`)

### Referencias en SignedInfo

1. **Documento completo** (`URI=""`) con transformaciones:
   - Enveloped Signature
   - Canonicalization C14N
2. **SignedProperties** (`URI="#Id-SignedProperties-1"`) con:
   - Type: `http://uri.etsi.org/01903#SignedProperties`
   - Canonicalization C14N

### Estructura XAdES-BES

- `xades:QualifyingProperties` con `Target="#Id-Signature-1"`
- `xades:SignedProperties` con `Id="Id-SignedProperties-1"`
- `xades:SigningTime` (UTC ISO8601)
- `xades:SigningCertificate` con digest SHA-256 e IssuerSerial
- `ds:KeyInfo/ds:X509Data/ds:X509Certificate` (certificado base64)

### Ubicación de la Firma

La firma se inserta en:

```xml
<ext:UBLExtensions xmlns:ext="urn:oasis:names:specification:ubl:schema:xsd:CommonExtensionComponents-2">
  <ext:UBLExtension>
    <ext:ExtensionContent>
      <ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#">
        <!-- Firma XAdES-BES aquí -->
      </ds:Signature>
    </ext:ExtensionContent>
  </ext:UBLExtension>
</ext:UBLExtensions>
```

## Uso con curl

### 1. Preparar el certificado

```bash
# Convertir certificado a base64 (una sola línea, sin headers)
base64 -w 0 certificado.p12 > cert_base64.txt
```

### 2. Preparar el XML del documento UBL

```bash
cat > invoice.xml << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>2.0</cbc:CustomizationID>
  <cbc:ID>F001-00000001</cbc:ID>
  <cbc:IssueDate>2024-01-15</cbc:IssueDate>
  <cbc:InvoiceTypeCode listAgencyName="PE:SUNAT" listName="Tipo de Documento" listURI="urn:pe:gob:sunat:cpe:see:gem:catalogos:catalogo01">01</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode listID="ISO 4217 Alpha" listName="Currency" listAgencyName="United Nations Economic Commission for Europe">PEN</cbc:DocumentCurrencyCode>
  <!-- Más elementos UBL aquí... -->
</Invoice>
EOF
```

### 3. Realizar la firma

```bash
# Leer certificado base64
P12_BASE64=$(cat cert_base64.txt)

# Crear JSON de petición
cat > request.json << EOF
{
  "xml": "$(cat invoice.xml | sed 's/"/\\"/g' | tr -d '\n')",
  "p12Base64": "$P12_BASE64",
  "password": "mi-password-del-certificado"
}
EOF

# Enviar petición
curl -X POST \
  http://localhost:8080/sign-xades \
  -H "Content-Type: application/json" \
  -d @request.json \
  | jq -r '.signedXml' > invoice_signed.xml
```

### 4. Verificar la firma

```bash
# Verificar que la firma se insertó correctamente
grep -q "ds:Signature" invoice_signed.xml && echo "✅ Firma encontrada"
grep -q "xades:QualifyingProperties" invoice_signed.xml && echo "✅ XAdES encontrado"
grep -q "ext:UBLExtensions" invoice_signed.xml && echo "✅ UBLExtensions encontrado"
```

## Construcción y Despliegue

### Con Maven

```bash
# Compilar
mvn clean package

# Ejecutar
java -jar target/xades-signer-1.0.0.jar
```

### Con Docker (Red Interna)

```bash
# Construir imagen
docker build -t xades-signer:latest .

# Ejecutar con red interna (solo accesible desde otros contenedores)
docker run -d \
  --name xades-signer \
  --network xades-network \
  -e CERT_PROD_PATH=/app/certs/cert.p12 \
  -e CERT_PROD_PASSWORD=mi_password \
  -v ./certs:/app/certs:ro \
  xades-signer:latest

# Ver logs
docker logs -f xades-signer

# Acceder desde otro contenedor en la misma red
curl http://xades-signer:8080/health
```

### Con Docker Compose (Recomendado)

```yaml
version: "3.8"
services:
  xades-signer:
    build: .
    expose:
      - "8080" # Puerto interno, no público
    environment:
      - CERT_PROD_PATH=/app/certs/cert_prod.p12
      - CERT_PROD_PASSWORD=password_seguro
    volumes:
      - ./certificados:/app/certs:ro
    networks:
      - xades-internal

  # Tu aplicación que consume el servicio
  mi-app:
    image: mi-app:latest
    ports:
      - "3000:3000"
    environment:
      - XADES_SIGNER_URL=http://xades-signer:8080
    networks:
      - xades-internal

networks:
  xades-internal:
    driver: bridge
```

## Variables de Entorno

| Variable             | Descripción         | Valor por defecto                                    |
| -------------------- | ------------------- | ---------------------------------------------------- |
| `SERVER_PORT`        | Puerto del servidor | `8080`                                               |
| `JAVA_OPTS`          | Opciones de JVM     | `-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0` |
| `LOGGING_LEVEL_ROOT` | Nivel de logging    | `INFO`                                               |

## Códigos de Error

| Código | Descripción                                                             |
| ------ | ----------------------------------------------------------------------- |
| `200`  | Firma exitosa                                                           |
| `400`  | Error de validación (XML inválido, P12 inválido, contraseña incorrecta) |
| `500`  | Error interno del servidor                                              |

## Seguridad

⚠️ **Importante**: Este microservicio está diseñado para uso en redes internas. No exponer directamente a Internet.

- No se registran passwords ni contenido de certificados en logs
- Validación de entrada estricta
- Manejo seguro de memoria para claves privadas
- Usuario no-root en contenedor Docker

## Requisitos del Sistema

- **Java**: 17 o superior
- **RAM**: Mínimo 512MB, recomendado 1GB
- **CPU**: 1 vCore mínimo
- **Almacenamiento**: 200MB para imagen Docker

## Limitaciones

- Soporte solo para certificados PKCS#12
- Perfil XAdES-BES únicamente (no XAdES-T, XAdES-LT, etc.)
- Sin validación de estructura UBL (solo XML well-formed)
- Sin verificación de revocación de certificados

## Licencia

Este proyecto es de código abierto para uso interno de organizaciones que requieren integración con SUNAT Perú.

## Soporte

Para reportar problemas o solicitar nuevas características, crear un issue en el repositorio del proyecto.
