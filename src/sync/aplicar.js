/**
 * Fusion de la lista del proveedor con el catalogo, y purga de lo que ya no
 * existe.
 *
 * Estas dos funciones son PURAS a proposito: no leen disco, no escriben, no
 * imprimen y no mutan lo que reciben. Devuelven un catalogo nuevo y un
 * reporte. Eso es lo que permite el orden que hace seguro al sync:
 *
 *     calcular  ->  verificar el resultado  ->  recien ahi escribir
 *
 * Con la version anterior (`src/migrate/importar-lista.js`) no era posible:
 * mezclaba lectura, calculo, impresion y escritura en un solo script, asi que
 * para saber que iba a pasar habia que dejar que pasara.
 */
import { normalizarTitulo } from '../lib/normalize.js';
import { excluido } from '../lib/exclusiones.js';
import { clasificar, detectarMarca } from '../lib/taxonomy.js';
import { precioFinal } from '../lib/pricing.js';
import { slugDeProducto } from '../lib/slug.js';

/** Un salto de precio por encima de esto se anota en el reporte. */
const SALTO_NOTABLE = 0.15;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * @param {object} args
 * @param {object[]} args.catalogo  catalogo actual (no se modifica)
 * @param {Map<string,{titulo:string,usd:number}>} args.lista
 * @param {string} args.hoy         fecha ISO corta, 'AAAA-MM-DD'
 * @param {object} args.config      pricing.config.json, incluye tipoDeCambio
 * @param {number} args.ultimoId    id mas alto jamas asignado (de data/meta.json)
 * @returns {{catalogo: object[], ultimoId: number, reporte: object}}
 */
export function aplicarLista({ catalogo, lista, hoy, config, ultimoId }) {
    const salida = structuredClone(catalogo);
    const porRef = new Map(salida.map((p) => [String(p.ref), p]));
    const tipoDeCambio = config.tipoDeCambio;

    const reporte = {
        nuevos: 0,
        revividos: 0,
        actualizados: 0,
        sinCambio: 0,
        ocultados: 0,
        sinClasificar: 0,
        categoriaHeredada: 0,
        excluidos: 0,
        excluidosOcultados: 0,
        precioSubio: 0,
        precioBajo: 0,
        saltos: []
    };

    let idSiguiente = ultimoId;

    for (const [ref, item] of lista) {
        const titulo = normalizarTitulo(item.titulo);

        // Lo que no pertenece al rubro no entra, aunque el proveedor lo
        // ofrezca. Va antes de clasificar: si no se vende, no hace falta
        // decidir en que categoria no se vende.
        if (excluido(titulo)) {
            reporte.excluidos++;
            continue;
        }

        const existente = porRef.get(String(ref));

        // Si el titulo deja de clasificar pero el producto YA esta catalogado,
        // se conserva la categoria que tenia. Descartarlo sin mas lo dejaba
        // publicado con el precio congelado para siempre y sin que nada lo
        // reportara: la lista lo tiene, asi que tampoco se ocultaba.
        let categoria = clasificar({ titulo });
        if (!categoria && existente?.category) {
            categoria = existente.category;
            reporte.categoriaHeredada++;
        }
        if (!categoria) {
            reporte.sinClasificar++;
            continue;
        }

        const costo = Math.round(item.usd * tipoDeCambio);
        const precio = precioFinal(costo, categoria, config);
        if (precio === null) continue;

        if (!existente) {
            idSiguiente++;
            const nuevo = {
                id: idSiguiente,
                ref: String(ref),
                slug: slugDeProducto(titulo, idSiguiente),
                title: titulo,
                brand: detectarMarca(titulo) || 'GENERIC',
                category: categoria,
                specs: [],
                price: precio,
                status: 'active',
                firstSeen: hoy,
                lastSeen: hoy
            };
            salida.push(nuevo);
            porRef.set(String(ref), nuevo);
            reporte.nuevos++;
            continue;
        }

        const eraOculto = existente.status !== 'active';
        const precioViejo = existente.price;

        existente.title = titulo;
        existente.slug = slugDeProducto(titulo, existente.id);
        existente.category = categoria;
        if (!existente.brand || existente.brand === 'GENERIC') {
            existente.brand = detectarMarca(titulo) || 'GENERIC';
        }
        if (!Array.isArray(existente.specs)) existente.specs = [];
        existente.price = precio;
        existente.status = 'active';
        existente.lastSeen = hoy;

        if (eraOculto) {
            reporte.revividos++;
        } else if (precioViejo !== precio) {
            reporte.actualizados++;
            if (precio > precioViejo) reporte.precioSubio++;
            else reporte.precioBajo++;
            const delta = Math.abs(precio - precioViejo) / precioViejo;
            if (delta > SALTO_NOTABLE) {
                reporte.saltos.push({ id: existente.id, titulo, antes: precioViejo, despues: precio, delta });
            }
        } else {
            reporte.sinCambio++;
        }
    }

    // Lo que ya estaba publicado y ahora esta excluido se oculta aca, con su
    // propio contador. Si se sumara a `ocultados`, una decision nuestra sobre
    // que vender haria saltar el freno que vigila cuanto stock dio de baja el
    // proveedor: dos cosas distintas medidas con el mismo numero.
    for (const p of salida) {
        if (p.status === 'active' && excluido(p.title)) {
            p.status = 'hidden';
            delete p.price;
            delete p.specs;
            reporte.excluidosOcultados++;
        }
    }

    // Figurar en la lista es lo que define si un producto se ofrece. El que
    // desaparece se oculta, pero NO se le toca lastSeen: esa fecha es la que
    // la purga usa para contar los 30 dias de gracia.
    for (const p of salida) {
        if (p.status === 'active' && !lista.has(String(p.ref))) {
            p.status = 'hidden';
            delete p.price;
            delete p.specs;
            reporte.ocultados++;
        }
    }

    reporte.saltos.sort((a, b) => b.delta - a.delta);
    return { catalogo: salida, ultimoId: idSiguiente, reporte };
}

/**
 * Borra definitivamente los ocultos que llevan `diasGracia` sin aparecer.
 *
 * Ocultar es reversible y barato; borrar no. Los 30 dias existen porque el
 * proveedor da de baja productos temporalmente (sin stock) y los repone: sin
 * el periodo de gracia perderiamos su historial, su id y su imagen cada vez.
 *
 * `maximo` es cuantos se pueden borrar en ESTA corrida. Sin el, la purga
 * proponia borrados que el freno de verificar.js rechazaba, y como el freno
 * aborta el sync entero, el catalogo se quedaba sin actualizar precios hasta
 * que una persona interviniera. El caso concreto: la migracion del 15/08/2026
 * dejo 9.654 registros que la lista del proveedor no volvio a mencionar, y a
 * los 30 dias la purga iba a querer borrar el 63,7% del catalogo de una vez.
 *
 * Con el tope, ese atraso se drena solo, unas cientos por noche, sin que nadie
 * haga nada y sin que el freno tenga que decidir nada.
 *
 * Poner un tope no debilita el freno: para que un producto llegue a la purga
 * tiene que haber estado oculto 30 dias, y ocultar en masa ya tiene su propio
 * freno (`ocultadosMaximo`) que salta mucho antes. Lo unico que el tope deja
 * pasar es un atraso acumulado, que es exactamente lo que hay.
 *
 * @param {object} args
 * @param {object[]} args.catalogo
 * @param {string} args.hoy            fecha ISO corta, 'AAAA-MM-DD'
 * @param {number} [args.diasGracia]
 * @param {number} [args.maximo]       cuantos borrar como mucho en esta corrida
 * @returns {{catalogo: object[], purgados: number[], pendientes: number}}
 */
export function purgar({ catalogo, hoy, diasGracia = 30, maximo = Infinity }) {
    const limite = Date.parse(hoy) - diasGracia * DIA_MS;

    const elegibles = [];
    for (const p of catalogo) {
        if (p.status === 'active') continue;
        if (!p.lastSeen) continue; // sin fecha no se puede decidir: se conserva
        const visto = Date.parse(p.lastSeen);
        if (!Number.isFinite(visto) || visto >= limite) continue;
        elegibles.push(p);
    }

    // El que lleva mas tiempo ausente se va primero. El id desempata para que
    // dos corridas con los mismos datos borren exactamente lo mismo: sin un
    // criterio estable, cual de los 9.654 se borra hoy dependeria del orden
    // en que quedaron en el archivo.
    elegibles.sort((a, b) =>
        a.lastSeen < b.lastSeen ? -1 : a.lastSeen > b.lastSeen ? 1 : a.id - b.id
    );

    const aBorrar = new Set(elegibles.slice(0, maximo).map((p) => p.id));
    const salida = structuredClone(catalogo).filter((p) => !aBorrar.has(p.id));

    return {
        catalogo: salida,
        purgados: [...aBorrar],
        pendientes: elegibles.length - aBorrar.size
    };
}
