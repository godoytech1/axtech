import { writeFileSync } from 'node:fs';

// Google admite 50.000 URLs por sitemap. Se segmenta mucho antes para que
// cada archivo sea liviano y facil de reprocesar.
const POR_SITEMAP = 5000;

const urlXml = (loc, hoy) => `  <url><loc>${loc}</loc><lastmod>${hoy}</lastmod></url>`;

export function generarSitemaps({ rutas, salida, urlBase }) {
    const hoy = new Date().toISOString().slice(0, 10);
    const trozos = [];
    for (let i = 0; i < rutas.length; i += POR_SITEMAP) trozos.push(rutas.slice(i, i + POR_SITEMAP));

    const archivos = [];
    trozos.forEach((trozo, i) => {
        const nombre = `sitemap-${i + 1}.xml`;
        const cuerpo = trozo.map((r) => urlXml(`${urlBase}${r}`, hoy)).join('\n');
        writeFileSync(
            `${salida}/${nombre}`,
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${cuerpo}\n</urlset>\n`,
            'utf8'
        );
        archivos.push(nombre);
    });

    const indice = archivos
        .map((a) => `  <sitemap><loc>${urlBase}/${a}</loc><lastmod>${hoy}</lastmod></sitemap>`)
        .join('\n');
    writeFileSync(
        `${salida}/sitemap.xml`,
        `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indice}\n</sitemapindex>\n`,
        'utf8'
    );

    return { archivos: archivos.length, urls: rutas.length };
}
