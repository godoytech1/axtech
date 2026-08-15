import { readFileSync, writeFileSync } from 'node:fs';
import { normalizarTitulo } from '../lib/normalize.js';
import { clasificar, detectarMarca, CATEGORIAS } from '../lib/taxonomy.js';
import { precioFinal, costoDesdePrecioLegado, cargarConfig } from '../lib/pricing.js';

const RUTA = 'data/catalog.json';
const APLICAR = process.argv.includes('--aplicar');

const fmt = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const config = cargarConfig();
const catalogo = JSON.parse(readFileSync(RUTA, 'utf8'));
const nombrePorId = new Map(CATEGORIAS.map((c) => [c.id, c.nombre]));

const rep = {
    titulosCambiados: 0, mojibakeReparado: 0, marcasRecuperadas: 0,
    reclasificados: 0, sinClasificarActivos: 0, sinClasificarOcultos: 0,
    preciosRecalculados: 0, costoNoInvertible: 0,
    gananciaVieja: 0, gananciaNueva: 0
};
const cambiosDePrecio = [];
const REEMPLAZO = '\uFFFD';

for (const p of catalogo) {
    // 1. Normalizar el titulo.
    const tituloNuevo = normalizarTitulo(p.title);
    if (tituloNuevo !== p.title) {
        rep.titulosCambiados++;
        if (p.title.includes(REEMPLAZO)) rep.mojibakeReparado++;
        p.title = tituloNuevo;
    }

    // 2. Recuperar la marca si estaba en GENERIC.
    if (!p.brand || p.brand === 'GENERIC') {
        const marca = detectarMarca(p.title);
        if (marca) { p.brand = marca; rep.marcasRecuperadas++; }
    }

    // 3. Reclasificar. Sin categoria -> se oculta, nunca se descarta en silencio.
    const categoriaLegada = p.category;
    const idNuevo = clasificar({ titulo: p.title });
    if (idNuevo) {
        if (idNuevo !== p.category) rep.reclasificados++;
        p.category = idNuevo;
    } else {
        // El umbral de calidad se mide sobre los activos: son los que se
        // publican. Los ocultos se cuentan aparte para no diluir la senal.
        if (p.status === 'active') rep.sinClasificarActivos++;
        else rep.sinClasificarOcultos++;
        p.status = 'hidden';
        delete p.price;
        delete p.specs;
        continue;
    }

    // 4. Recalcular el precio de los activos.
    if (p.status !== 'active' || typeof p.price !== 'number') continue;
    const costo = costoDesdePrecioLegado(p.price, categoriaLegada);
    if (costo === null) { rep.costoNoInvertible++; continue; }
    const nuevo = precioFinal(costo, p.category, config);
    if (nuevo === null) { rep.costoNoInvertible++; continue; }

    rep.gananciaVieja += p.price - costo;
    rep.gananciaNueva += nuevo - costo;
    if (nuevo !== p.price) {
        cambiosDePrecio.push({ titulo: p.title, cat: p.category, antes: p.price, despues: nuevo });
        rep.preciosRecalculados++;
    }
    p.price = nuevo;
}

console.log('=== REFINAMIENTO DEL CATALOGO ===\n');
console.log('TEXTO');
console.log(`  titulos modificados:            ${rep.titulosCambiados}`);
console.log(`  mojibake reparado:              ${rep.mojibakeReparado}`);
console.log(`  marcas recuperadas de GENERIC:  ${rep.marcasRecuperadas}`);

console.log('\nCLASIFICACION');
console.log(`  reclasificados:                 ${rep.reclasificados}`);
console.log(`  sin clasificar (eran activos):  ${rep.sinClasificarActivos}   <-- umbral: max 130`);
console.log(`  sin clasificar (ya ocultos):    ${rep.sinClasificarOcultos}`);

const porCat = {};
let activos = 0;
for (const p of catalogo) {
    if (p.status !== 'active') continue;
    activos++;
    porCat[p.category] = (porCat[p.category] || 0) + 1;
}
const orden = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
console.log(`\n  activos por categoria (${activos} en total):`);
orden.forEach(([k, v]) => {
    const pc = (v / activos * 100).toFixed(1);
    console.log(`    ${(nombrePorId.get(k) || k).padEnd(24)} ${String(v).padStart(5)}  ${pc.padStart(5)}%`);
});
console.log(`\n  categoria mas grande: ${(orden[0][1] / activos * 100).toFixed(1)}%   <-- umbral: max 15%`);

console.log('\nPRECIOS');
console.log(`  recalculados:                   ${rep.preciosRecalculados}`);
console.log(`  costo no invertible:            ${rep.costoNoInvertible}   <-- umbral: 0`);
console.log(`  ganancia modelo actual:         ${fmt(rep.gananciaVieja)}`);
console.log(`  ganancia modelo nuevo:          ${fmt(rep.gananciaNueva)}`);
if (rep.gananciaVieja > 0) {
    const mas = (rep.gananciaNueva / rep.gananciaVieja - 1) * 100;
    console.log(`  diferencia:                     ${fmt(rep.gananciaNueva - rep.gananciaVieja)}  (${mas.toFixed(0)}% mas)`);
}

const suben = cambiosDePrecio.filter((c) => c.despues > c.antes);
const bajan = cambiosDePrecio.filter((c) => c.despues < c.antes);
console.log(`\n  suben: ${suben.length}    bajan: ${bajan.length}    sin cambio: ${activos - cambiosDePrecio.length}`);
const deltas = suben.map((c) => (c.despues - c.antes) / c.antes).sort((a, b) => a - b);
if (deltas.length) {
    const q = (f) => deltas[Math.floor(deltas.length * f)];
    console.log(`  subida mediana: ${(q(0.5) * 100).toFixed(1)}%   p90: ${(q(0.9) * 100).toFixed(1)}%   maxima: ${(deltas.at(-1) * 100).toFixed(1)}%`);
}

console.log('\n  LOS 10 QUE MAS SUBEN (donde hoy regalas margen):');
suben.sort((a, b) => (b.despues - b.antes) - (a.despues - a.antes));
for (const c of suben.slice(0, 10)) {
    const pc = ((c.despues - c.antes) / c.antes * 100).toFixed(0);
    console.log(`    ${fmt(c.antes).padStart(15)} -> ${fmt(c.despues).padStart(15)}  (+${pc.padStart(3)}%)  ${c.titulo.slice(0, 38)}`);
}
if (bajan.length) {
    console.log('\n  LOS 5 QUE MAS BAJAN (quedas mas competitivo):');
    bajan.sort((a, b) => (a.despues - a.antes) - (b.despues - b.antes));
    for (const c of bajan.slice(0, 5)) {
        const pc = ((c.despues - c.antes) / c.antes * 100).toFixed(0);
        console.log(`    ${fmt(c.antes).padStart(15)} -> ${fmt(c.despues).padStart(15)}  (${pc.padStart(4)}%)  ${c.titulo.slice(0, 38)}`);
    }
}

if (APLICAR) {
    writeFileSync(RUTA, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');
    console.log(`\nAPLICADO -> ${RUTA}`);
} else {
    console.log('\nSIMULACION. Nada se escribio en disco.');
    console.log('Para aplicar: node src/migrate/refinar-catalogo.js --aplicar');
}
