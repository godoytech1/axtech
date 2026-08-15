import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, statSync } from 'node:fs';
import { aPublicoLegado } from '../lib/contract.js';
import { CATEGORIAS } from '../lib/taxonomy.js';
import { buscarFugas } from './guard.js';

const SALIDA = 'dist';
const ESTATICOS = ['index.html', 'index.css', 'app.js', 'robots.txt', 'sitemap.xml'];

const baseImagenes = process.env.SUPPLIER_IMG_BASE;
if (!baseImagenes) {
    console.error('ERROR: falta la variable de entorno SUPPLIER_IMG_BASE.');
    console.error('       Definila en tu archivo .env local o como secreto del CI.');
    process.exit(1);
}

const catalogo = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const publicos = catalogo
    .map((registro) => aPublicoLegado(registro, baseImagenes))
    .filter((registro) => registro !== null);

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });

for (const archivo of ESTATICOS) {
    cpSync(archivo, `${SALIDA}/${archivo}`);
}
cpSync('assets', `${SALIDA}/assets`, { recursive: true });

// CATEGORIES viaja junto al catalogo: el front construye la navegacion desde
// la taxonomia en vez de tener la lista escrita a mano en el HTML, que era
// como se desincronizaba (13 categorias en el menu, 18 en los datos).
const contenido =
    '// Catalogo publico de AXTECH. Generado por src/build/index.js - no editar a mano.\n' +
    'const CATEGORIES =\n' + JSON.stringify(CATEGORIAS) + ';\n' +
    'const PRODUCTS =\n' + JSON.stringify(publicos) + ';\n';
writeFileSync(`${SALIDA}/products.js`, contenido, 'utf8');

// El guard corre sobre la salida real.
//
// En esta fase NO se verifica el dominio del proveedor: las imagenes todavia
// se sirven desde su sitio, asi que su host aparece necesariamente en
// dist/products.js. Esa verificacion se activa en la Fase 1, cuando las
// imagenes pasen a Cloudflare R2.
const aRevisar = [`${SALIDA}/products.js`, `${SALIDA}/index.html`, `${SALIDA}/app.js`];
const fugas = [];
for (const archivo of aRevisar) {
    const encontradas = buscarFugas(readFileSync(archivo, 'utf8'));
    fugas.push(...encontradas.map((f) => `${archivo}: ${f}`));
}

if (fugas.length > 0) {
    console.error('ERROR: el build encontro fugas de informacion sensible:');
    for (const fuga of fugas) console.error(`   - ${fuga}`);
    process.exit(1);
}

const bytes = statSync(`${SALIDA}/products.js`).size;
console.log(`OK: build completo, ${publicos.length} productos publicados.`);
console.log(`    dist/products.js - ${(bytes / 1024 / 1024).toFixed(2)} MB`);
