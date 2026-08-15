import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { parsearLista, TIPO_DE_CAMBIO_POR_DEFECTO } from '../lib/lista-precios.js';
import { normalizarTitulo } from '../lib/normalize.js';
import { clasificar, detectarMarca, CATEGORIAS } from '../lib/taxonomy.js';
import { precioFinal, cargarConfig } from '../lib/pricing.js';
import { slugDeProducto } from '../lib/slug.js';

const RUTA_CATALOGO = 'data/catalog.json';
const DIR_LISTAS = '.local-legacy/listas-proveedor';
const APLICAR = process.argv.includes('--aplicar');

const fmt = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const archivos = readdirSync(DIR_LISTAS).filter((f) => f.endsWith('.txt')).sort();
if (archivos.length === 0) {
    console.error(`ERROR: no hay ninguna lista en ${DIR_LISTAS}/`);
    process.exit(1);
}
const archivo = archivos[archivos.length - 1];
const lista = parsearLista(readFileSync(`${DIR_LISTAS}/${archivo}`, 'latin1'));
console.log(`Lista: ${archivo}  (${lista.size} productos con precio)\n`);

const catalogo = JSON.parse(readFileSync(RUTA_CATALOGO, 'utf8'));
const config = cargarConfig();
const porRef = new Map(catalogo.map((p) => [String(p.ref), p]));
const hoy = new Date().toISOString().slice(0, 10);
const tipoDeCambio = TIPO_DE_CAMBIO_POR_DEFECTO;
console.log(`Tipo de cambio aplicado: ${tipoDeCambio} Gs/USD\n`);

const rep = {
    nuevos: 0, revividos: 0, actualizados: 0, sinCambio: 0,
    ocultadosPorAusencia: 0, sinClasificar: 0, precioSubio: 0, precioBajo: 0
};
const cambiosGrandes = [];
let maxId = Math.max(...catalogo.map((p) => p.id || 0), 0);

for (const [ref, item] of lista) {
    const titulo = normalizarTitulo(item.titulo);
    const categoria = clasificar({ titulo });
    if (!categoria) { rep.sinClasificar++; continue; }

    const costo = Math.round(item.usd * tipoDeCambio);
    const precio = precioFinal(costo, categoria, config);
    if (precio === null) continue;

    const existente = porRef.get(ref);

    if (!existente) {
        maxId++;
        const nuevo = {
            id: maxId,
            ref,
            slug: slugDeProducto(titulo, maxId),
            title: titulo,
            brand: detectarMarca(titulo) || 'GENERIC',
            category: categoria,
            specs: [],
            price: precio,
            status: 'active',
            firstSeen: hoy,
            lastSeen: hoy
        };
        catalogo.push(nuevo);
        porRef.set(ref, nuevo);
        rep.nuevos++;
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
        rep.revividos++;
    } else if (precioViejo !== precio) {
        rep.actualizados++;
        if (precio > precioViejo) rep.precioSubio++; else rep.precioBajo++;
        const delta = Math.abs(precio - precioViejo) / precioViejo;
        if (delta > 0.15) {
            cambiosGrandes.push({ titulo, antes: precioViejo, despues: precio, delta });
        }
    } else {
        rep.sinCambio++;
    }
}

// Figurar en la lista es lo que define si un producto se ofrece.
for (const p of catalogo) {
    if (p.status === 'active' && !lista.has(String(p.ref))) {
        p.status = 'hidden';
        delete p.price;
        delete p.specs;
        rep.ocultadosPorAusencia++;
    }
}

const activos = catalogo.filter((p) => p.status === 'active');
const nombrePorId = new Map(CATEGORIAS.map((c) => [c.id, c.nombre]));
const porCat = {};
for (const p of activos) porCat[p.category] = (porCat[p.category] || 0) + 1;

console.log('=== IMPORTACION ===');
console.log(`  productos nuevos:              ${rep.nuevos}`);
console.log(`  reactivados (estaban ocultos): ${rep.revividos}`);
console.log(`  precio actualizado:            ${rep.actualizados}  (subieron ${rep.precioSubio}, bajaron ${rep.precioBajo})`);
console.log(`  sin cambio:                    ${rep.sinCambio}`);
console.log(`  ocultados por no figurar:      ${rep.ocultadosPorAusencia}`);
console.log(`  sin clasificar (descartados):  ${rep.sinClasificar}`);
console.log(`\n  ACTIVOS: ${activos.length}   (antes habia 2511)`);

const orden = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
console.log('\n  activos por categoria:');
for (const [k, v] of orden) {
    console.log(`    ${(nombrePorId.get(k) || k).padEnd(24)} ${String(v).padStart(5)}  ${(v / activos.length * 100).toFixed(1)}%`);
}
console.log(`\n  categoria mas grande: ${(orden[0][1] / activos.length * 100).toFixed(1)}%   <-- umbral: max 15%`);

if (cambiosGrandes.length) {
    console.log(`\n  CAMBIOS DE PRECIO MAYORES AL 15% (${cambiosGrandes.length}):`);
    cambiosGrandes.sort((a, b) => b.delta - a.delta);
    for (const c of cambiosGrandes.slice(0, 10)) {
        const signo = c.despues > c.antes ? '+' : '-';
        console.log(`    ${fmt(c.antes).padStart(15)} -> ${fmt(c.despues).padStart(15)}  (${signo}${(c.delta * 100).toFixed(0)}%)  ${c.titulo.slice(0, 36)}`);
    }
}

if (APLICAR) {
    writeFileSync(RUTA_CATALOGO, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');
    console.log(`\nAPLICADO -> ${RUTA_CATALOGO}`);
} else {
    console.log('\nSIMULACION. Nada se escribio en disco.');
    console.log('Para aplicar: node src/migrate/importar-lista.js --aplicar');
}
