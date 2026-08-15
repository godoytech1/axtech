import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { aWebp, esPlaceholder } from './procesar.js';
import { nombreDeArchivo } from '../lib/imagenes.js';

const DESTINO = 'public/img';
const CONCURRENCIA = 6;

const base = process.env.SUPPLIER_IMG_BASE;
if (!base) {
    console.error('ERROR: falta SUPPLIER_IMG_BASE. Definila en .env o como secreto del CI.');
    process.exit(1);
}

const catalogo = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const activos = catalogo.filter((p) => p.status === 'active');
mkdirSync(DESTINO, { recursive: true });

const rep = { total: activos.length, saltados: 0, ok: 0, placeholder: 0, error: 0 };
const sinImagen = [];

async function procesarUno(p) {
    const ruta = `${DESTINO}/${nombreDeArchivo(p.id)}`;
    if (existsSync(ruta)) { rep.saltados++; return; }

    try {
        const res = await fetch(`${base}/IMG_${p.ref}_1.JPG`);
        if (!res.ok) { rep.error++; sinImagen.push(p.id); return; }
        const original = Buffer.from(await res.arrayBuffer());

        if (esPlaceholder(original)) { rep.placeholder++; sinImagen.push(p.id); return; }

        writeFileSync(ruta, await aWebp(original));
        rep.ok++;
    } catch {
        rep.error++;
        sinImagen.push(p.id);
    }
}

// Concurrencia limitada: no conviene golpear al proveedor con 2.511 pedidos
// simultaneos, y tampoco hace falta.
const cola = [...activos];
let hechos = 0;
const obreros = Array.from({ length: CONCURRENCIA }, async () => {
    while (cola.length) {
        await procesarUno(cola.shift());
        hechos++;
        if (hechos % 250 === 0) console.log(`  ${hechos}/${rep.total}...`);
    }
});
await Promise.all(obreros);

console.log('\n=== MIGRACION DE IMAGENES ===');
console.log(`  productos activos:  ${rep.total}`);
console.log(`  descargadas:        ${rep.ok}`);
console.log(`  ya existian:        ${rep.saltados}`);
console.log(`  placeholder:        ${rep.placeholder}`);
console.log(`  con error:          ${rep.error}`);

if (sinImagen.length) {
    writeFileSync('data/sin-imagen.json', JSON.stringify(sinImagen, null, 2) + '\n', 'utf8');
    console.log(`\n  ${sinImagen.length} productos quedaron sin imagen. Ids en data/sin-imagen.json`);
    console.log('  No se publican: la regla 3 prohibe mostrar productos sin imagen real.');
}
