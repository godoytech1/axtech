/**
 * Sincronizacion del catalogo con la lista oficial del proveedor.
 *
 *   node src/sync/ejecutar.js                  simula: calcula e informa, no escribe
 *   node src/sync/ejecutar.js --aplicar        escribe data/catalog.json y data/meta.json
 *   node src/sync/ejecutar.js --archivo RUTA   usa un .txt local en vez de descargar
 *   node src/sync/ejecutar.js --sin-purga      no borra nada, solo actualiza
 *   node src/sync/ejecutar.js --forzar         ignora los frenos (nunca en CI)
 *
 * Es el unico modulo del sync con disco, red y salida por consola. Toda la
 * logica vive en descargar.js, verificar.js y aplicar.js, que son puros.
 *
 * El orden importa y no es negociable:
 *
 *   descargar -> parsear -> VERIFICAR LA LISTA -> aplicar -> purgar ->
 *   VERIFICAR LOS CAMBIOS -> recien ahi escribir
 *
 * Verificar despues de calcular y antes de escribir es lo que hace que un mal
 * dia del proveedor no rompa nada: si algo no cierra, se aborta con el
 * catalogo intacto.
 *
 * Es seguro repetirlo. El precio sale del dolar de la lista, no del precio
 * anterior, asi que correrlo dos veces da el mismo resultado.
 */
import { readFileSync, writeFileSync, existsSync, rmSync, mkdirSync } from 'node:fs';
import { descargarLista } from './descargar.js';
import { verificarLista, verificarCambios, LIMITES } from './verificar.js';
import { aplicarLista, purgar } from './aplicar.js';
import { parsearLista } from '../lib/lista-precios.js';
import { cargarConfig } from '../lib/pricing.js';
import { CATEGORIAS } from '../lib/taxonomy.js';
import { nombreDeArchivo } from '../lib/imagenes.js';

const RUTA_CATALOGO = 'data/catalog.json';
const RUTA_META = 'data/meta.json';
const RUTA_SIN_IMAGEN = 'data/sin-imagen.json';
const DIR_IMG = 'public/img';
const DIR_ARCHIVO = '.local-legacy/listas-proveedor';
const DIAS_GRACIA = 30;

const args = process.argv.slice(2);
const bandera = (n) => args.includes(n);
const valor = (n) => {
    const i = args.indexOf(n);
    return i >= 0 ? args[i + 1] : null;
};

const APLICAR = bandera('--aplicar');
const FORZAR = bandera('--forzar');
const SIN_PURGA = bandera('--sin-purga');
const ARCHIVO = valor('--archivo');

const fmt = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function abortar(titulo, problemas) {
    console.error(`\nERROR: ${titulo}`);
    for (const p of problemas) console.error(`   - ${p}`);
    console.error('\nNo se escribio nada. El catalogo quedo como estaba.');
    console.error('Si el resultado es correcto pese al freno, repetir con --forzar.');
    process.exit(1);
}

// --- 1. Estado actual ------------------------------------------------------

const catalogo = JSON.parse(readFileSync(RUTA_CATALOGO, 'utf8'));
const meta = existsSync(RUTA_META)
    ? JSON.parse(readFileSync(RUTA_META, 'utf8'))
    : { ultimoId: Math.max(...catalogo.map((p) => p.id || 0), 0), productosEnLista: null };
const config = cargarConfig();

const activosPrevios = catalogo.filter((p) => p.status === 'active').length;
const totalPrevio = catalogo.length;
const hoy = new Date().toISOString().slice(0, 10);

// --- 2. Conseguir la lista -------------------------------------------------

let texto;
let origen;
let nombreArchivo = null;

if (ARCHIVO) {
    if (!existsSync(ARCHIVO)) {
        console.error(`ERROR: no existe el archivo ${ARCHIVO}`);
        process.exit(1);
    }
    texto = readFileSync(ARCHIVO, 'latin1');
    origen = `archivo local (${texto.length} caracteres)`;
} else {
    const url = process.env.SUPPLIER_LIST_URL;
    if (!url) {
        console.error('ERROR: falta SUPPLIER_LIST_URL. Definila en .env o como secreto del CI.');
        console.error('       Alternativa manual: --archivo <ruta al .txt>');
        process.exit(1);
    }
    const bajada = await descargarLista({ url });
    texto = bajada.texto;
    nombreArchivo = bajada.nombreArchivo;
    origen = `descarga (${(bajada.bytes / 1024).toFixed(0)} KB)`;
}

const lista = parsearLista(texto);
console.log(`Origen: ${origen}`);
console.log(`Lista:  ${lista.size} productos con precio`);
console.log(`Tipo de cambio: ${config.tipoDeCambio} Gs/USD\n`);

// --- 3. Primer freno: la lista, antes de tocar el catalogo -----------------

const problemasLista = verificarLista({
    productosEnLista: lista.size,
    productosEnListaPrevia: meta.productosEnLista,
    tipoDeCambio: config.tipoDeCambio,
    limites: LIMITES
});
if (problemasLista.length && !FORZAR) abortar('la lista descargada no supera los controles.', problemasLista);
if (problemasLista.length) {
    console.warn('AVISO: se ignoraron estos controles por --forzar:');
    for (const p of problemasLista) console.warn(`   - ${p}`);
    console.warn('');
}

// --- 4. Calcular (sin escribir) --------------------------------------------

const fusion = aplicarLista({ catalogo, lista, hoy, config, ultimoId: meta.ultimoId });
const { catalogo: purgado, purgados } = SIN_PURGA
    ? { catalogo: fusion.catalogo, purgados: [] }
    : purgar({ catalogo: fusion.catalogo, hoy, diasGracia: DIAS_GRACIA });

const rep = fusion.reporte;

// --- 5. Segundo freno: los cambios ya calculados, todavia sin escribir -----

const problemasCambios = verificarCambios({
    reporte: rep, activosPrevios, purgados, totalPrevio, limites: LIMITES
});

// --- 6. Informe ------------------------------------------------------------

const activos = purgado.filter((p) => p.status === 'active');
const nombrePorId = new Map(CATEGORIAS.map((c) => [c.id, c.nombre]));
const porCat = {};
for (const p of activos) porCat[p.category] = (porCat[p.category] || 0) + 1;

console.log('=== SINCRONIZACION ===');
console.log(`  productos nuevos:              ${rep.nuevos}`);
console.log(`  reactivados (estaban ocultos): ${rep.revividos}`);
console.log(`  precio actualizado:            ${rep.actualizados}  (subieron ${rep.precioSubio}, bajaron ${rep.precioBajo})`);
console.log(`  sin cambio:                    ${rep.sinCambio}`);
console.log(`  ocultados por no figurar:      ${rep.ocultados}`);
console.log(`  sin clasificar (descartados):  ${rep.sinClasificar}`);
console.log(`  fuera del rubro (excluidos):   ${rep.excluidos}  (${rep.excluidosOcultados} se ocultaron ahora)`);
console.log(`  purgados (${DIAS_GRACIA}+ dias ausentes):  ${purgados.length}`);
console.log(`\n  ACTIVOS: ${activos.length}   (antes ${activosPrevios})`);
console.log(`  REGISTROS: ${purgado.length}   (antes ${totalPrevio})`);

const orden = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
if (orden.length) {
    console.log('\n  activos por categoria (top 8):');
    for (const [k, v] of orden.slice(0, 8)) {
        console.log(`    ${(nombrePorId.get(k) || k).padEnd(24)} ${String(v).padStart(5)}  ${(v / activos.length * 100).toFixed(1)}%`);
    }
    console.log(`\n  categoria mas grande: ${(orden[0][1] / activos.length * 100).toFixed(1)}%   <-- umbral: max 15%`);
}

if (rep.saltos.length) {
    console.log(`\n  SALTOS DE PRECIO MAYORES AL 15% (${rep.saltos.length}):`);
    for (const c of rep.saltos.slice(0, 10)) {
        const signo = c.despues > c.antes ? '+' : '-';
        console.log(`    ${fmt(c.antes).padStart(15)} -> ${fmt(c.despues).padStart(15)}  (${signo}${(c.delta * 100).toFixed(0)}%)  ${c.titulo.slice(0, 36)}`);
    }
}

if (problemasCambios.length && !FORZAR) abortar('los cambios calculados no superan los controles.', problemasCambios);
if (problemasCambios.length) {
    console.warn('\nAVISO: se ignoraron estos controles por --forzar:');
    for (const p of problemasCambios) console.warn(`   - ${p}`);
}

// --- 7. Escribir -----------------------------------------------------------

if (!APLICAR) {
    console.log('\nSIMULACION. Nada se escribio en disco.');
    console.log('Para aplicar: node src/sync/ejecutar.js --aplicar');
    process.exit(0);
}

writeFileSync(RUTA_CATALOGO, JSON.stringify(purgado, null, 2) + '\n', 'utf8');

// La imagen de un producto purgado no sirve para nada y, peor, el id podria
// volver a asignarse. Por eso ultimoId es monotono Y la imagen se borra: dos
// defensas para el mismo error, porque publicar la foto equivocada en una
// tienda es de los errores que no se notan hasta que un cliente los ve.
let imagenesBorradas = 0;
for (const id of purgados) {
    const ruta = `${DIR_IMG}/${nombreDeArchivo(id)}`;
    if (existsSync(ruta)) { rmSync(ruta); imagenesBorradas++; }
}

if (purgados.length && existsSync(RUTA_SIN_IMAGEN)) {
    const idsPurgados = new Set(purgados);
    const sinImagen = JSON.parse(readFileSync(RUTA_SIN_IMAGEN, 'utf8'))
        .filter((id) => !idsPurgados.has(id));
    writeFileSync(RUTA_SIN_IMAGEN, JSON.stringify(sinImagen, null, 2) + '\n', 'utf8');
}

writeFileSync(RUTA_META, JSON.stringify({
    _nota: meta._nota,
    ultimoId: fusion.ultimoId,
    ultimaSync: hoy,
    productosEnLista: lista.size,
    activos: activos.length,
    total: purgado.length
}, null, 4) + '\n', 'utf8');

// La lista descargada se archiva fuera del repositorio: trae costos y el
// nombre del proveedor. En el CI ese directorio no existe y no se archiva.
if (!ARCHIVO && nombreArchivo && existsSync(DIR_ARCHIVO)) {
    mkdirSync(DIR_ARCHIVO, { recursive: true });
    writeFileSync(`${DIR_ARCHIVO}/${nombreArchivo}`, Buffer.from(texto, 'latin1'));
    console.log(`\nLista archivada en ${DIR_ARCHIVO}/`);
}

console.log(`\nAPLICADO -> ${RUTA_CATALOGO}, ${RUTA_META}`);
if (imagenesBorradas) console.log(`   ${imagenesBorradas} imagenes de productos purgados borradas.`);
console.log('   Falta bajar imagenes de lo nuevo: node --env-file=.env src/images/ejecutar.js');
