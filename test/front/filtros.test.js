import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Estos tests existen por una familia de errores que estuvo publicada.
 *
 * La barra de filtros clasifica los productos leyendo su titulo. Varias de
 * esas funciones terminaban en un `return` fijo: si el titulo no matcheaba
 * ningun patron, el producto se declaraba PC, o NVIDIA, o INTEL, o periferico.
 * Una funcion que adivina no falla nunca: la tienda sigue cargando, la consola
 * queda limpia, y lo unico que pasa es que el filtro miente.
 *
 * Lo que estaba publicado:
 *
 *   - 54 memorias SODIMM de notebook aparecian al filtrar "PC". El titulo las
 *     marca con "MEM NB", pero la funcion buscaba la palabra "SODIMM", que el
 *     proveedor escribe solo en 22 de las 77.
 *   - 12 placas de video estaban en el chipset equivocado: nueve AMD listadas
 *     como NVIDIA (la funcion buscaba "rx " CON espacio y el proveedor escribe
 *     "RX580"), y tres Intel Arc listadas como AMD.
 *   - 5 receptores IPTV aparecian en el filtro de pulgadas: "IPTV 16GB" daba
 *     un televisor de 16" y "SMART TV 64GB/512GB" uno de 65".
 *   - 19 placas madre de socket 1851 y 775 no las reconocia ningun patron y
 *     salian Intel por el `return` del final, o sea por casualidad.
 *
 * La regla que se protege aca: una opcion del filtro solo puede reclamar un
 * producto si hay evidencia en el titulo. Sin evidencia, `null`.
 */

const APP = readFileSync('app.js', 'utf8');
const CATALOGO = JSON.parse(readFileSync('data/catalog.json', 'utf8'))
    .filter((p) => p.status === 'active');

// Se evalua el bloque real de app.js en vez de copiarlo: una copia se
// desactualiza en silencio y el test pasaria mientras la tienda falla.
//
// El `new Function` corre codigo del propio repositorio, no entrada de nadie:
// si `app.js` fuera hostil el problema seria que se publica, no que este test
// lo lea. No usar este patron con nada que venga de afuera.
const NOMBRES = [
    'getTvSize', 'getMonitorSize', 'getGpuChip', 'getMbPlatform', 'getNotebookType',
    'getRamType', 'getPsuWattage', 'getConsoleProductType', 'getStorageCapacity'
];
const bloque = APP.slice(APP.indexOf('function getTvSize('), APP.indexOf('function setupAccordionListeners('));
assert.ok(bloque.length > 1000, 'no se encontro el bloque de ayudantes en app.js');
const F = new Function(`${bloque}\nreturn {${NOMBRES.join(',')}};`)();

const de = (categoria) => CATALOGO.filter((p) => p.category === categoria);
const titulos = (arr) => arr.map((p) => p.title);

// --------------------------------------------------------------------------
// Memorias RAM
// --------------------------------------------------------------------------

test('ninguna memoria de notebook se ofrece como memoria de PC', () => {
    const malas = de('memorias-ram')
        .filter((p) => /\bNB\b|SO-?DIMM/i.test(p.title))
        .filter((p) => F.getRamType(p.title) !== 'Laptop');
    assert.deepEqual(titulos(malas), [], 'memorias SODIMM clasificadas como PC');
});

test('ninguna memoria de escritorio se esconde en el filtro Laptop', () => {
    const malas = de('memorias-ram')
        .filter((p) => /\bUDIMM\b/i.test(p.title) && !/\bNB\b|SO-?DIMM/i.test(p.title))
        .filter((p) => F.getRamType(p.title) !== 'PC');
    assert.deepEqual(titulos(malas), [], 'memorias UDIMM clasificadas como Laptop');
});

// --------------------------------------------------------------------------
// Tarjetas de video
// --------------------------------------------------------------------------

test('ninguna placa AMD se muestra como NVIDIA', () => {
    const malas = de('tarjetas-de-video')
        .filter((p) => /radeon|\brx ?\d{3,4}|\br[3579][ -]?\d{3}\b|\bvega\b/i.test(p.title))
        .filter((p) => !/\bintel\b|\barc\b/i.test(p.title))
        .filter((p) => F.getGpuChip(p.title) !== 'AMD');
    assert.deepEqual(titulos(malas), []);
});

test('ninguna placa NVIDIA se muestra como AMD', () => {
    const malas = de('tarjetas-de-video')
        .filter((p) => /geforce|\brtx ?\d|\bgtx ?\d/i.test(p.title))
        .filter((p) => !/radeon|\brx ?\d{3,4}|\bamd\b/i.test(p.title))
        .filter((p) => F.getGpuChip(p.title) !== 'NVIDIA');
    assert.deepEqual(titulos(malas), []);
});

test('las placas Intel Arc tienen su propio chipset', () => {
    const arc = de('tarjetas-de-video').filter((p) => /\barc\b/i.test(p.title));
    assert.ok(arc.length > 0, 'no hay placas Arc en el catalogo para verificar');
    for (const p of arc) assert.equal(F.getGpuChip(p.title), 'INTEL', p.title);
});

test('una placa que no se reconoce no se declara NVIDIA', () => {
    assert.equal(F.getGpuChip('VGA 8GB MARCA NUEVA MODELO XYZ-123'), null);
});

// --------------------------------------------------------------------------
// Placas madre
// --------------------------------------------------------------------------

test('cada placa madre cae en la plataforma de su socket', () => {
    const SOCKET = /^mb\s+(am\d|fm\d|\d{3,4})\b/i;
    const AMD = new Set(['am3', 'am4', 'am5', 'fm2']);
    const INTEL = new Set(['775', '1150', '1151', '1155', '1200', '1700', '1851', '2011']);
    const malas = [];
    for (const p of de('placas-madre')) {
        const m = SOCKET.exec(p.title);
        if (!m) continue;
        const socket = m[1].toLowerCase();
        const esperado = AMD.has(socket) ? 'AMD' : INTEL.has(socket) ? 'INTEL' : null;
        if (esperado && F.getMbPlatform(p.title) !== esperado) malas.push(`${socket}: ${p.title}`);
    }
    assert.deepEqual(malas, []);
});

test('una placa madre que no se reconoce no se declara Intel', () => {
    assert.equal(F.getMbPlatform('MB SOCKET DESCONOCIDO MARCA NUEVA'), null);
});

test('los chipsets de la serie 800 no se confunden entre si', () => {
    // Un digito de diferencia: B850 y X870 son AMD, B860 y Z890 son Intel.
    assert.equal(F.getMbPlatform('MB AM5 GIGABYTE B850 AORUS ELITE WIFI7 DDR5'), 'AMD');
    assert.equal(F.getMbPlatform('MB 1851 GIGABYTE B860M K DDR5/HDMI/M.2'), 'INTEL');
    assert.equal(F.getMbPlatform('MB 1851 ASROCK Z890 PRO RS WIFI/DDR5/HDMI/DP'), 'INTEL');
    assert.equal(F.getMbPlatform('MB AM5 ASUS ROG STRIX X870-E GAMING WIFI'), 'AMD');
});

// --------------------------------------------------------------------------
// Televisores
// --------------------------------------------------------------------------

test('la capacidad de un TV Box no se lee como pulgadas', () => {
    assert.equal(F.getTvSize('RECEPTOR HTV H8 4K IPTV 16GB/2GB HDR10/USB 3.0 AND'), null);
    assert.equal(F.getTvSize('RECEPTOR R90 PLUS SMART TV 64GB/512GB 8K Blanco'), null);
    assert.equal(F.getTvSize('RECEPTOR TV BOX MXQ PLUS 8K 5G 128GB/512/SILVER'), null);
});

test('un televisor de verdad conserva su medida', () => {
    assert.equal(F.getTvSize('SMART TV 50 SAMSUNG UN50DU7000 4K UHD'), '50"');
    assert.equal(F.getTvSize('SMART TV 65" LG UR7800 4K'), '65"');
    assert.equal(F.getTvSize('TV 43 PHILCO PTV43G7ER2CPBL FHD'), '43"');
});

// --------------------------------------------------------------------------
// Consolas
// --------------------------------------------------------------------------

test('lo que no es ni consola ni periferico no se declara periferico', () => {
    assert.equal(F.getConsoleProductType('PRODUCTO NUEVO SIN TIPO RECONOCIBLE'), null);
});

test('las consolas y los mandos caen donde corresponde', () => {
    assert.equal(F.getConsoleProductType('CONSOLE PLAYSTATION 5 SLIM 1TB'), 'Consolas');
    assert.equal(F.getConsoleProductType('CONTROLE PS5 SONY DUAL SENSE COSMIC RED'), 'Periféricos');
    assert.equal(F.getConsoleProductType('VOLANTE LOGITECH G29 DRIV.FORCE PS4/PS5'), 'Periféricos');
});

// --------------------------------------------------------------------------
// Tramos: ningun valor puede quedarse sin casilla
// --------------------------------------------------------------------------
//
// Los tramos de vatios, capacidad y pulgadas tenian huecos. Un valor que caia
// en uno se convertia en su propia opcion del filtro, con un solo producto
// adentro. Se barre todo el rango y se exige que cada resultado sea una de las
// etiquetas previstas.

test('todo vatiaje de fuente cae en un tramo previsto', () => {
    const TRAMOS = new Set(['200W - 450W', '500W - 600W', '650W - 750W', '800W - 999W', '1000W+']);
    for (let w = 150; w <= 2000; w += 5) {
        const tramo = F.getPsuWattage(`FUENTE ${w}W MARCA MODELO`);
        assert.ok(TRAMOS.has(tramo), `${w}W dio "${tramo}"`);
    }
    assert.equal(F.getPsuWattage('UI. POE-24-12W INJECTOR 24VDC 12W'), null, 'un inyector PoE no es una fuente de PC');
});

test('toda capacidad de almacenamiento cae en un tramo previsto', () => {
    const TRAMOS = new Set(['Hasta 64GB', '120GB - 256GB', '480GB - 512GB', '1TB', '2TB', '4TB+']);
    for (let gb = 8; gb <= 8000; gb += 8) {
        const tramo = F.getStorageCapacity(`SSD ${gb}GB MARCA MODELO`);
        assert.ok(TRAMOS.has(tramo), `${gb}GB dio "${tramo}"`);
    }
});

test('toda medida de monitor cae en un tramo previsto', () => {
    const TRAMOS = new Set(['15-16', '17-19', '20-22', '24', '27', '28-30', '32', '34', '40', '49']);
    for (let pulgadas = 14; pulgadas <= 49; pulgadas += 0.1) {
        const medida = pulgadas.toFixed(1);
        const tramo = F.getMonitorSize(`MON ${medida}" MARCA MODELO`);
        assert.ok(TRAMOS.has(tramo), `${medida}" dio "${tramo}"`);
    }
});

// --------------------------------------------------------------------------
// El filtro no puede quedarse sin opciones
// --------------------------------------------------------------------------

test('cada filtro reparte los productos de su categoria', () => {
    // Si un cambio futuro manda todo a un solo lado, o deja todo en null, el
    // filtro deja de filtrar sin romper nada visible.
    const casos = [
        ['memorias-ram', 'getRamType'],
        ['tarjetas-de-video', 'getGpuChip'],
        ['placas-madre', 'getMbPlatform'],
        ['notebooks', 'getNotebookType'],
        ['consolas-y-videojuegos', 'getConsoleProductType']
    ];
    for (const [categoria, fn] of casos) {
        const items = de(categoria);
        assert.ok(items.length > 0, `${categoria} sin productos activos`);
        const valores = new Set(items.map((p) => F[fn](p.title)).filter(Boolean));
        assert.ok(valores.size >= 2, `${categoria}: ${fn} solo produce ${[...valores]}`);
    }
});
