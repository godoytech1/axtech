/**
 * Descarga la lista oficial de precios.
 *
 * Es el UNICO modulo del sync que toca la red. Todo lo demas recibe texto ya
 * descargado, y por eso el resto de la suite corre sin conexion.
 *
 * La URL no vive aca ni en ninguna parte del repositorio: contiene el dominio
 * del proveedor y la regla 6 lo prohibe. Llega por `SUPPLIER_LIST_URL`, desde
 * `.env` en local y desde un secreto en el CI.
 *
 * `buscar` se inyecta para poder testear sin red.
 */

/** La lista viene en latin1. Decodificarla como utf8 produce mojibake. */
const CODIFICACION = 'latin1';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Saca el nombre de archivo de una cabecera Content-Disposition.
 *
 * El nombre trae la fecha de generacion de la lista, que sirve para archivarla
 * con su fecha real en vez de la del dia en que se descargo.
 *
 * Devuelve null ante cualquier nombre con separadores de ruta: el valor lo
 * elige el servidor del proveedor y despues se usa para escribir un archivo.
 *
 * @param {string|null|undefined} cabecera
 * @returns {string|null}
 */
export function nombreDesdeCabecera(cabecera) {
    if (typeof cabecera !== 'string') return null;
    const m = /filename\s*=\s*"?([^";]+)"?/i.exec(cabecera);
    if (!m) return null;
    const nombre = m[1].trim();
    if (!nombre || nombre.includes('/') || nombre.includes('\\') || nombre.includes('..')) return null;
    return nombre;
}

/**
 * @param {object} args
 * @param {string} args.url
 * @param {number} [args.intentos=3]
 * @param {number} [args.timeoutMs=60000]
 * @param {number} [args.esperaMs=3000]  espera entre intentos
 * @param {Function} [args.buscar=fetch]
 * @returns {Promise<{texto: string, nombreArchivo: string|null, bytes: number}>}
 */
export async function descargarLista({
    url,
    intentos = 3,
    timeoutMs = 60000,
    esperaMs = 3000,
    buscar = fetch
} = {}) {
    if (!url) throw new Error('falta la URL de la lista (SUPPLIER_LIST_URL).');

    let ultimoError;
    for (let intento = 1; intento <= intentos; intento++) {
        try {
            const corte = AbortSignal.timeout(timeoutMs);
            const res = await buscar(url, { signal: corte, redirect: 'follow' });

            if (!res.ok) throw new Error(`el proveedor respondio ${res.status}`);

            const crudo = Buffer.from(await res.arrayBuffer());
            if (crudo.length === 0) throw new Error('la respuesta llego vacia');

            return {
                texto: crudo.toString(CODIFICACION),
                nombreArchivo: nombreDesdeCabecera(res.headers.get('content-disposition')),
                bytes: crudo.length
            };
        } catch (e) {
            ultimoError = e;
            if (intento < intentos) await dormir(esperaMs);
        }
    }

    throw new Error(`no se pudo descargar la lista tras ${intentos} intento/s: ${ultimoError.message}`);
}
