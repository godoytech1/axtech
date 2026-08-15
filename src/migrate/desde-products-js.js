import { slugDeProducto } from '../lib/slug.js';

const FUSIONES_DE_CATEGORIA = {
    'Relojes Mi Band': 'Relojes Smart'
};

/**
 * Convierte el catalogo legado (products.js) al formato de data/catalog.json.
 *
 * Funcion pura: no toca el sistema de archivos, para poder testearla con
 * conjuntos de datos pequenos.
 *
 * Los registros ocultos se guardan reducidos a sus campos de identidad:
 * preservan la correspondencia id <-> ref que el sync necesita para
 * reconciliar productos entre corridas, sin inflar el archivo con precios
 * y specs que no se van a publicar.
 *
 * @param {object[]} legado registros del products.js viejo
 * @param {{hoy: string}} opciones fecha ISO corta para firstSeen/lastSeen
 * @returns {{catalogo: object[], reporte: object}}
 */
export function migrarCatalogo(legado, { hoy }) {
    const reporte = {
        entrada: legado.length,
        activos: 0,
        ocultos: 0,
        duplicadosEliminados: 0,
        sinTitulo: 0,
        relojesFusionados: 0
    };

    const porRef = new Map();

    for (const viejo of legado) {
        const ref = viejo.ref === undefined || viejo.ref === null ? '' : String(viejo.ref).trim();
        if (!ref) continue;

        const title = typeof viejo.title === 'string' ? viejo.title.trim() : '';
        if (!title) {
            reporte.sinTitulo++;
            continue;
        }

        let category = viejo.category || 'Perifericos';
        if (FUSIONES_DE_CATEGORIA[category]) {
            category = FUSIONES_DE_CATEGORIA[category];
            reporte.relojesFusionados++;
        }

        const precio = typeof viejo.pyg === 'number' ? viejo.pyg : 0;
        const activo = viejo.sob_consulta === false && precio > 0;

        // Orden de claves estable, para que el diff de git sea legible.
        const registro = activo
            ? {
                id: viejo.id,
                ref,
                slug: slugDeProducto(title, viejo.id),
                title,
                brand: viejo.brand || 'GENERIC',
                category,
                specs: Array.isArray(viejo.specs) ? viejo.specs : [],
                price: precio,
                status: 'active',
                firstSeen: hoy,
                lastSeen: hoy
            }
            : {
                id: viejo.id,
                ref,
                slug: slugDeProducto(title, viejo.id),
                title,
                brand: viejo.brand || 'GENERIC',
                category,
                status: 'hidden',
                firstSeen: hoy,
                lastSeen: hoy
            };

        const previo = porRef.get(ref);
        if (previo) {
            reporte.duplicadosEliminados++;
            // Ante un duplicado gana el que tiene precio; si empatan, el primero.
            if (previo.status !== 'active' && registro.status === 'active') {
                porRef.set(ref, registro);
            }
        } else {
            porRef.set(ref, registro);
        }
    }

    const catalogo = [...porRef.values()];
    for (const r of catalogo) {
        if (r.status === 'active') reporte.activos++;
        else reporte.ocultos++;
    }

    return { catalogo, reporte };
}
