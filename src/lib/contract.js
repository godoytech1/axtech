import { formatearGs } from './formato.js';
import { rutaPublica } from './imagenes.js';

/**
 * Campos que jamas pueden aparecer ni en data/catalog.json ni en dist/.
 * Revelan el costo, el margen o la identidad del proveedor.
 */
export const CAMPOS_PROHIBIDOS = [
    'pyg_orig',
    'pyg_orig_str',
    'usd',
    'brl',
    'orig_url',
    'title_orig',
    'titleOrig',
    'cost',
    'costo'
];

/**
 * Proyecta un registro del catalogo a la forma que consume el app.js actual.
 *
 * Es una whitelist, no una lista de exclusiones: agregar un campo al catalogo
 * no lo publica salvo que se lo agregue aca explicitamente. Esa es la garantia
 * de que un costo no puede llegar al navegador por descuido.
 *
 * TRANSITORIO - la Fase 1 lo reemplaza por la proyeccion definitiva (§4.2 del
 * documento de diseno), con claves cortas y carga por chunks.
 *
 * @returns el objeto publico, o null si el registro no debe publicarse.
 */
export function aPublicoLegado(registro, { idsSinImagen = new Set() } = {}) {
    if (!registro || registro.status !== 'active') return null;
    if (typeof registro.price !== 'number' || registro.price <= 0) return null;
    // Regla 3 de AGENTS.md: nunca publicar un producto sin imagen real.
    if (idsSinImagen.has(registro.id)) return null;

    return {
        id: registro.id,
        title: registro.title,
        brand: registro.brand,
        category: registro.category,
        image: rutaPublica(registro.id),
        pyg: registro.price,
        pyg_str: formatearGs(registro.price),
        specs: Array.isArray(registro.specs) ? registro.specs : [],
        sob_consulta: false
    };
}
