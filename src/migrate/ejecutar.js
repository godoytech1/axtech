import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { migrarCatalogo } from './desde-products-js.js';

const ORIGEN = 'products.js';
const DESTINO = 'data/catalog.json';

// El archivo legado es JSON valido una vez removido el prefijo. Se usa
// JSON.parse en vez de eval: sobre 10 MB, eval es lento y ejecuta lo que
// encuentre.
const crudo = readFileSync(ORIGEN, 'utf8');
const soloJson = crudo
    .replace(/^\/\/.*$/m, '')
    .replace('const PRODUCTS =', '')
    .trim()
    .replace(/;\s*$/, '');

const legado = JSON.parse(soloJson);
const hoy = new Date().toISOString().slice(0, 10);
const { catalogo, reporte } = migrarCatalogo(legado, { hoy });

mkdirSync('data', { recursive: true });
writeFileSync(DESTINO, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');

console.log('=== Migracion del catalogo ===');
console.log(`  Entrada:                  ${reporte.entrada}`);
console.log(`  Sin titulo (descartados): ${reporte.sinTitulo}`);
console.log(`  Duplicados eliminados:    ${reporte.duplicadosEliminados}`);
console.log(`  Relojes fusionados:       ${reporte.relojesFusionados}`);
console.log(`  Activos:                  ${reporte.activos}`);
console.log(`  Ocultos:                  ${reporte.ocultos}`);
console.log(`  Total escrito:            ${catalogo.length}`);
console.log(`\nOK -> ${DESTINO}`);
