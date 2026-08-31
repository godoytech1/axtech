import { formatearGs } from './formato.js';
import { rutaPublica } from './imagenes.js';
import { extraerSpecs } from './specs.js';
import { repararMojibake, traducir } from './normalize.js';

/**
 * Cuantas especificaciones muestra una ficha como maximo.
 *
 * Un monitor Samsung llegaba a veinte lineas, hasta el conector de audio. Una
 * lista asi no se lee: es el mismo volcado del titulo que la ficha viene a
 * ordenar.
 */
const MAXIMO_SPECS = 8;

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
export function aPublicoLegado(registro, { idsSinImagen = new Set(), nombre } = {}) {
    if (!registro || registro.status !== 'active') return null;
    if (typeof registro.price !== 'number' || registro.price <= 0) return null;
    // Regla 3 de AGENTS.md: nunca publicar un producto sin imagen real.
    if (idsSinImagen.has(registro.id)) return null;

    return {
        id: registro.id,
        // El nombre corto lo calcula el build, que ve el catalogo entero y puede
        // desambiguar dos productos que quedarian con el mismo nombre. Sin el,
        // se publica el titulo del proveedor: es feo, pero nunca esta vacio.
        title: nombre || registro.title,
        brand: registro.brand,
        category: registro.category,
        image: rutaPublica(registro.id),
        pyg: registro.price,
        pyg_str: formatearGs(registro.price),
        specs: especificaciones(registro),
        // El titulo ya no dice si el producto viene sin garantia: se saco de ahi
        // a pedido del dueño. La ficha lo necesita igual para no prometer 3
        // meses sobre un OEM que no los tiene.
        sin_garantia: registro.sinGarantia === true,
        sob_consulta: false
    };
}

/**
 * Especificaciones para la ficha rapida del catalogo.
 *
 * Cuando el registro no las trae, se derivan del titulo con el mismo extractor
 * que usan las paginas estaticas. Sin esto, 963 productos mostraban su ficha
 * completa al abrir su pagina y una ficha VACIA al abrir el modal desde la
 * portada: el mismo producto con dos fichas distintas segun por donde se
 * llegara.
 *
 * El titulo es publico, asi que derivar de el no puede filtrar nada.
 */
function especificaciones(registro) {
    // Se extraen del titulo ORIGINAL del proveedor, no del nombre corto: el
    // titulo largo es feo pero es donde estan los datos, y la ficha existe
    // justamente para mostrarlos ordenados. La categoria decide QUE campos se
    // muestran, para que una fuente no liste "Frecuencia" ni un teclado "Socket".
    const derivadas = extraerSpecs(registro.title, registro.category);

    // Las specs guardadas vienen de la migracion del 2026-08-15 y el sync NUNCA
    // las reescribe: solo las inicializa vacias si faltan. Traen detalle que el
    // titulo no tiene ("DDR3 8GB (1x8GB)"), asi que se suman en vez de
    // reemplazarse; pero van despues, porque las derivadas estan etiquetadas y
    // ordenadas por rubro y las viejas son texto suelto.
    //
    // Se normalizan al publicar, no en el dato: el catalogo conserva lo que
    // mando el proveedor.
    const guardadas = Array.isArray(registro.specs)
        ? registro.specs.map((s) => traducir(repararMojibake(s)))
        : [];

    const salida = derivadas.map(({ etiqueta, valor }) => `${etiqueta}: ${valor}`);
    const yaDicho = salida.join(' | ').toLowerCase();
    for (const vieja of guardadas) {
        // Solo si aporta: sin esto la ficha repetia "1600MHz" como dato
        // etiquetado y otra vez como texto suelto de la migracion.
        const nucleo = vieja.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (!nucleo) continue;
        if (yaDicho.replace(/[^a-z0-9]/g, '').includes(nucleo)) continue;
        salida.push(vieja);
    }
    // Ocho alcanza. Un monitor Samsung llegaba a veinte lineas --hasta el
    // conector de audio-- y una lista tan larga no se lee: es el mismo volcado
    // del titulo que la ficha venia a ordenar.
    return salida.slice(0, MAXIMO_SPECS);
}
