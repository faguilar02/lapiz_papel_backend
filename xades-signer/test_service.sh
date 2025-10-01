#!/bin/bash

# Script de ejemplo para probar el microservicio XAdES Signer
# Asegúrate de tener un certificado PKCS#12 válido para las pruebas

set -e

# Configuración
SERVICE_URL="http://localhost:8080"
CERT_FILE="certificado.p12"  # Cambia por tu archivo de certificado
CERT_PASSWORD="password123"  # Cambia por tu contraseña
XML_FILE="examples/sample_invoice.xml"

echo "🔧 Script de prueba para XAdES Signer"
echo "======================================"

# Verificar que el servicio esté disponible
echo "1. Verificando que el servicio esté disponible..."
if curl -s "$SERVICE_URL/health" > /dev/null; then
    echo "✅ Servicio disponible en $SERVICE_URL"
else
    echo "❌ Error: El servicio no está disponible en $SERVICE_URL"
    echo "   Asegúrate de ejecutar: docker-compose up -d"
    exit 1
fi

# Verificar archivos necesarios
echo ""
echo "2. Verificando archivos necesarios..."

if [ ! -f "$XML_FILE" ]; then
    echo "❌ Error: No se encontró el archivo XML: $XML_FILE"
    exit 1
else
    echo "✅ Archivo XML encontrado: $XML_FILE"
fi

if [ ! -f "$CERT_FILE" ]; then
    echo "⚠️  Advertencia: No se encontró el certificado: $CERT_FILE"
    echo "   Para probar completamente, necesitas un certificado PKCS#12 válido"
    echo "   Creando certificado de prueba..."
    
    # Crear certificado autofirmado para pruebas
    openssl req -x509 -newkey rsa:2048 -keyout temp_key.pem -out temp_cert.pem -days 365 -nodes \
        -subj "/C=PE/ST=Lima/L=Lima/O=Test/OU=Test/CN=test.example.com" 2>/dev/null || {
        echo "❌ Error: No se pudo crear certificado de prueba. Instala openssl."
        exit 1
    }
    
    openssl pkcs12 -export -out "$CERT_FILE" -inkey temp_key.pem -in temp_cert.pem -password pass:$CERT_PASSWORD
    rm temp_key.pem temp_cert.pem
    echo "✅ Certificado de prueba creado: $CERT_FILE"
else
    echo "✅ Certificado encontrado: $CERT_FILE"
fi

# Convertir certificado a base64
echo ""
echo "3. Convirtiendo certificado a base64..."
CERT_BASE64=$(base64 -w 0 "$CERT_FILE")
echo "✅ Certificado convertido a base64 (${#CERT_BASE64} caracteres)"

# Leer y preparar XML
echo ""
echo "4. Preparando documento XML..."
XML_CONTENT=$(cat "$XML_FILE" | sed 's/"/\\"/g' | tr -d '\n')
echo "✅ XML preparado (${#XML_CONTENT} caracteres)"

# Crear JSON de petición
echo ""
echo "5. Creando petición JSON..."
REQUEST_JSON=$(cat <<EOF
{
  "xml": "$XML_CONTENT",
  "p12Base64": "$CERT_BASE64",
  "password": "$CERT_PASSWORD"
}
EOF
)

# Realizar petición de firma
echo ""
echo "6. Enviando petición de firma..."
echo "   URL: $SERVICE_URL/sign-xades"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "$SERVICE_URL/sign-xades" \
    -H "Content-Type: application/json" \
    -d "$REQUEST_JSON")

# Separar respuesta y código HTTP
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
RESPONSE_BODY=$(echo "$RESPONSE" | head -n -1)

echo "   Código HTTP: $HTTP_CODE"

# Analizar respuesta
if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Firma exitosa!"
    
    # Extraer XML firmado
    SIGNED_XML=$(echo "$RESPONSE_BODY" | jq -r '.signedXml' 2>/dev/null || echo "")
    
    if [ -n "$SIGNED_XML" ] && [ "$SIGNED_XML" != "null" ]; then
        # Guardar XML firmado
        OUTPUT_FILE="signed_invoice.xml"
        echo "$SIGNED_XML" > "$OUTPUT_FILE"
        echo "📄 XML firmado guardado en: $OUTPUT_FILE"
        
        # Verificar elementos de la firma
        echo ""
        echo "7. Verificando elementos de la firma..."
        
        if echo "$SIGNED_XML" | grep -q "ds:Signature"; then
            echo "✅ Elemento ds:Signature encontrado"
        else
            echo "❌ Elemento ds:Signature NO encontrado"
        fi
        
        if echo "$SIGNED_XML" | grep -q "xades:QualifyingProperties"; then
            echo "✅ Elemento xades:QualifyingProperties encontrado"
        else
            echo "❌ Elemento xades:QualifyingProperties NO encontrado"
        fi
        
        if echo "$SIGNED_XML" | grep -q "ext:UBLExtensions"; then
            echo "✅ Elemento ext:UBLExtensions encontrado"
        else
            echo "❌ Elemento ext:UBLExtensions NO encontrado"
        fi
        
        if echo "$SIGNED_XML" | grep -q "ds:SignedInfo"; then
            echo "✅ Elemento ds:SignedInfo encontrado"
        else
            echo "❌ Elemento ds:SignedInfo NO encontrado"
        fi
        
        # Contar referencias
        REF_COUNT=$(echo "$SIGNED_XML" | grep -o "ds:Reference" | wc -l)
        echo "📊 Referencias encontradas: $REF_COUNT (esperadas: 2)"
        
        if [ "$REF_COUNT" -eq 2 ]; then
            echo "✅ Número correcto de referencias"
        else
            echo "⚠️  Número inesperado de referencias"
        fi
        
        echo ""
        echo "🎉 ¡Prueba completada exitosamente!"
        echo "   El documento ha sido firmado con XAdES-BES"
        
    else
        echo "❌ Error: No se pudo extraer el XML firmado de la respuesta"
        echo "Respuesta: $RESPONSE_BODY"
    fi
    
elif [ "$HTTP_CODE" = "400" ]; then
    echo "❌ Error de validación (400)"
    ERROR_MSG=$(echo "$RESPONSE_BODY" | jq -r '.error' 2>/dev/null || echo "Error desconocido")
    echo "   Mensaje: $ERROR_MSG"
    
elif [ "$HTTP_CODE" = "500" ]; then
    echo "❌ Error interno del servidor (500)"
    ERROR_MSG=$(echo "$RESPONSE_BODY" | jq -r '.error' 2>/dev/null || echo "Error interno")
    echo "   Mensaje: $ERROR_MSG"
    
else
    echo "❌ Error inesperado (código: $HTTP_CODE)"
    echo "   Respuesta: $RESPONSE_BODY"
fi

echo ""
echo "======================================"
echo "Prueba finalizada"

# Limpiar archivos temporales opcionales
if [ -f "$CERT_FILE" ] && [[ "$CERT_FILE" == *"temp"* ]]; then
    rm -f "$CERT_FILE"
    echo "🧹 Certificado temporal eliminado"
fi