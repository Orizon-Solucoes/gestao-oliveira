import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const encodedIcon = readFileSync(path.join(root, 'build-assets', 'gestao-oliveira.ico.base64'), 'utf8').trim()
const icon = Buffer.from(encodedIcon, 'base64')
if (icon.length < 100 || icon.toString('ascii', 0, 4) !== '\u0000\u0000\u0001\u0000') {
  throw new Error('O arquivo do ícone do Gestão Oliveira está inválido.')
}
mkdirSync(path.join(root, 'public'), { recursive: true })
writeFileSync(path.join(root, 'public', 'icon.ico'), icon)
console.log('Ícone do Gestão Oliveira preparado para o Windows.')
