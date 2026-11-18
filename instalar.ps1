$ErrorActionPreference = "Stop"

function Write-Step([string]$Message) {
    Write-Host ""
    Write-Host "==> $Message" -ForegroundColor Cyan
}

function Invoke-Checked([string]$Command, [string[]]$Arguments, [string]$WorkingDirectory) {
    Push-Location $WorkingDirectory
    try {
        & $Command @Arguments
        if ($LASTEXITCODE -ne 0) {
            throw "O comando '$Command $($Arguments -join ' ')' terminou com codigo $LASTEXITCODE."
        }
    }
    finally {
        Pop-Location
    }
}

try {
    $repoUrl = "https://github.com/Orizon-Solucoes/gestao-oliveira/archive/refs/heads/main.zip"
    $documents = [Environment]::GetFolderPath("MyDocuments")
    $installRoot = Join-Path $documents "GestaoOliveira"
    $appDirectory = Join-Path $installRoot "Aplicativo"
    $desktop = [Environment]::GetFolderPath("Desktop")
    $shortcutPath = Join-Path $desktop "Gestao Oliveira.lnk"

    Write-Host "============================================" -ForegroundColor DarkGreen
    Write-Host "        INSTALADOR - GESTAO OLIVEIRA" -ForegroundColor Green
    Write-Host "============================================" -ForegroundColor DarkGreen
    Write-Host "Destino: $installRoot"

    $runningApp = Get-CimInstance Win32_Process -Filter "Name = 'Gestao Oliveira.exe'" -ErrorAction SilentlyContinue
    if ($runningApp) {
        throw "O Gestao Oliveira esta aberto. Feche o sistema antes de instalar ou atualizar."
    }

    Write-Step "Verificando Node.js"
    $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
    if (-not $nodeCommand) {
        Write-Host "Node.js nao encontrado. Tentando instalar o Node.js LTS pelo WinGet..." -ForegroundColor Yellow
        $winget = Get-Command winget -ErrorAction SilentlyContinue
        if (-not $winget) {
            throw "O WinGet nao esta disponivel. Atualize o Instalador de Aplicativos (App Installer) da Microsoft Store e execute novamente."
        }
        & $winget.Source install --id OpenJS.NodeJS.LTS --exact --silent --accept-package-agreements --accept-source-agreements
        if ($LASTEXITCODE -ne 0) {
            throw "Nao foi possivel instalar o Node.js pelo WinGet. Codigo: $LASTEXITCODE"
        }
        $nodeFolder = Join-Path $env:ProgramFiles "nodejs"
        if (Test-Path $nodeFolder) { $env:Path = "$nodeFolder;$env:Path" }
        $nodeCommand = Get-Command node -ErrorAction SilentlyContinue
        if (-not $nodeCommand) {
            throw "Node.js foi instalado, mas nao foi localizado nesta sessao. Feche o PowerShell, abra novamente e execute o comando de instalacao."
        }
    }
    Write-Host "Node.js: $(& node --version)" -ForegroundColor Green

    Write-Step "Verificando pnpm"
    $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
    if (-not $pnpmCommand) {
        Write-Host "pnpm nao encontrado. Instalando..." -ForegroundColor Yellow
        $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
        if (-not $npmCommand) { throw "O npm nao foi encontrado junto com o Node.js." }
        & $npmCommand.Source install --global pnpm@10.34.6
        if ($LASTEXITCODE -ne 0) { throw "Falha ao instalar pnpm. Codigo: $LASTEXITCODE" }
        $npmPrefix = (& $npmCommand.Source config get prefix).Trim()
        if ($npmPrefix -and (Test-Path $npmPrefix)) { $env:Path = "$npmPrefix;$env:Path" }
        $pnpmCommand = Get-Command pnpm -ErrorAction SilentlyContinue
        if (-not $pnpmCommand -and $npmPrefix) {
            $pnpmCandidate = Join-Path $npmPrefix "pnpm.cmd"
            if (Test-Path $pnpmCandidate) { $pnpmCommand = Get-Item $pnpmCandidate }
        }
        if (-not $pnpmCommand) { throw "pnpm foi instalado, mas nao foi localizado. Abra um novo PowerShell e execute novamente." }
    }
    $pnpmPath = $pnpmCommand.Source
    if (-not $pnpmPath) { $pnpmPath = $pnpmCommand.Definition }
    Write-Host "pnpm localizado." -ForegroundColor Green

    New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
    $stagingRoot = Join-Path $installRoot ("_instalacao_" + [Guid]::NewGuid().ToString("N"))
    $zipPath = Join-Path $stagingRoot "projeto.zip"
    $extractPath = Join-Path $stagingRoot "extraido"
    New-Item -ItemType Directory -Path $extractPath -Force | Out-Null

    Write-Step "Baixando os arquivos mais recentes do GitHub"
    Invoke-WebRequest -Uri $repoUrl -OutFile $zipPath -UseBasicParsing

    Write-Step "Extraindo o projeto"
    Expand-Archive -LiteralPath $zipPath -DestinationPath $extractPath -Force
    $sourceDirectory = Join-Path $extractPath "gestao-oliveira-main"
    if (-not (Test-Path (Join-Path $sourceDirectory "package.json"))) {
        throw "O pacote baixado nao possui a estrutura esperada do projeto."
    }

    Write-Step "Instalando dependencias do projeto"
    Invoke-Checked $pnpmPath @("install", "--frozen-lockfile") $sourceDirectory

    Write-Step "Compilando o Gestao Oliveira"
    Invoke-Checked $pnpmPath @("build") $sourceDirectory

    $package = Get-Content (Join-Path $sourceDirectory "package.json") -Raw | ConvertFrom-Json
    $version = $package.version
    $executable = Join-Path $sourceDirectory "release\$version\win-unpacked\Gestao Oliveira.exe"
    if (-not (Test-Path $executable)) {
        throw "A compilacao terminou, mas o executavel nao foi encontrado em: $executable"
    }

    Write-Step "Preparando a pasta em Documentos"
    $backupDirectory = Join-Path $installRoot ("Aplicativo-antigo-" + (Get-Date -Format "yyyyMMdd-HHmmss"))
    if (Test-Path $appDirectory) { Move-Item -LiteralPath $appDirectory -Destination $backupDirectory }
    try {
        Move-Item -LiteralPath $sourceDirectory -Destination $appDirectory
    }
    catch {
        if (Test-Path $backupDirectory) { Move-Item -LiteralPath $backupDirectory -Destination $appDirectory }
        throw
    }
    if (Test-Path $backupDirectory) { Remove-Item -LiteralPath $backupDirectory -Recurse -Force }

    $finalExecutable = Join-Path $appDirectory "release\$version\win-unpacked\Gestao Oliveira.exe"
    Write-Step "Criando atalho na Area de Trabalho"
    $shell = New-Object -ComObject WScript.Shell
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $finalExecutable
    $shortcut.WorkingDirectory = Split-Path $finalExecutable
    $shortcut.IconLocation = "$finalExecutable,0"
    $shortcut.Description = "Abrir o sistema Gestao Oliveira"
    $shortcut.Save()

    if (Test-Path $stagingRoot) { Remove-Item -LiteralPath $stagingRoot -Recurse -Force }

    Write-Host ""
    Write-Host "INSTALACAO CONCLUIDA!" -ForegroundColor Green
    Write-Host "Aplicativo: $appDirectory"
    Write-Host "Atalho: $shortcutPath"
    Write-Host "Os dados locais do aplicativo nao foram apagados." -ForegroundColor Green
    Write-Host ""
    $answer = Read-Host "Deseja abrir o Gestao Oliveira agora? (S/N)"
    if ($answer -match "^[Ss]") { Start-Process -FilePath $finalExecutable }
}
catch {
    Write-Host ""
    Write-Host "ERRO: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Nenhum dado local do Gestao Oliveira foi removido."
}
finally {
    Write-Host ""
    Read-Host "Pressione ENTER para fechar"
}
