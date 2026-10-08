param(
  [string]$DatabaseUrl = "postgresql://postgres:123@127.0.0.1:5432/gatecontrol",
  [string]$AdminLogin = "admin",
  [string]$AdminEmail = "admin@example.local",
  [string]$AdminName = "Администратор",
  [string]$AdminPassword = "admin123"
)

$ErrorActionPreference = "Stop"

$env:DATABASE_URL = $DatabaseUrl
$env:SEED_ADMIN_LOGIN = $AdminLogin
$env:SEED_ADMIN_EMAIL = $AdminEmail
$env:SEED_ADMIN_NAME = $AdminName
$env:SEED_ADMIN_PASSWORD = $AdminPassword
$env:RESET_ADMIN_PASSWORD = "true"

if (-not (Test-Path "node_modules")) {
  npm install
}

npm run db:setup

Write-Host "Database initialized."
Write-Host "Admin login: $AdminLogin"
Write-Host "Admin password: $AdminPassword"
