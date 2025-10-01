# Script de backup automático para PostgreSQL en Render
# Uso: .\backup-db.ps1

# Configuración (reemplaza con tus valores de Render)
$DB_HOST = "dpg-xxxxx.oregon-postgres.render.com"  # De Render Dashboard
$DB_PORT = "5432"
$DB_USER = "lapiz_papel_user"                       # De Render Dashboard
$DB_NAME = "lapiz_papel"                            # De Render Dashboard
$DB_PASSWORD = "tu_password_aqui"                   # De Render Dashboard

# Carpeta de backups
$BACKUP_DIR = ".\backups"
if (-not (Test-Path $BACKUP_DIR)) {
    New-Item -ItemType Directory -Path $BACKUP_DIR | Out-Null
}

# Nombre del archivo con timestamp
$TIMESTAMP = Get-Date -Format "yyyyMMdd_HHmmss"
$BACKUP_FILE = "$BACKUP_DIR\backup_$TIMESTAMP.dump"

Write-Host "🔄 Iniciando backup de la base de datos..." -ForegroundColor Cyan

try {
    # Setear password como variable de entorno
    $env:PGPASSWORD = $DB_PASSWORD
    
    # Ejecutar pg_dump
    & pg_dump -h $DB_HOST `
              -p $DB_PORT `
              -U $DB_USER `
              -d $DB_NAME `
              -F c `
              -f $BACKUP_FILE
    
    if ($LASTEXITCODE -eq 0) {
        $fileSize = (Get-Item $BACKUP_FILE).Length / 1MB
        Write-Host "✅ Backup completado: $BACKUP_FILE" -ForegroundColor Green
        Write-Host "📦 Tamaño: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Green
        
        # Limpiar backups antiguos (mantener últimos 7)
        Get-ChildItem -Path $BACKUP_DIR -Filter "backup_*.dump" |
            Sort-Object LastWriteTime -Descending |
            Select-Object -Skip 7 |
            Remove-Item -Force
        
        Write-Host "🗑️  Backups antiguos limpiados (manteniendo últimos 7)" -ForegroundColor Yellow
    } else {
        Write-Host "❌ Error al crear backup" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
    exit 1
} finally {
    # Limpiar variable de password
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}

Write-Host "`n✨ Proceso completado" -ForegroundColor Cyan
