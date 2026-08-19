import { writeFileSync, mkdirSync } from 'node:fs';
import { paginaDeProducto, paginaDeCategoria, paginaDeError } from './plantillas.js';
import { esIndexable } from '../lib/seo.js';
import { CATEGORIAS } from '../lib/taxonomy.js';

const POR_PAGINA = 36;
const RELACIONADOS = 4;

function escribir(ruta, contenido) {
    mkdirSync(ruta.slice(0, ruta.lastIndexOf('/')), { recursive: true });
    writeFileSync(ruta, contenido, 'utf8');
}

/**
 * Genera una pagina estatica por producto y por categoria.
 *
 * Las paginas de producto son autonomas: no descargan el catalogo completo.
 * Una pagina que muestra un producto no tiene por que bajar 157 KB con los
 * otros 5.003, y son justamente las que mas trafico de buscadores reciben.
 */
export function generarPaginas({ publicos, salida, urlBase }) {
    const porCategoria = new Map();
    for (const p of publicos) {
        if (!porCategoria.has(p.category)) porCategoria.set(p.category, []);
        porCategoria.get(p.category).push(p);
    }

    const indexables = [];
    let paginasDeProducto = 0;
    let paginasDeCategoria = 0;
    let conNoindex = 0;

    for (const categoria of CATEGORIAS) {
        const items = porCategoria.get(categoria.id) || [];
        if (items.length === 0) continue;

        for (const p of items) {
            const relacionados = items.filter((x) => x.id !== p.id).slice(0, RELACIONADOS);
            escribir(`${salida}/p/${p.slug}/index.html`,
                paginaDeProducto({ producto: p, categoria, relacionados, urlBase }));
            paginasDeProducto++;
            if (esIndexable(p)) indexables.push(`/p/${p.slug}/`);
            else conNoindex++;
        }

        const totalPaginas = Math.max(1, Math.ceil(items.length / POR_PAGINA));
        for (let n = 1; n <= totalPaginas; n++) {
            const trozo = items.slice((n - 1) * POR_PAGINA, n * POR_PAGINA);
            const ruta = n === 1
                ? `${salida}/c/${categoria.id}/index.html`
                : `${salida}/c/${categoria.id}/${n}/index.html`;
            escribir(ruta, paginaDeCategoria({ categoria, productos: trozo, pagina: n, totalPaginas, urlBase }));
            paginasDeCategoria++;
            // Solo la primera pagina de cada categoria va al sitemap: las
            // siguientes son paginacion, no contenido nuevo.
            if (n === 1) indexables.push(`/c/${categoria.id}/`);
        }
    }

    // Cloudflare Pages sirve /404.html con codigo 404 real para toda URL que
    // no existe, PERO solo si el archivo esta. Sin el cae en modo aplicacion
    // de una sola pagina y responde 200 con la portada, que es lo que Google
    // llama soft 404. No va al sitemap ni a `indexables`.
    //
    // Solo se ofrecen categorias que tienen productos: mandar a alguien desde
    // un error a una categoria vacia es dos callejones sin salida seguidos.
    const conStock = CATEGORIAS.filter((c) => (porCategoria.get(c.id) || []).length > 0);
    escribir(`${salida}/404.html`, paginaDeError({ categorias: conStock, urlBase }));

    return { productos: paginasDeProducto, categorias: paginasDeCategoria, conNoindex, indexables };
}
