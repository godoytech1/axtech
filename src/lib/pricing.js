import { readFileSync } from 'node:fs';

const RUTA_CONFIG = 'config/pricing.config.json';

// Categorias que en el modelo VIEJO llevaban +150.000. Se conservan con sus
// nombres de entonces porque solo sirven para invertir la formula legada.
const ESPECIALES_LEGADO = new Set(['Tarjetas de Video', 'Procesadores', 'Memorias RAM']);

/**
 * Carga los porcentajes de margen.
 *
 * El archivo NO se versiona: la formula es invertible, asi que publicar los
 * porcentajes equivale a publicar los costos. En CI se materializa desde el
 * secreto PRICING_CONFIG.
 */
export function cargarConfig() {
    const config = process.env.PRICING_CONFIG
        ? JSON.parse(process.env.PRICING_CONFIG)
        : JSON.parse(readFileSync(RUTA_CONFIG, 'utf8'));

    const problemas = validarConfig(config);
    if (problemas.length) {
        throw new Error(`configuracion de precios invalida:\n  - ${problemas.join('\n  - ')}`);
    }
    return config;
}

/**
 * Verifica que la configuracion sea utilizable ANTES de calcular un precio.
 *
 * Se valida al cargar, no en un test: el archivo real es un secreto que no
 * existe en CI, asi que ningun test puede mirarlo. Y una config a medias no
 * rompe nada de forma visible — simplemente publica precios equivocados, que
 * es la peor forma de fallar en una tienda.
 *
 * @param {object} config
 * @returns {string[]} problemas; vacio si esta bien
 */
export function validarConfig(config) {
    const problemas = [];
    if (!config || typeof config !== 'object') return ['no es un objeto'];

    const tc = config.tipoDeCambio;
    if (typeof tc !== 'number' || !Number.isFinite(tc) || tc < 3000 || tc > 15000) {
        problemas.push(`tipoDeCambio fuera de rango (3000-15000 Gs/USD): ${tc}`);
    }
    for (const campo of ['umbralBarato', 'minimoBarato', 'minimoBase']) {
        const v = config[campo];
        if (typeof v !== 'number' || !Number.isFinite(v) || v <= 0) {
            problemas.push(`${campo} debe ser un numero positivo: ${v}`);
        }
    }
    if (!config.pct || typeof config.pct !== 'object') {
        problemas.push('falta el mapa pct de porcentajes por categoria');
    } else if (typeof config.pct.default !== 'number') {
        // Sin default, una categoria nueva daria precio NaN y se publicaria.
        problemas.push('pct.default es obligatorio: sin el, una categoria nueva da precio NaN');
    }
    return problemas;
}

/**
 * Precio de venta segun el modelo hibrido: costo + max(minimo, costo * pct).
 *
 * El maximo entre un piso fijo y un porcentaje garantiza ganancia razonable
 * tanto en un cable de 50.000 como en una placa de 25.000.000. El modelo viejo
 * de recargo fijo daba 0,5% de margen en los productos caros y 1622% en los
 * mas baratos.
 *
 * El redondeo al millar superior existe porque "Gs. 1.067.683" en una tarjeta
 * de producto se lee como un error del sistema, no como un precio.
 *
 * @returns precio multiplo de 1000, o null si el costo no es valido.
 */
export function precioFinal(costo, categoria, config) {
    if (typeof costo !== 'number' || !Number.isFinite(costo) || costo <= 0) return null;
    const pct = config.pct[categoria] ?? config.pct.default;
    const minimo = costo < config.umbralBarato ? config.minimoBarato : config.minimoBase;
    const bruto = costo + Math.max(minimo, costo * pct);
    return Math.ceil(bruto / 1000) * 1000;
}

/**
 * Reconstruye el costo a partir de un precio calculado con la formula vieja:
 *
 *   costo < 200.000     -> precio = costo +  50.000
 *   categoria especial  -> precio = costo + 150.000
 *   resto               -> precio = costo + 100.000
 *
 * Las tres ramas producen rangos de precio DISJUNTOS, asi que la inversion es
 * exacta. Verificado sobre los 2.524 activos: 2.524 reconstruibles, 0 ambiguos,
 * 0 en rango imposible.
 *
 * SOLO para la migracion unica de la Fase 1A: la Fase 0 borro los costos y el
 * modelo nuevo los necesita. Desde la Fase 4 el costo llega fresco del scraper
 * y esta funcion deja de usarse.
 *
 * @returns el costo, o null si el precio no pudo generarse con esa formula.
 */
export function costoDesdePrecioLegado(precio, categoriaLegada) {
    if (typeof precio !== 'number' || !Number.isFinite(precio) || precio <= 0) return null;
    const recargoAlto = ESPECIALES_LEGADO.has(categoriaLegada) ? 150000 : 100000;

    const candidatos = [];
    const barato = precio - 50000;
    if (barato > 0 && barato < 200000) candidatos.push(barato);
    const alto = precio - recargoAlto;
    if (alto >= 200000) candidatos.push(alto);

    return candidatos.length === 1 ? candidatos[0] : null;
}
