/**
 * Frenos del sync.
 *
 * El sync corre solo, de madrugada, y hace commit sobre `main`. Nadie lo mira.
 * Sin frenos, un mal dia del proveedor se convierte en una tienda vacia:
 *
 *   el servidor devuelve un 503  ->  el parser lee cero productos  ->  ningun
 *   producto figura en la lista  ->  los 5.279 activos se ocultan  ->  el
 *   build publica un catalogo vacio  ->  el sitio queda muerto hasta que
 *   alguien lo note.
 *
 * Los limites son deliberadamente holgados: tienen que dejar pasar un dia
 * raro de verdad y frenar solo lo que no puede ser cierto. Un freno que salta
 * seguido se termina desactivando, y entonces no protege nada.
 *
 * Ambas funciones son puras y devuelven una lista de problemas. Vacia = seguir.
 */

export const LIMITES = {
    /** Menos productos que esto no es una lista: es un archivo cortado. */
    minimoProductos: 4000,
    /** Caida maxima tolerada respecto de la corrida anterior. */
    caidaMaxima: 0.15,
    /** Porcion de los activos que puede ocultarse de una sola vez. */
    ocultadosMaximo: 0.10,
    /** Porcion del catalogo que puede borrarse de una sola vez. */
    purgaMaxima: 0.05,
    /** Porcion de los activos que puede saltar de precio de una sola vez. */
    saltosMaximo: 0.05,
    /** Rango plausible del guarani por dolar. */
    tipoDeCambioMin: 3000,
    tipoDeCambioMax: 15000
};

const pct = (n) => `${(n * 100).toFixed(1)}%`;

/**
 * Se corre con la lista ya parseada y antes de tocar el catalogo.
 *
 * @param {object} args
 * @param {number} args.productosEnLista
 * @param {number|null} args.productosEnListaPrevia  de data/meta.json; null la primera vez
 * @param {number} args.tipoDeCambio
 * @param {object} [args.limites]
 * @returns {string[]} problemas; vacio si esta todo bien
 */
export function verificarLista({ productosEnLista, productosEnListaPrevia, tipoDeCambio, limites = LIMITES }) {
    const problemas = [];

    if (!Number.isFinite(productosEnLista) || productosEnLista < limites.minimoProductos) {
        problemas.push(
            `la lista trae ${productosEnLista} productos, por debajo del minimo de ${limites.minimoProductos}. ` +
            'Suele significar que la descarga se corto o que el servidor devolvio una pagina de error.'
        );
    }

    if (Number.isFinite(productosEnListaPrevia) && productosEnListaPrevia > 0) {
        const caida = (productosEnListaPrevia - productosEnLista) / productosEnListaPrevia;
        if (caida > limites.caidaMaxima) {
            problemas.push(
                `caida del ${pct(caida)} respecto de la corrida anterior ` +
                `(${productosEnListaPrevia} -> ${productosEnLista}), maximo tolerado ${pct(limites.caidaMaxima)}.`
            );
        }
    }

    if (!Number.isFinite(tipoDeCambio) ||
        tipoDeCambio < limites.tipoDeCambioMin ||
        tipoDeCambio > limites.tipoDeCambioMax) {
        problemas.push(
            `tipo de cambio fuera de rango: ${tipoDeCambio}. ` +
            `Se espera entre ${limites.tipoDeCambioMin} y ${limites.tipoDeCambioMax} Gs/USD.`
        );
    }

    return problemas;
}

/**
 * Se corre con los cambios ya calculados y todavia sin escribir a disco.
 *
 * @param {object} args
 * @param {object} args.reporte      el de aplicarLista()
 * @param {number} args.activosPrevios
 * @param {number[]} args.purgados
 * @param {number} args.totalPrevio  registros del catalogo antes de purgar
 * @param {object} [args.limites]
 * @returns {string[]} problemas; vacio si esta todo bien
 */
export function verificarCambios({ reporte, activosPrevios, purgados, totalPrevio, limites = LIMITES }) {
    const problemas = [];

    if (activosPrevios > 0) {
        const porcionOculta = reporte.ocultados / activosPrevios;
        if (porcionOculta > limites.ocultadosMaximo) {
            problemas.push(
                `se ocultarian ${reporte.ocultados} de ${activosPrevios} activos (${pct(porcionOculta)}), ` +
                `maximo tolerado ${pct(limites.ocultadosMaximo)}.`
            );
        }

        const porcionSaltos = reporte.saltos.length / activosPrevios;
        if (porcionSaltos > limites.saltosMaximo) {
            problemas.push(
                `${reporte.saltos.length} productos saltarian de precio (${pct(porcionSaltos)} de los activos), ` +
                `maximo tolerado ${pct(limites.saltosMaximo)}. ` +
                'Cuando salta el precio de casi todo, el sospechoso es el tipo de cambio, no el proveedor.'
            );
        }
    }

    if (totalPrevio > 0) {
        const porcionPurga = purgados.length / totalPrevio;
        if (porcionPurga > limites.purgaMaxima) {
            problemas.push(
                `la purga borraria ${purgados.length} de ${totalPrevio} registros (${pct(porcionPurga)}), ` +
                `maximo tolerado ${pct(limites.purgaMaxima)}. Borrar no se deshace.`
            );
        }
    }

    return problemas;
}
