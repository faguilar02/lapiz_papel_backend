# Script de ejemplo para probar el microservicio XAdES Signer en Windows PowerShell
# Asegúrate de tener un certificado PKCS#12 válido para las pruebas

param(
    [string]$ServiceUrl = "http://localhost:8080",
    [string]$CertFile = "certificado.p12",
    [string]$CertPassword = "password123",
    [string]$XmlFile = "examples\sample_invoice.xml"
)

Write-Host "🔧 Script de prueba para XAdES Signer" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# Verificar que el servicio esté disponible
Write-Host ""
Write-Host "1. Verificando que el servicio esté disponible..." -ForegroundColor Yellow
try {
    $healthResponse = Invoke-RestMethod -Uri "$ServiceUrl/health" -Method Get -TimeoutSec 5
    Write-Host "✅ Servicio disponible en $ServiceUrl" -ForegroundColor Green
} catch {
    Write-Host "❌ Error: El servicio no está disponible en $ServiceUrl" -ForegroundColor Red
    Write-Host "   Asegúrate de ejecutar: docker-compose up -d" -ForegroundColor Red
    exit 1
}

# Verificar archivos necesarios
Write-Host ""
Write-Host "2. Verificando archivos necesarios..." -ForegroundColor Yellow

if (-not (Test-Path $XmlFile)) {
    Write-Host "❌ Error: No se encontró el archivo XML: $XmlFile" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Archivo XML encontrado: $XmlFile" -ForegroundColor Green
}

if (-not (Test-Path $CertFile)) {
    Write-Host "⚠️  Advertencia: No se encontró el certificado: $CertFile" -ForegroundColor Yellow
    Write-Host "   Para probar completamente, necesitas un certificado PKCS#12 válido" -ForegroundColor Yellow
    Write-Host "   Por favor, proporciona un certificado válido o cambia la variable `$CertFile" -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ Certificado encontrado: $CertFile" -ForegroundColor Green
}

# Convertir certificado a base64
Write-Host ""
Write-Host "3. Convirtiendo certificado a base64..." -ForegroundColor Yellow
try {
    $certBytes = [System.IO.File]::ReadAllBytes($CertFile)
    $certBase64 = [System.Convert]::ToBase64String($certBytes)
    Write-Host "✅ Certificado convertido a base64 ($($certBase64.Length) caracteres)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al leer el certificado: $_" -ForegroundColor Red
    exit 1
}

# Leer y preparar XML
Write-Host ""
Write-Host "4. Preparando documento XML..." -ForegroundColor Yellow
try {
    $xmlContent = Get-Content $XmlFile -Raw
    $xmlContent = $xmlContent -replace '"', '\"'
    $xmlContent = $xmlContent -replace "`r`n", ""
    $xmlContent = $xmlContent -replace "`n", ""
    Write-Host "✅ XML preparado ($($xmlContent.Length) caracteres)" -ForegroundColor Green
} catch {
    Write-Host "❌ Error al leer el archivo XML: $_" -ForegroundColor Red
    exit 1
}

# Crear objeto de petición
Write-Host ""
Write-Host "5. Creando petición JSON..." -ForegroundColor Yellow
$requestBody = @{
    xml = $xmlContent
    p12Base64 = $certBase64
    password = $CertPassword
} | ConvertTo-Json -Depth 10

# Realizar petición de firma
Write-Host ""
Write-Host "6. Enviando petición de firma..." -ForegroundColor Yellow
Write-Host "   URL: $ServiceUrl/sign-xades" -ForegroundColor Gray

try {
    $headers = @{
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-RestMethod -Uri "$ServiceUrl/sign-xades" -Method Post -Body $requestBody -Headers $headers
    
    Write-Host "✅ Firma exitosa!" -ForegroundColor Green
    
    if ($response.signedXml) {
        # Guardar XML firmado
        $outputFile = "signed_invoice.xml"
        $response.signedXml | Out-File -FilePath $outputFile -Encoding UTF8
        Write-Host "📄 XML firmado guardado en: $outputFile" -ForegroundColor Green
        
        # Verificar elementos de la firma
        Write-Host ""
        Write-Host "7. Verificando elementos de la firma..." -ForegroundColor Yellow
        
        $signedXml = $response.signedXml
        
        if ($signedXml -match "ds:Signature") {
            Write-Host "✅ Elemento ds:Signature encontrado" -ForegroundColor Green
        } else {
            Write-Host "❌ Elemento ds:Signature NO encontrado" -ForegroundColor Red
        }
        
        if ($signedXml -match "xades:QualifyingProperties") {
            Write-Host "✅ Elemento xades:QualifyingProperties encontrado" -ForegroundColor Green
        } else {
            Write-Host "❌ Elemento xades:QualifyingProperties NO encontrado" -ForegroundColor Red
        }
        
        if ($signedXml -match "ext:UBLExtensions") {
            Write-Host "✅ Elemento ext:UBLExtensions encontrado" -ForegroundColor Green
        } else {
            Write-Host "❌ Elemento ext:UBLExtensions NO encontrado" -ForegroundColor Red
        }
        
        if ($signedXml -match "ds:SignedInfo") {
            Write-Host "✅ Elemento ds:SignedInfo encontrado" -ForegroundColor Green
        } else {
            Write-Host "❌ Elemento ds:SignedInfo NO encontrado" -ForegroundColor Red
        }
        
        # Contar referencias
        $refMatches = [regex]::Matches($signedXml, "ds:Reference")
        $refCount = $refMatches.Count
        Write-Host "📊 Referencias encontradas: $refCount (esperadas: 2)" -ForegroundColor Cyan
        
        if ($refCount -eq 2) {
            Write-Host "✅ Número correcto de referencias" -ForegroundColor Green
        } else {
            Write-Host "⚠️  Número inesperado de referencias" -ForegroundColor Yellow
        }
        
        Write-Host ""
        Write-Host "🎉 ¡Prueba completada exitosamente!" -ForegroundColor Green
        Write-Host "   El documento ha sido firmado con XAdES-BES" -ForegroundColor Green
        
    } else {
        Write-Host "❌ Error: No se pudo extraer el XML firmado de la respuesta" -ForegroundColor Red
        Write-Host "Respuesta: $response" -ForegroundColor Red
    }
    
} catch {
    $statusCode = $_.Exception.Response.StatusCode.Value__
    $errorResponse = $_.Exception.Response
    
    Write-Host "❌ Error en la petición (código: $statusCode)" -ForegroundColor Red
    
    if ($statusCode -eq 400) {
        Write-Host "   Error de validación" -ForegroundColor Red
    } elseif ($statusCode -eq 500) {
        Write-Host "   Error interno del servidor" -ForegroundColor Red
    }
    
    try {
        $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        $errorObj = $errorBody | ConvertFrom-Json
        Write-Host "   Mensaje: $($errorObj.error)" -ForegroundColor Red
    } catch {
        Write-Host "   Error: $_" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "Prueba finalizada" -ForegroundColor Cyan