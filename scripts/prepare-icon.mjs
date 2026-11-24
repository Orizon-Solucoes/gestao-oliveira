import { writeFileSync, mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const size = 256
const pixelBytes = size * size * 4
const maskStride = Math.ceil(size / 32) * 4
const maskBytes = maskStride * size
const dibBytes = 40 + pixelBytes + maskBytes
const imageOffset = 6 + 16
const icon = Buffer.alloc(imageOffset + dibBytes)

// ICO header and one 256x256, 32-bit BMP image.
icon.writeUInt16LE(0, 0)
icon.writeUInt16LE(1, 2)
icon.writeUInt16LE(1, 4)
icon[6] = 0
icon[7] = 0
icon[8] = 1
icon[9] = 0
icon.writeUInt16LE(1, 10)
icon.writeUInt16LE(32, 12)
icon.writeUInt32LE(dibBytes, 14)
icon.writeUInt32LE(imageOffset, 18)

const dib = imageOffset
icon.writeUInt32LE(40, dib)
icon.writeInt32LE(size, dib + 4)
icon.writeInt32LE(size * 2, dib + 8)
icon.writeUInt16LE(1, dib + 12)
icon.writeUInt16LE(32, dib + 14)
icon.writeUInt32LE(0, dib + 16)
icon.writeUInt32LE(pixelBytes, dib + 20)
icon.writeInt32LE(2835, dib + 24)
icon.writeInt32LE(2835, dib + 28)
icon.writeUInt32LE(0, dib + 32)
icon.writeUInt32LE(0, dib + 36)

const bg = [24, 29, 25, 255] // charcoal, BGRA
const olive = [91, 125, 53, 255]
const white = [245, 245, 238, 255]
const pixels = Buffer.alloc(pixelBytes)
for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const i = ((size - 1 - y) * size + x) * 4
    const rounded = (x >= 30 && x <= 225 && y >= 30 && y <= 225)
    const cornerX = x < 64 ? 64 - x : x > 191 ? x - 191 : 0
    const cornerY = y < 64 ? 64 - y : y > 191 ? y - 191 : 0
    const inside = rounded && cornerX * cornerX + cornerY * cornerY <= 34 * 34
    const cartFrame = (y >= 83 && y <= 91 && x >= 67 && x <= 88) ||
      (x >= 83 && x <= 91 && y >= 84 && y <= 166) ||
      (y >= 158 && y <= 166 && x >= 88 && x <= 190) ||
      (y >= 107 && y <= 115 && x >= 91 && x <= 202) ||
      (x >= 194 && x <= 202 && y >= 107 && y <= 157)
    const cartBasket = y >= 116 && y <= 151 && x >= 96 && x <= 190 &&
      (x - 96 < (y - 114) * 0.45 || x > 184 - (y - 114) * 0.15)
    const wheel1 = (x - 112) ** 2 + (y - 185) ** 2 <= 10 ** 2
    const wheel2 = (x - 177) ** 2 + (y - 185) ** 2 <= 10 ** 2
    const isWhite = cartFrame || cartBasket
    const color = !inside ? [0, 0, 0, 0] : (wheel1 || wheel2 ? olive : isWhite ? white : bg)
    pixels[i] = color[0]
    pixels[i + 1] = color[1]
    pixels[i + 2] = color[2]
    pixels[i + 3] = color[3]
  }
}
pixels.copy(icon, dib + 40)
// The zeroed AND mask makes all pixels opaque according to the alpha channel.
mkdirSync(path.join(root, 'public'), { recursive: true })
writeFileSync(path.join(root, 'public', 'icon.ico'), icon)
console.log('Ícone ICO 256x256 do Gestão Oliveira preparado para o Windows.')
