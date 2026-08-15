import { CAMPOS_PROHIBIDOS } from '../lib/contract.js';

/**
 * Busca fugas de informacion sensible en un texto generado.
 *
 * Los campos se buscan como clave JSON exacta ("campo":) para no confundir
 * un campo prohibido con otro nombre que lo contenga como prefijo
 * (p. ej. "pyg_original" no es "pyg_orig").
 *
 * @param {string} texto contenido a revisar
 * @param {{cadenasProhibidas?: string[]}} opciones
 * @returns {string[]} descripciones de las fugas encontradas; vacio = limpio
 */
export function buscarFugas(texto, { cadenasProhibidas = [] } = {}) {
    const fugas = [];

    for (const campo of CAMPOS_PROHIBIDOS) {
        if (texto.includes(`"${campo}":`)) {
            fugas.push(`campo prohibido en la salida: "${campo}"`);
        }
    }

    for (const cadena of cadenasProhibidas) {
        const limpia = String(cadena).trim();
        if (!limpia) continue;
        if (texto.toLowerCase().includes(limpia.toLowerCase())) {
            fugas.push(`cadena prohibida en la salida: "${limpia}"`);
        }
    }

    return fugas;
}
