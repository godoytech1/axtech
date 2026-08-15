/**
 * Parser de la lista de precios oficial del proveedor.
 *
 * Formato de ancho fijo, relleno con puntos:
 *
 *   332726......ABRIDOR DE VINHO SMARTFY AV01B 10W BLACK.........U$9,00
 *   ^ref        ^titulo                                          ^precio
 *
 * Los precios usan coma decimal y punto de miles (formato latino):
 * "5.220,00" son cinco mil doscientos veinte.
 *
 * Esta lista es mejor fuente que raspar la web: es completa (5.994 productos
 * contra los 2.511 que alcanzaba el scraper), autoritativa, y no se rompe
 * cuando el proveedor cambia su plantilla HTML.
 *
 * El archivo se guarda fuera del repositorio: contiene costos y el nombre del
 * proveedor.
 */
const LINEA = /^(\d{4,7})\.+(.+?)\.+U\$\s*([\d.,]+)\s*$/;

/** Tipo de cambio de respaldo si no se puede deducir de los datos. */
export const TIPO_DE_CAMBIO_POR_DEFECTO = 6164;

/**
 * @param {string} texto contenido completo del archivo
 * @returns {Map<string, {titulo: string, usd: number}>} indexado por ref
 */
export function parsearLista(texto) {
    const salida = new Map();
    if (typeof texto !== 'string') return salida;

    for (const cruda of texto.split(/\r?\n/)) {
        const linea = cruda.trim();
        if (!linea) continue;
        const m = LINEA.exec(linea);
        if (!m) continue;

        const [, ref, titulo, precioTexto] = m;
        const usd = parseFloat(precioTexto.replace(/\./g, '').replace(',', '.'));
        if (!Number.isFinite(usd) || usd <= 0) continue;

        // Si un ref se repite, gana la ultima aparicion.
        salida.set(ref, { titulo: titulo.trim(), usd });
    }
    return salida;
}
