import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, statSync, existsSync } from 'node:fs';
import { aPublicoLegado } from '../lib/contract.js';
import { CATEGORIAS } from '../lib/taxonomy.js';
import { buscarFugas } from './guard.js';

const SALIDA = 'dist';
const ESTATICOS = ['index.html', 'index.css', 'app.js', 'robots.txt', 'sitemap.xml'];

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
// Desde la Fase 1B las imagenes son propias, asi que el dominio del proveedor
// no debe aparecer en NINGUNA parte de lo servido. Si aparece, el build falla
// y el despliegue no ocurre.
const nombreProveedor = process.env.SUPPLIER_NAME;
if (!nombreProveedor) {
    console.warn('AVISO: sin SUPPLIER_NAME no se verifica el dominio del proveedor.');
}
const aRevisar = [`${SALIDA}/products.js`, `${SALIDA}/index.html`, `${SALIDA}/app.js`];
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
console.log(`    dist/products.js - ${(bytes / 1024 / 1024).toFixed(2)} MB`);
