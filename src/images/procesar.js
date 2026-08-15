import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ANCHO_MAXIMO = 800;
const CALIDAD = 82;

/**
 * MD5 de la imagen "PRODUTO SEM IMAGEM" del proveedor. Un producto con esta
 * imagen no se publica: la regla 3 de AGENTS.md prohibe mostrar productos sin
 * imagen real.
 */
export const PLACEHOLDER_MD5 = '709f820266febfe1c9c5fe7456a7499e';

/** true si el buffer es la imagen de relleno del proveedor. */
export function esPlaceholder(buffer) {
    return createHash('md5').update(buffer).digest('hex') === PLACEHOLDER_MD5;
}

/**
 * Convierte a WebP y limita el ancho a 800px.
 *
 * withoutEnlargement evita agrandar imagenes que ya son mas chicas: solo
 * sumaria peso sin ganar nitidez.
 */
export async function aWebp(buffer) {
    return sharp(buffer)
        .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
        .webp({ quality: CALIDAD })
        .toBuffer();
}
