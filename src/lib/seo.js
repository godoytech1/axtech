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
    if (typeof p.title !== 'string' || p.title.trim().length < LARGO_MINIMO_TITULO) return false;
    const tieneMarca = Boolean(p.brand) && p.brand !== 'GENERIC';
    return tieneMarca || extraerSpecs(p.title).length >= 1;
}

const formatearGs = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Meta description: marca, especificaciones si hay, y precio. Max 160 caracteres. */
export function descripcionDe(p) {
    const specs = extraerSpecs(p.title).slice(0, 3).map((s) => s.valor).join(', ');
    const detalle = [p.brand && p.brand !== 'GENERIC' ? p.brand : null, specs || null]
        .filter(Boolean).join(' - ');
    const base = detalle
        ? `${detalle}. Precio ${formatearGs(p.price)} en ${NOMBRE_TIENDA}. Consulta por WhatsApp.`
        : `${p.title}. Precio ${formatearGs(p.price)} en ${NOMBRE_TIENDA}. Consulta por WhatsApp.`;
    return base.length <= 160 ? base : base.slice(0, 157) + '...';
}

export function jsonLdProducto(p, urlBase) {
    const specs = extraerSpecs(p.title);
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.title,
        description: descripcionDe(p),
        image: `${urlBase}${p.image}`,
        sku: String(p.id),
        brand: { '@type': 'Brand', name: p.brand || NOMBRE_TIENDA },
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
