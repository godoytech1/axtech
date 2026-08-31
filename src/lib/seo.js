import { extraerSpecs } from './specs.js';

const WHATSAPP = '595976914662';
const NOMBRE_TIENDA = 'AXTECH';
const LARGO_MINIMO_TITULO = 25;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa para insertar texto dentro de HTML. */
export function escaparHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Decide si una pagina merece indexarse.
 *
 * Google penaliza el dominio entero cuando se le sirven miles de paginas
 * finas. Es preferible tener 3.400 buenas que 5.000 mediocres: las que no
 * califican se generan igual -para que el enlazado interno funcione y el
 * usuario pueda llegar- pero llevan noindex y quedan fuera del sitemap.
 */
export function esIndexable(p) {
    if (!p || typeof p.price !== 'number' || p.price <= 0) return false;
    // El largo se mide sobre el titulo del PROVEEDOR, no sobre el nombre corto.
    //
    // El largo era un proxy de "cuanta informacion hay". Desde que los nombres
    // se limpian, uno corto ya no significa un producto pobre: "AMD Ryzen 5
    // 5500 4.2GHz AM4" tiene 27 caracteres y dice mas que el titulo de 60 del
    // que salio. Medirlo sobre el nombre nuevo saco del sitemap 252 paginas
    // por haberlas mejorado.
    const paraMedir = p.tituloOriginal || p.title;
    if (typeof paraMedir !== 'string' || paraMedir.trim().length < LARGO_MINIMO_TITULO) return false;
    const tieneMarca = Boolean(p.brand) && p.brand !== 'GENERIC';
    // A proposito SIN categoria: aca no se pregunta que se muestra en la ficha
    // sino si el titulo del proveedor trae algun dato. La whitelist por rubro
    // esconde campos que igual existen, y usarla aca mandaba a noindex 388
    // paginas que si tenian contenido.
    return tieneMarca || extraerSpecs(p.tituloOriginal || p.title).length >= 1;
}

const formatearGs = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Meta description: marca, especificaciones si hay, y precio. Max 160 caracteres. */
export function descripcionDe(p) {
    const specs = extraerSpecs(p.tituloOriginal || p.title, p.category).slice(0, 3).map((s) => s.valor).join(', ');
    const detalle = [p.brand && p.brand !== 'GENERIC' ? p.brand : null, specs || null]
        .filter(Boolean).join(' - ');
    const base = detalle
        ? `${detalle}. Precio ${formatearGs(p.price)} en ${NOMBRE_TIENDA}. Consulta por WhatsApp.`
        : `${p.title}. Precio ${formatearGs(p.price)} en ${NOMBRE_TIENDA}. Consulta por WhatsApp.`;
    return base.length <= 160 ? base : base.slice(0, 157) + '...';
}

export function jsonLdProducto(p, urlBase) {
    const specs = extraerSpecs(p.tituloOriginal || p.title, p.category);
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.title,
        description: descripcionDe(p),
        image: `${urlBase}${p.image}`,
        sku: String(p.id),
        // GENERIC es la etiqueta interna de "marca no detectada". Publicarla
        // en los datos estructurados le declaraba a Google un fabricante
        // llamado GENERIC en 1.193 productos.
        brand: { '@type': 'Brand', name: p.brand && p.brand !== 'GENERIC' ? p.brand : NOMBRE_TIENDA },
        ...(specs.length
            ? { additionalProperty: specs.map((s) => ({ '@type': 'PropertyValue', name: s.etiqueta, value: s.valor })) }
            : {}),
        offers: {
            '@type': 'Offer',
            url: `${urlBase}/p/${p.slug}/`,
            priceCurrency: 'PYG',
            price: String(p.price),
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: NOMBRE_TIENDA }
        }
    };
}

export function jsonLdCategoria(categoria, productos, urlBase) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: categoria.nombre,
        numberOfItems: productos.length,
        itemListElement: productos.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${urlBase}/p/${p.slug}/`,
            name: p.title
        }))
    };
}

export function jsonLdTienda(urlBase) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: NOMBRE_TIENDA,
        description: 'Tienda de tecnologia y hardware. Notebooks, tarjetas de video, procesadores y mas.',
        url: urlBase,
        telephone: `+${WHATSAPP}`,
        areaServed: 'PY',
        currenciesAccepted: 'PYG',
        paymentAccepted: 'Transferencia bancaria, Giro, Efectivo',
        openingHours: 'Mo-Fr 08:00-20:00'
    };
}

export function jsonLdMigaDePan(migas, urlBase) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: migas.map((m, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: m.nombre,
            item: `${urlBase}${m.ruta}`
        }))
    };
}
