import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, statSync, existsSync, readdirSync } from 'node:fs';
import { aPublicoLegado } from '../lib/contract.js';
import { CATEGORIAS } from '../lib/taxonomy.js';
import { rutaPublica } from '../lib/imagenes.js';
import { buscarFugas } from './guard.js';
import { generarPaginas } from './paginas.js';
import { generarSitemaps } from './sitemap.js';

const SALIDA = 'dist';
// sitemap.xml ya no se copia: lo genera src/build/sitemap.js.
const ESTATICOS = ['index.html', 'index.css', 'app.js', 'robots.txt'];

// El proveedor ya no interviene en el build: las imagenes son propias y viven
// en public/img/. Los productos cuya imagen era el placeholder del proveedor
// no se publican.
const idsSinImagen = new Set(
    existsSync('data/sin-imagen.json')
        ? JSON.parse(readFileSync('data/sin-imagen.json', 'utf8'))
        : []
);

const catalogo = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const publicos = catalogo
    .map((registro) => aPublicoLegado(registro, { idsSinImagen }))
    .filter((registro) => registro !== null);

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });

for (const archivo of ESTATICOS) {
    cpSync(archivo, `${SALIDA}/${archivo}`);
}
cpSync('assets', `${SALIDA}/assets`, { recursive: true });
cpSync('public/img', `${SALIDA}/img`, { recursive: true });

// Todo lo que este en public/static/ se publica en la RAIZ del sitio. Sirve
// para archivos de verificacion de buscadores (Google Search Console, Bing)
// sin tener que tocar el build cada vez.
if (existsSync('public/static')) {
    cpSync('public/static', SALIDA, { recursive: true });
}

// CATEGORIES viaja junto al catalogo: el front construye la navegacion desde
// la taxonomia en vez de tener la lista escrita a mano en el HTML, que era
// como se desincronizaba (13 categorias en el menu, 18 en los datos).
const contenido =
    '// Catalogo publico de AXTECH. Generado por src/build/index.js - no editar a mano.\n' +
    'const CATEGORIES =\n' + JSON.stringify(CATEGORIAS) + ';\n' +
    'const PRODUCTS =\n' + JSON.stringify(publicos) + ';\n';
writeFileSync(`${SALIDA}/products.js`, contenido, 'utf8');

// --- Paginas estaticas y sitemaps ---
//
// Las paginas se generan desde los registros del CATALOGO, no desde la
// proyeccion publica: esta ultima usa claves del formato legado (`pyg` en vez
// de `price`) y no lleva `slug`, que es justamente la URL de cada pagina.
// El guard verifica igual toda la salida, asi que nada sensible puede colarse.
const urlBase = process.env.SITE_URL || 'https://axtech.pages.dev';
const paraPaginas = catalogo
    .filter((p) => p.status === 'active' && !idsSinImagen.has(p.id))
    .map((p) => ({
        id: p.id,
        slug: p.slug,
        title: p.title,
        brand: p.brand,
        category: p.category,
        price: p.price,
        image: rutaPublica(p.id)
    }));

const { productos: nProd, categorias: nCat, conNoindex, indexables } =
    generarPaginas({ publicos: paraPaginas, salida: SALIDA, urlBase });
const { archivos: nSitemaps, urls: nUrls } =
    generarSitemaps({ rutas: ['/', ...indexables], salida: SALIDA, urlBase });

// El guard corre sobre la salida real.
//
// Desde la Fase 1B las imagenes son propias, asi que el dominio del proveedor
// no debe aparecer en NINGUNA parte de lo servido. Si aparece, el build falla
// y el despliegue no ocurre.
const nombreProveedor = process.env.SUPPLIER_NAME;
if (!nombreProveedor) {
    console.warn('AVISO: sin SUPPLIER_NAME no se verifica el dominio del proveedor.');
}

// El guard recorre TODO lo generado, no una lista fija: con miles de paginas
// nuevas, revisar solo tres archivos dejaria de proteger nada.
function archivosDeTexto(dir) {
    const salida = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = `${dir}/${e.name}`;
        if (e.isDirectory()) salida.push(...archivosDeTexto(ruta));
        else if (/\.(html|js|json|xml|txt|css)$/.test(e.name)) salida.push(ruta);
    }
    return salida;
}
const aRevisar = archivosDeTexto(SALIDA);
const fugas = [];
for (const archivo of aRevisar) {
    const encontradas = buscarFugas(readFileSync(archivo, 'utf8'), {
        cadenasProhibidas: nombreProveedor ? [nombreProveedor] : []
    });
    fugas.push(...encontradas.map((f) => `${archivo}: ${f}`));
}

if (fugas.length > 0) {
    console.error('ERROR: el build encontro fugas de informacion sensible:');
    for (const fuga of fugas) console.error(`   - ${fuga}`);
    process.exit(1);
}

const bytes = statSync(`${SALIDA}/products.js`).size;
console.log(`OK: build completo, ${publicos.length} productos publicados.`);
console.log(`    dist/products.js      ${(bytes / 1024 / 1024).toFixed(2)} MB`);
console.log(`    paginas de producto   ${nProd}   (${conNoindex} con noindex)`);
console.log(`    paginas de categoria  ${nCat}`);
console.log(`    URLs en el sitemap    ${nUrls}   (${nSitemaps} archivo/s)`);
console.log(`    archivos revisados    ${aRevisar.length}`);
