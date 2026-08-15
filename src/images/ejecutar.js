import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { aWebp, esPlaceholder } from './procesar.js';
import { nombreDeArchivo } from '../lib/imagenes.js';

const DESTINO = 'public/img';
const RUTA_SIN_IMAGEN = 'data/sin-imagen.json';
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

// La lista se FUSIONA con la que ya estaba, no la reemplaza.
//
// Reemplazarla era un error silencioso y peligroso: los productos que ya
// tenian archivo se saltan y nunca vuelven a entrar en `sinImagen`, asi que
// una corrida interrumpida (o una que no encontrara nada nuevo) truncaba el
// archivo y publicaba productos sin foto, contra la regla 3.
//
// Del archivo previo solo se conservan los ids que siguen sin imagen en disco:
// asi un producto que consiguio su foto sale de la lista por si solo.
const previos = existsSync(RUTA_SIN_IMAGEN)
    ? JSON.parse(readFileSync(RUTA_SIN_IMAGEN, 'utf8'))
    : [];
const idsActuales = new Set(catalogo.map((p) => p.id));
const fusionados = [...new Set([...previos, ...sinImagen])]
    .filter((id) => idsActuales.has(id))
    .filter((id) => !existsSync(`${DESTINO}/${nombreDeArchivo(id)}`))
    .sort((a, b) => a - b);

writeFileSync(RUTA_SIN_IMAGEN, JSON.stringify(fusionados, null, 2) + '\n', 'utf8');
console.log(`\n  ${fusionados.length} productos siguen sin imagen. Ids en ${RUTA_SIN_IMAGEN}`);
console.log(`  (${previos.length} antes de esta corrida)`);
console.log('  No se publican: la regla 3 prohibe mostrar productos sin imagen real.');
