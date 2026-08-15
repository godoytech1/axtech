import {
    escaparHtml, descripcionDe, esIndexable,
    jsonLdProducto, jsonLdCategoria, jsonLdTienda, jsonLdMigaDePan
} from '../lib/seo.js';
import { extraerSpecs } from '../lib/specs.js';

const WHATSAPP = '595976914662';

const formatearGs = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function cabecera({ titulo, descripcion, canonical, imagen, indexable, jsonLd }) {
    // El \u003c evita que un "</script>" dentro de un titulo cierre el bloque.
    const bloques = jsonLd
        .map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`)
        .join('\n    ');
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escaparHtml(titulo)}</title>
    <meta name="description" content="${escaparHtml(descripcion)}">
    <link rel="canonical" href="${canonical}">
    ${indexable ? '' : '<meta name="robots" content="noindex,follow">'}
    <meta property="og:type" content="product">
    <meta property="og:title" content="${escaparHtml(titulo)}">
    <meta property="og:description" content="${escaparHtml(descripcion)}">
    <meta property="og:image" content="${imagen}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:site_name" content="AXTECH">
    <meta property="og:locale" content="es_PY">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon_centered.png">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://maxst.icons8.com/vue-static/landings/line-awesome/line-awesome/1.3.0/css/line-awesome.min.css">
    <link rel="stylesheet" href="/index.css">
    ${bloques}
</head>`;
}

function encabezadoDelSitio() {
    return `<header class="header">
    <div class="container header-content">
        <a href="/" class="logo">
            <div class="logo-icon"><img src="/assets/logo.jpg" alt="AXTECH" class="logo-icon-img" width="48" height="48"></div>
            <div class="logo-text">
                <span class="logo-main">AXTECH</span>
                <span class="logo-sub">TECNOLOGÍA &amp; HARDWARE</span>
            </div>
        </a>
        <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener" class="contact-btn">
            <i class="lab la-whatsapp"></i>
            <div class="contact-btn-text"><span class="label">Consultas</span><span class="number">WhatsApp</span></div>
        </a>
    </div>
</header>`;
}

function pieDelSitio() {
    return `<footer class="footer">
    <div class="container footer-bottom-content">
        <p class="copyright">&copy; 2026 AXTECH. Todos los derechos reservados.</p>
        <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">+595 976 914662</a>
    </div>
</footer>`;
}

export function paginaDeProducto({ producto: p, categoria, relacionados, urlBase }) {
    const specs = extraerSpecs(p.title);
    const canonical = `${urlBase}/p/${p.slug}/`;
    const titulo = `${p.title} - ${formatearGs(p.price)} | AXTECH`;
    const mensaje = encodeURIComponent(
        `Hola, quisiera consultar sobre el producto: ${p.title}\nPrecio: ${formatearGs(p.price)}\nLink / Imagen: ${canonical}`
    );

    const migas = [
        { nombre: 'Inicio', ruta: '/' },
        { nombre: categoria.nombre, ruta: `/c/${categoria.id}/` },
        { nombre: p.title, ruta: `/p/${p.slug}/` }
    ];

    const filasDeSpecs = specs.length
        ? `<table class="ficha-specs">
        <caption>Especificaciones</caption>
        ${specs.map((s) => `<tr><th scope="row">${escaparHtml(s.etiqueta)}</th><td>${escaparHtml(s.valor)}</td></tr>`).join('\n        ')}
    </table>`
        : '';

    const tarjetasRelacionadas = relacionados.map((r) => `
            <a class="relacionado" href="/p/${r.slug}/">
                <img src="${r.image}" alt="${escaparHtml(r.title)}" loading="lazy" width="150" height="150">
                <span class="relacionado-titulo">${escaparHtml(r.title)}</span>
                <span class="relacionado-precio">${formatearGs(r.price)}</span>
            </a>`).join('');

    return `${cabecera({
        titulo,
        descripcion: descripcionDe(p),
        canonical,
        imagen: `${urlBase}${p.image}`,
        indexable: esIndexable(p),
        jsonLd: [jsonLdProducto(p, urlBase), jsonLdMigaDePan(migas, urlBase)]
    })}
<body>
${encabezadoDelSitio()}
<main class="container ficha">
    <nav class="migas" aria-label="Ruta de navegación">
        <a href="/">Inicio</a> › <a href="/c/${categoria.id}/">${escaparHtml(categoria.nombre)}</a> › <span>${escaparHtml(p.title)}</span>
    </nav>
    <div class="ficha-cuerpo">
        <div class="ficha-imagen">
            <img src="${p.image}" alt="${escaparHtml(p.title)}" width="400" height="400">
        </div>
        <div class="ficha-datos">
            <p class="ficha-marca">${escaparHtml(p.brand)}</p>
            <h1 class="ficha-titulo">${escaparHtml(p.title)}</h1>
            <p class="ficha-precio">${formatearGs(p.price)}</p>
            <a class="btn btn-success ficha-cta" href="https://wa.me/${WHATSAPP}?text=${mensaje}" target="_blank" rel="noopener">
                <i class="lab la-whatsapp"></i> Consultar por WhatsApp
            </a>
            <p class="ficha-nota">Garantía de 3 meses. Envío con costo adicional a coordinar.</p>
            ${filasDeSpecs}
        </div>
    </div>
    ${relacionados.length ? `<section class="relacionados">
        <h2>Más en ${escaparHtml(categoria.nombre)}</h2>
        <div class="relacionados-grilla">${tarjetasRelacionadas}
        </div>
    </section>` : ''}
</main>
${pieDelSitio()}
</body>
</html>`;
}

export function paginaDeCategoria({ categoria, productos, pagina, totalPaginas, urlBase }) {
    const rutaBase = `/c/${categoria.id}/`;
    const canonical = `${urlBase}${pagina === 1 ? rutaBase : `${rutaBase}${pagina}/`}`;
    const titulo = pagina === 1
        ? `${categoria.nombre} en Paraguay | AXTECH`
        : `${categoria.nombre} - Página ${pagina} | AXTECH`;
    const descripcion = `${categoria.nombre} al mejor precio en AXTECH. ${productos.length} productos disponibles con consulta por WhatsApp.`;

    const migas = [
        { nombre: 'Inicio', ruta: '/' },
        { nombre: categoria.nombre, ruta: rutaBase }
    ];

    const tarjetas = productos.map((p) => `
        <article class="producto">
            <a href="/p/${p.slug}/">
                <img src="${p.image}" alt="${escaparHtml(p.title)}" loading="lazy" width="220" height="220">
                <span class="producto-marca">${escaparHtml(p.brand)}</span>
                <h2 class="producto-titulo">${escaparHtml(p.title)}</h2>
                <span class="producto-precio">${formatearGs(p.price)}</span>
            </a>
        </article>`).join('');

    const anterior = pagina > 1
        ? `<a rel="prev" href="${rutaBase}${pagina === 2 ? '' : pagina - 1 + '/'}">← Anterior</a>` : '';
    const siguiente = pagina < totalPaginas
        ? `<a rel="next" href="${rutaBase}${pagina + 1}/">Siguiente →</a>` : '';

    return `${cabecera({
        titulo,
        descripcion,
        canonical,
        imagen: `${urlBase}${productos[0]?.image || '/assets/logo.jpg'}`,
        indexable: productos.length > 0,
        jsonLd: [jsonLdCategoria(categoria, productos, urlBase), jsonLdMigaDePan(migas, urlBase), jsonLdTienda(urlBase)]
    })}
<body>
${encabezadoDelSitio()}
<main class="container listado">
    <nav class="migas" aria-label="Ruta de navegación">
        <a href="/">Inicio</a> › <span>${escaparHtml(categoria.nombre)}</span>
    </nav>
    <h1>${escaparHtml(categoria.nombre)}</h1>
    <p class="listado-conteo">${productos.length} productos en esta página</p>
    <div class="listado-grilla">${tarjetas}
    </div>
    <nav class="paginacion" aria-label="Paginación">
        ${anterior} <span>Página ${pagina} de ${totalPaginas}</span> ${siguiente}
    </nav>
    <p class="listado-volver"><a href="/">← Ver todo el catálogo</a></p>
</main>
${pieDelSitio()}
</body>
</html>`;
}
