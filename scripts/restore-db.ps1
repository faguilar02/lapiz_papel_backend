# Script de restauración de backup PostgreSQL
# Uso: .\restore-db.ps1 -BackupFile ".\backups\backup_20250930_150000.dump"

param(
    [Parameter(Mandatory=$true)]
    [string]$BackupFile
)

# Configuración (reemplaza con tus valores de Render)
$DB_HOST = "dpg-xxxxx.oregon-postgres.render.com"
$DB_PORT = "5432"
$DB_USER = "lapiz_papel_user"
$DB_NAME = "lapiz_papel"
$DB_PASSWORD = "tu_password_aqui"

if (-not (Test-Path $BackupFile)) {
    Write-Host "❌ Archivo de backup no encontrado: $BackupFile" -ForegroundColor Red
    exit 1
}

Write-Host "⚠️  ADVERTENCIA: Esto sobrescribirá todos los datos actuales!" -ForegroundColor Yellow
Write-Host "Presiona CTRL+C para cancelar, o cualquier tecla para continuar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host "`n🔄 Iniciando restauración..." -ForegroundColor Cyan

try {
    $env:PGPASSWORD = $DB_PASSWORD
    
    # Restaurar con pg_restore
    & pg_restore -h $DB_HOST `
                 -p $DB_PORT `
                 -U $DB_USER `
                 -d $DB_NAME `
                 --clean `
                 --if-exists `
                 $BackupFile
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Restauración completada exitosamente" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Restauración completada con advertencias (revisa los logs)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "`n✨ Proceso completado" -ForegroundColor Cyan
