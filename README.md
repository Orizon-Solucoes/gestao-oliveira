# Gestão Oliveira

Sistema desktop de vendas e controle de caixa, desenvolvido com Electron, React, TypeScript e Vite.

## Instalar no Windows (sem baixar arquivos manualmente)

O instalador baixa automaticamente o projeto da branch `main`, prepara as dependências, compila o aplicativo e cria um atalho na Área de Trabalho. Tudo fica dentro da pasta `Documentos\GestaoOliveira`.

### Instalação

1. Abra o **Windows PowerShell** (não precisa abrir como administrador).
2. Copie e cole o comando abaixo e pressione Enter:

```powershell
Set-ExecutionPolicy -Scope Process Bypass -Force; $script = Join-Path $env:TEMP "Instalar-GestaoOliveira.ps1"; Invoke-WebRequest "https://raw.githubusercontent.com/Orizon-Solucoes/gestao-oliveira/main/instalar.ps1" -OutFile $script; & $script
```

3. Aguarde o processo terminar. Na primeira execução, se necessário, o script instala o Node.js LTS usando o WinGet e instala o pnpm.
4. Quando aparecer a pergunta, digite `S` para abrir o sistema.

O instalador cria:

- `Documentos\GestaoOliveira\Aplicativo` — arquivos do aplicativo.
- `Área de Trabalho\Gestão Oliveira` — atalho para abrir o sistema.

Depois da instalação, basta usar o atalho da Área de Trabalho. Para instalar a versão mais recente publicada na branch `main`, execute novamente o mesmo comando do PowerShell. Feche o aplicativo antes de atualizar.

> O script precisa de internet. A instalação do Node.js pelo WinGet pode solicitar confirmação ou autorização do Windows. O script não altera a política de execução permanentemente.

## Dados locais

Os dados do sistema continuam no diretório de dados do Electron (`app.getPath('userData')`), separado dos arquivos do programa. Reinstalar/atualizar os arquivos do aplicativo não deve apagar os dados locais.

**Não apague manualmente a pasta de dados do aplicativo.** Faça cópias de segurança regulares.

## Desenvolvimento

Com Node.js e pnpm instalados:

```powershell
pnpm install
pnpm dev
```

Para compilar a versão Windows:

```powershell
pnpm build
```

## Tecnologias

- Electron
- React
- TypeScript
- Vite
- pnpm
