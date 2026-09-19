import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nombrarCatalogo } from '../../src/lib/nombre.js';

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

/**
 * El front NO ve el titulo del proveedor: ve el nombre corto que publica el
 * build. Desde el 31/08 los dos textos son distintos, y este archivo seguia
 * probando con el titulo --el texto que la tienda nunca recibe--.
 *
 * Por eso los 303 tests pasaban con cinco filtros vacios: "Ver todo gamer" en
 * Notebooks no devolvia un solo producto, y el filtro de pulgadas de los
 * televisores tampoco, durante diecinueve dias.
 *
 * La division que sigue es la que importa:
 *   - el conjunto se ELIGE con el titulo del proveedor, que es donde esta la
 *     evidencia de que un producto es lo que decimos que es;
 *   - el clasificador se EVALUA con el nombre publicado, que es lo unico que
 *     el navegador tiene para filtrar.
 */
const PUBLICADO = nombrarCatalogo(CATALOGO);
const visto = (p) => PUBLICADO.get(p) || p.title;

// Se evalua el bloque real de app.js en vez de copiarlo: una copia se
// desactualiza en silencio y el test pasaria mientras la tienda falla.
//
// El `new Function` corre codigo del propio repositorio, no entrada de nadie:
// si `app.js` fuera hostil el problema seria que se publica, no que este test
// lo lea. No usar este patron con nada que venga de afuera.
const NOMBRES = [
    'getTvSize', 'getMonitorSize', 'getGpuChip', 'getMbPlatform', 'getNotebookType',
    'getRamType', 'getPsuWattage', 'getConsoleProductType', 'getStorageCapacity', 'attrHtml'
];
const bloque = APP.slice(APP.indexOf('const attrHtml ='), APP.indexOf('function setupAccordionListeners('));
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
        .filter((p) => F.getRamType(visto(p)) !== 'Laptop');
    assert.deepEqual(titulos(malas), [], 'memorias SODIMM clasificadas como PC');
});

test('ninguna memoria de escritorio se esconde en el filtro Laptop', () => {
    const malas = de('memorias-ram')
        .filter((p) => /\bUDIMM\b/i.test(p.title) && !/\bNB\b|SO-?DIMM/i.test(p.title))
        .filter((p) => F.getRamType(visto(p)) !== 'PC');
    assert.deepEqual(titulos(malas), [], 'memorias UDIMM clasificadas como Laptop');
});

// --------------------------------------------------------------------------
// Tarjetas de video
// --------------------------------------------------------------------------

test('ninguna placa AMD se muestra como NVIDIA', () => {
    const malas = de('tarjetas-de-video')
        .filter((p) => /radeon|\brx ?\d{3,4}|\br[3579][ -]?\d{3}\b|\bvega\b/i.test(p.title))
        .filter((p) => !/\bintel\b|\barc\b/i.test(p.title))
        .filter((p) => F.getGpuChip(visto(p)) !== 'AMD');
    assert.deepEqual(titulos(malas), []);
});

test('ninguna placa NVIDIA se muestra como AMD', () => {
    const malas = de('tarjetas-de-video')
        .filter((p) => /geforce|\brtx ?\d|\bgtx ?\d/i.test(p.title))
        .filter((p) => !/radeon|\brx ?\d{3,4}|\bamd\b/i.test(p.title))
        .filter((p) => F.getGpuChip(visto(p)) !== 'NVIDIA');
    assert.deepEqual(titulos(malas), []);
});

test('las placas Intel Arc tienen su propio chipset', () => {
    const arc = de('tarjetas-de-video').filter((p) => /\barc\b/i.test(p.title));
    assert.ok(arc.length > 0, 'no hay placas Arc en el catalogo para verificar');
    for (const p of arc) assert.equal(F.getGpuChip(visto(p)), 'INTEL', p.title);
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
        if (esperado && F.getMbPlatform(visto(p)) !== esperado) malas.push(`${socket}: ${p.title}`);
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

// --------------------------------------------------------------------------
// Que ningun filtro quede VACIO
// --------------------------------------------------------------------------
//
// Todo lo de arriba cuida que un filtro no MIENTA: que no reclame productos
// que no le corresponden. Falta la simetria, y es la que fallo: que un filtro
// no deje de encontrar los que si le corresponden.
//
// El 31/08 los nombres se acortaron y cinco filtros quedaron en cero sin que
// nada fallara. "Ver todo gamer" en Notebooks no devolvio un producto durante
// diecinueve dias; el filtro de pulgadas de los televisores tampoco.

test('ningun filtro se queda sin productos en una categoria que los tiene', () => {
    const CASOS = [
        ['televisores',        'getTvSize',           0.5],
        ['monitores',          'getMonitorSize',      0.8],
        ['tarjetas-de-video',  'getGpuChip',          0.9],
        ['placas-madre',       'getMbPlatform',       0.9],
        ['memorias-ram',       'getRamType',          0.9],
        ['fuentes-de-poder',   'getPsuWattage',       0.8],
        ['almacenamiento-ssd', 'getStorageCapacity',  0.9]
    ];
    const flojos = [];
    for (const [categoria, fn, minimo] of CASOS) {
        const prods = de(categoria);
        if (!prods.length) continue;
        const reconocidos = prods.filter((p) => F[fn](visto(p)) != null).length;
        const razon = reconocidos / prods.length;
        if (razon < minimo) {
            flojos.push(`${fn} reconoce ${reconocidos} de ${prods.length} en ${categoria}`);
        }
    }
    assert.deepEqual(flojos, []);
});

test('el filtro Gamer de notebooks encuentra las notebooks gamer', () => {
    // No alcanza con que la funcion devuelva algo: getNotebookType SIEMPRE
    // devuelve "Gamer" u "Ofimatica", nunca null, asi que el contador de
    // arriba no lo detecta. Hay que contar cuantas caen de cada lado.
    const nb = de('notebooks');
    const declaradas = nb.filter((p) => /\brtx|\bgtx|gaming|gamer|nitro|predator|victus|loq|tuf|titan/i.test(p.title));
    const encontradas = nb.filter((p) => F.getNotebookType(visto(p)) === 'Gamer');
    assert.ok(declaradas.length > 0, 'no hay notebooks gamer en el catalogo para verificar');
    assert.ok(encontradas.length >= declaradas.length * 0.9,
        `el filtro ve ${encontradas.length} gamer y el proveedor declara ${declaradas.length}`);
});

// --------------------------------------------------------------------------
// El valor del checkbox tiene que sobrevivir al HTML
// --------------------------------------------------------------------------

test('ningun value de filtro se corta al escribirse en el HTML', () => {
    // getTvSize devuelve '32"'. Interpolado sin escapar, la comilla CIERRA el
    // atributo y el navegador termina leyendo value="32":
    //
    //     <input data-filter-type="tvSizes" value="32" "="">
    //
    // El filtro comparaba "32" contra '32"' y los siete tamaños de television
    // no devolvian un solo producto. No era una regresion: nunca anduvieron.
    const interpolaciones = [...APP.matchAll(/value="\$\{([^}]+)\}"/g)].map((m) => m[1]);
    assert.ok(interpolaciones.length > 10, 'no se encontraron los checkboxes en app.js');
    const crudos = interpolaciones.filter((expr) => !expr.startsWith('attrHtml('));
    assert.deepEqual(crudos, [], 'hay valores puestos en un atributo sin escapar');
});

test('un valor con comillas sobrevive al ida y vuelta', () => {
    const doc = `<input value="${F.attrHtml('32"')}">`;
    // El atributo tiene que quedar cerrado y con el valor entero adentro.
    assert.equal(doc, '<input value="32&quot;">');
    assert.equal(F.attrHtml('15-16'), '15-16', 'un valor sin comillas no se toca');
});

// --------------------------------------------------------------------------
// Buscador
// --------------------------------------------------------------------------

// El buscador vive en otro bloque de app.js que el de los clasificadores.
const bloqueBusqueda = APP.slice(
    APP.indexOf('const SEARCH_STOP_WORDS'),
    APP.indexOf('const SEARCH_SYNONYMS')
);
assert.ok(bloqueBusqueda.length > 500, 'no se encontro el bloque del buscador en app.js');
const B = new Function(
    `${bloqueBusqueda}
return {palabrasDeBusqueda, esBusquedaDeComponente, esconderNotebooksDeComponente};`
)();

test('buscar un componente no esconde el unico producto que lo tiene', () => {
    // "rtx 4060" devolvia CERO con una notebook RTX 4060 en stock: la regla
    // "si busca componentes, no le muestres notebooks" la escondia, y no
    // habia ninguna placa que ocupara su lugar. La tienda decia no tener algo
    // que si tenia.
    const soloNotebook = [{ category: 'notebooks', title: 'MSI RTX 4060' }];
    assert.deepEqual(
        B.esconderNotebooksDeComponente(soloNotebook, ['rtx', '4060']),
        soloNotebook
    );
});

test('buscar un componente sigue apartando las notebooks cuando hay componente', () => {
    // La regla original resuelve algo real: sin ella, "rtx 5070" sepultaba la
    // placa bajo cuarenta notebooks que la traen adentro.
    const mezcla = [
        { category: 'notebooks', title: 'Asus RTX 5070' },
        { category: 'tarjetas-de-video', title: 'Zotac RTX 5070' }
    ];
    const r = B.esconderNotebooksDeComponente(mezcla, ['rtx', '5070']);
    assert.deepEqual(r.map((x) => x.category), ['tarjetas-de-video']);
});

test('nombrar la notebook la deja aparecer aunque se pida un componente', () => {
    const mezcla = [
        { category: 'notebooks', title: 'Acer RTX 5070' },
        { category: 'tarjetas-de-video', title: 'Zotac RTX 5070' }
    ];
    assert.equal(B.esconderNotebooksDeComponente(mezcla, ['notebook', 'rtx']).length, 2);
});

test('toda busqueda de un producto real del catalogo devuelve ese producto', () => {
    // Recorre nombres publicados de verdad: si una regla del buscador vuelve a
    // tapar un producto entero, esto falla antes de publicarse.
    const muestra = CATALOGO.filter((_, i) => i % 97 === 0).slice(0, 120);
    const vacios = muestra.filter((p) => {
        const palabras = B.palabrasDeBusqueda(visto(p));
        if (palabras.length === 0) return false;
        const texto = `${visto(p)} ${p.brand} ${p.category}`.toLowerCase();
        const coincide = palabras.every((w) => texto.includes(w));
        if (!coincide) return false; // el producto no se encuentra por su propio nombre: otro problema
        return B.esconderNotebooksDeComponente([p], palabras).length === 0;
    }).map((p) => visto(p));
    assert.deepEqual(vacios, []);
});

test('el mensaje de WhatsApp lleva un enlace que abre', () => {
    // Mandaba "Link / Imagen: /img/12586.webp": en WhatsApp eso no es un
    // enlace ni una imagen, es texto muerto. Quien recibia el pedido tenia el
    // nombre del producto y nada mas para encontrarlo.
    const bloqueWa = APP.slice(APP.indexOf('function mensajeWhatsApp'), APP.indexOf('function palabrasDeBusqueda'));
    assert.ok(bloqueWa.length > 100, 'no se encontro mensajeWhatsApp en app.js');
    const armar = new Function(
        'location',
        `${bloqueWa}
return mensajeWhatsApp;`
    )({ origin: 'https://axtech.pages.dev' });

    const texto = decodeURIComponent(armar({
        id: 1234, title: 'Acer PHN16S RTX 5070', pyg_str: 'Gs. 15.478.000',
        sob_consulta: false, image: '/img/1234.webp'
    }));
    assert.ok(texto.includes('https://axtech.pages.dev/?id=1234'), texto);
    assert.ok(!texto.includes('/img/'), 'no puede mandar una ruta relativa: ' + texto);
    assert.ok(texto.includes('Acer PHN16S RTX 5070'), texto);
    assert.ok(texto.includes('Gs. 15.478.000'), texto);
});

test('un producto bajo consulta no publica un precio que no tiene', () => {
    const bloqueWa = APP.slice(APP.indexOf('function mensajeWhatsApp'), APP.indexOf('function palabrasDeBusqueda'));
    const armar = new Function('location', `${bloqueWa}
return mensajeWhatsApp;`)({ origin: 'https://axtech.pages.dev' });
    const texto = decodeURIComponent(armar({ id: 9, title: 'X', pyg_str: 'Gs. 0', sob_consulta: true }));
    assert.ok(texto.includes('Bajo Consulta'), texto);
    assert.ok(!texto.includes('Gs. 0'), texto);
});
