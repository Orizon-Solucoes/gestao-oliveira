$ErrorActionPreference = "Stop"
$installRoot = $PSScriptRoot
$markerPath = Join-Path $installRoot ".commit-instalado"
$installerPath = Join-Path $installRoot "instalar.ps1"
$versionFile = Join-Path $installRoot "package.json"
$installedExe = $null

try {
    $running = Get-Process -Name "Gestao Oliveira" -ErrorAction SilentlyContinue
    if ($running) { exit 0 }

    if (Test-Path $versionFile) {
        $version = (Get-Content $versionFile -Raw | ConvertFrom-Json).version
        $candidate = Join-Path $installRoot "release\$version\win-unpacked\Gestao Oliveira.exe"
        if (Test-Path $candidate) { $installedExe = $candidate }
    }

    Write-Host "Verificando atualizacoes do Gestao Oliveira..." -ForegroundColor Cyan

    try {
        $latest = (Invoke-RestMethod -Uri "https://api.github.com/repos/Orizon-Solucoes/gestao-oliveira/commits/main" -Headers @{ "User-Agent" = "Gestao-Oliveira-Updater" } -TimeoutSec 12).sha
    } catch {
        Write-Host "Sem conexao com GitHub. Abrindo a versao instalada." -ForegroundColor Yellow
        if ($installedExe) { Start-Process -FilePath $installedExe }
        exit 0
    }

    $installedCommit = if (Test-Path $markerPath) { (Get-Content $markerPath -Raw).Trim() } else { "" }

    if ($latest -ne $installedCommit) {
        Write-Host "Atualizacao encontrada. Preparando a nova versao..." -ForegroundColor Green

        if (-not (Test-Path $installerPath)) { throw "Instalador nao encontrado." }

        $tempInstaller = Join-Path $env:TEMP ("GestaoOliveira-Atualizador-" + [Guid]::NewGuid().ToString("N") + ".ps1")
        Copy-Item -LiteralPath $installerPath -Destination $tempInstaller -Force

        # O atualizador roda em outro processo. Assim, este inicializador termina
        # e libera completamente a pasta Aplicativo antes da substituicao.
        $powershell = Join-Path $PSHOME "powershell.exe"
        $arguments = @(
            "-NoProfile",
            "-ExecutionPolicy", "Bypass",
            "-File", $tempInstaller,
            "-Silent",
            "-LaunchAfterInstall"
        )

        Start-Process -FilePath $powershell -ArgumentList $arguments -WorkingDirectory $env:TEMP
        exit 0
    }
    elseif ($installedExe) {
        Start-Process -FilePath $installedExe
    }
    else {
        throw "Executavel instalado nao encontrado."
    }
}
catch {
    Write-Host "Falha na atualizacao: $($_.Exception.Message)" -ForegroundColor Red
    if ($installedExe) { Start-Process -FilePath $installedExe }
    Start-Sleep -Seconds 3
}
