import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nombreDeProducto, nombrarCatalogo } from '../../src/lib/nombre.js';

test('el nombre dice marca, modelo y lo que define la compra', () => {
    assert.equal(
        nombreDeProducto('VGA RX7600 8GB XFX SPEEDSTER SWFT210 RX-76PSWF RX-76PSWFTFY SWFT210', 'tarjetas-de-video'),
        'XFX Radeon RX 7600 8GB Speedster SWFT210'
    );
    assert.equal(
        nombreDeProducto('CPU AMD AM4 RYZEN R5 5500 BOX 4.2GHZ S/VIDEO 100-100000457BO X', 'procesadores'),
        'AMD Ryzen 5 5500 4.2GHz AM4 BOX'
    );
});

test('el modelo de una notebook se conserva aunque parezca un codigo', () => {
    // "82XB00C2US" es lo unico que distingue esta Lenovo de otra igual.
    const n = nombreDeProducto('NB LENOVO 82XB00C2US I3-N305/8GB/128/15.6/GREY/W11 INGLES', 'notebooks');
    assert.ok(n.includes('82XB00C2US'), n);
    assert.ok(n.includes('Core i3-N305'), n);
});

test('no repite el mismo concepto en dos idiomas', () => {
    // El proveedor escribe "SEM FIO" y "WIRELESS" en el mismo titulo, y cada
    // capa traducia el suyo: salio publicado "Gamepad Sin Cable Inalambrico".
    const n = nombreDeProducto(
        'CONTROLE LOGITECH F710 GAMEPAD Inalámbrico 940-00011 940-000117 WIRELESS',
        'consolas-y-videojuegos'
    );
    assert.equal(n.toLowerCase().split(/\s+/).filter((w) => /inal[aá]mbrico/.test(w)).length, 1, n);
    assert.ok(!/sin cable/i.test(n), n);
});

test('dos productos distintos no pueden quedar con el mismo nombre', () => {
    // Un ventilador suelto y el pack de tres, a precios distintos.
    const productos = [
        { title: 'COOLER FAN LIAN LI UNI FAN TL WIRELESS 120 BLK UND 12TL1W1B X1', category: 'refrigeracion' },
        { title: 'COOLER FAN LIAN LI UNI FAN TL WIRELESS 120 X3 BLK 12TL1W3B BLACK', category: 'refrigeracion' }
    ];
    const nombres = nombrarCatalogo(productos);
    assert.notEqual(nombres.get(productos[0]), nombres.get(productos[1]));
});

test('nunca devuelve un nombre vacio', () => {
    assert.equal(nombreDeProducto('', 'teclados'), '');
    assert.ok(nombreDeProducto('PRODUCTO RARO SIN FORMATO', 'teclados').length > 0);
});

test('el nombre nunca abre diciendo lo que el producto NO es', () => {
    // Cuando el titulo no trae marca reconocible, el respaldo agarraba la
    // primera palabra util --que era el accesorio al que sirve-- y publicaba
    // un teclado llamado "Tablet BT Universao".
    const n = nombreDeProducto('TEC P/ TABLET BT UNIVERSAO WHITE', 'teclados');
    assert.ok(/^Teclado\b/.test(n), n);
    const f = nombreDeProducto('Fuente P/ NUC 19V Alámbrico', 'fuentes-de-poder');
    assert.ok(/^Fuente\b/.test(f), f);
    assert.ok(!/^Fuente P$/.test(f), 'una letra suelta no es un nombre');
});

test('un modelo de una sola letra no se pierde', () => {
    // El "X" de "Logitech G502 X" es parte del nombre: sin el, se confunde con
    // el G502 normal, que es otro producto a otro precio.
    assert.ok(
        nombreDeProducto('MOUSE LOGITECH G502 X OPTICO USB WHITE 910-006145', 'mouses-y-mousepads')
            .includes('G502 X')
    );
});

test('ningun nombre publicado abre nombrando otro producto', () => {
    // Recorre el catalogo entero: los ejemplos sueltos no alcanzan para una
    // regla que depende de que trae cada titulo.
    const AJENA = /^(?:Tablet|Notebook|Celular|Smartphone|Universal|Universao|Para|Con|Sin)\b/i;
    const cat = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
    const activos = cat.filter((p) => p.status === 'active');
    const nombres = nombrarCatalogo(activos);
    const rotos = activos
        .filter((p) => !['tablets', 'notebooks', 'telefonos-y-celulares'].includes(p.category))
        .filter((p) => AJENA.test(nombres.get(p)))
        .map((p) => `${p.category}: ${nombres.get(p)}`);
    assert.deepEqual(rotos, []);
});

test('una preposicion no puede quedarse sin su sustantivo', () => {
    // En "... HEADSET NC BLACK COM MICROFONE" el corte se comia "MICROFONE" y
    // el nombre quedaba "Headset NC con Negro": el "con" pasaba a referirse al
    // color, que dice algo distinto de lo que el producto trae.
    const n = nombreDeProducto('Auricular EMEET GENIUSCALL HS50 HEADSET NC BLACK con MICROFONE', 'auriculares-y-headsets');
    assert.ok(!/\bcon\s+(?:Negro|Blanco|Gris|Plata|Rojo|Azul)\b/i.test(n), n);
    assert.ok(!/\bcon$/i.test(n), n);
});

// El nombre corto no es solo estetica: el sitio filtra leyendo esa cadena.
// Al acortar los nombres el 31/08 se cayeron cinco filtros sin que nadie lo
// notara --"Ver todo gamer" en Notebooks no devolvia un solo producto-- y
// aparecio recien cuando dylan lo uso el 19/09.

test('el nombre de una notebook conserva la GPU', () => {
    // Es lo que define si es para jugar, y con esa palabra el sitio arma el
    // filtro "Gamer". Sin ella, 40 notebooks gamer quedaban invisibles.
    const n = nombreDeProducto('NB ACER PHN16S-71-98RF ULTRA9-275HX/32/1TB/RTX5070 TI 12GB/16/W11', 'notebooks');
    assert.ok(/RTX 5070/.test(n), n);
});

test('el nombre de un televisor conserva las pulgadas', () => {
    // El titulo las trae en el prefijo ("TV 32 MTEK..."), y borrar el prefijo
    // se las llevaba: el filtro de tamaño quedaba en cero para los 83 TVs.
    const n = nombreDeProducto('TV 32 MTEK MK32FSAH SMART ANDROID 11 WIFI/BT', 'televisores');
    assert.ok(/32"/.test(n), n);
});

test('el nombre de un proyector no repite la unidad', () => {
    const n = nombreDeProducto('PROJETOR DUB 4000 LUMENS DBP4BAT PORTATIL 4000L', 'proyectores');
    assert.ok(/Lúmenes/.test(n), n);
    assert.ok(!/Lumens\s+Lúmenes/i.test(n), n);
});

test('lo que el sitio filtra sigue estando en el nombre', () => {
    // Recorre el catalogo con los mismos terminos que usa app.js. Si un
    // cambio de nombres vuelve a vaciar un filtro, esto falla antes de salir.
    const LINEAS_GAMER = ['rtx', 'gtx', 'gaming', 'gamer', 'nitro', 'predator', 'victus', 'loq', 'tuf'];
    const cat = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
    const activos = cat.filter((p) => p.status === 'active');
    const nombres = nombrarCatalogo(activos);

    const gamerAntes = activos.filter((p) => p.category === 'notebooks'
        && LINEAS_GAMER.some((x) => p.title.toLowerCase().includes(x))).length;
    const gamerAhora = activos.filter((p) => p.category === 'notebooks'
        && LINEAS_GAMER.some((x) => nombres.get(p).toLowerCase().includes(x))).length;
    assert.ok(gamerAhora >= gamerAntes * 0.9,
        `el filtro Gamer ve ${gamerAhora} notebooks y el titulo del proveedor declara ${gamerAntes}`);

    // Solo cuentan los que el proveedor declara con medida: en esta categoria
    // conviven televisores y receptores TV Box, y un TV Box no tiene pulgadas.
    // Lo que se verifica es que el nombre no PIERDA la medida que el titulo
    // traia, no que la invente.
    const conMedida = activos.filter((p) => p.category === 'televisores' && /^TV\s+\d{2,3}\b/i.test(p.title));
    const conservan = conMedida.filter((p) => /\d{2,3}"/.test(nombres.get(p))).length;
    assert.ok(conservan >= conMedida.length * 0.9,
        `solo ${conservan} de ${conMedida.length} televisores conservan las pulgadas que el titulo declaraba`);
});

test('una PC de escritorio se nombra como una notebook: marca, modelo y lo que define la compra', () => {
    // No habia nombrador para el rubro y caian en el generico, que publica lo
    // que sobreviva a la limpieza: un Mini PC GMKtec NucBox M3 salia llamandose
    // "Intel 12TH W11 Pro/eu".
    assert.equal(
        nombreDeProducto('MINI PC GMKTEC NUCBOX M3 INTEL 12TH I5-16/512/W11 W11 PRO/EU I5-12450H', 'pcs-de-escritorio'),
        'Gmktec Nucbox M3 Core i5-12450H 512GB'
    );
    const up = nombreDeProducto('PC UP GAMER TITAN R5 5600X/16GB/1TB NVME/RX7600 550W -4FAN RGB', 'pcs-de-escritorio');
    assert.ok(/UP Gamer/.test(up), up);
    assert.ok(/Ryzen 5 5600X/.test(up), up);
    assert.ok(/1TB/.test(up), up);
});

test('el nombre no arrastra la lista de caracteristicas del proveedor', () => {
    // 115 nombres publicaban el bloque entero: "FTX-702WH Vidrio/tem/atx/matx".
    // Se borra el token con dos barras o mas; con una sola es informacion util.
    const n = nombreDeProducto('GABINETE FTX FTX-702WH VIDRIO/TEM/ATX/MATX Blanco', 'gabinetes');
    assert.ok(!/\w+\/\w+\/\w+/.test(n), n);
    assert.ok(/FTX-702WH/.test(n), n);
});

test('ningun nombre publicado abre con la marca del procesador', () => {
    // Recorre el catalogo entero. Diez equipos abrian diciendo "Intel ...":
    // el fabricante del chip, no el de la computadora. En procesadores y
    // placas de video si es correcto, porque ahi Intel o AMD ES la marca.
    const COMPONENTE = new Set(['procesadores', 'tarjetas-de-video', 'placas-madre', 'memorias-ram']);
    const cat = JSON.parse(readFileSync('data/catalog.json', 'utf8')).filter((p) => p.status === 'active');
    const nombres = nombrarCatalogo(cat);
    const rotos = cat
        .filter((p) => !COMPONENTE.has(p.category))
        .filter((p) => /^(intel|amd|nvidia)\b/i.test(nombres.get(p) || ''))
        .filter((p) => !/\bNUC\d/i.test(p.title))   // las NUC de Intel si son Intel
        .map((p) => `${p.category}: ${nombres.get(p)}`);
    assert.deepEqual(rotos, []);
});

test('el nombre dice que es el producto, no como lo abrevia el proveedor', () => {
    // Los tres los encontro dylan publicados el 2026-09-29.
    // "HUB SWITCH" es un switch: el nombre decia "Hub ... Desktop" y no habia
    // forma de saber que era.
    const sw = nombreDeProducto('HUB SWITCH TP-LINK 10P TL-SG1210MP 8P Gigabit PoE+ DESKTOP', 'redes-y-conectividad');
    assert.ok(/^Switch\b/.test(sw), sw);
    assert.ok(!/desktop/i.test(sw), sw);
    assert.ok(!/Giga Poe/i.test(sw), sw);

    // Un NAS en Almacenamiento sin la palabra "NAS" se lee como un SSD.
    const nas = nombreDeProducto('SERVIDOR NAS ASUSTOR FS6712X QC2.0/12BAY/4GB/GBLAN', 'almacenamiento-ssd');
    assert.ok(/^NAS\b/.test(nas), nas);
    assert.ok(/Asustor/i.test(nas), nas);

    const vent = nombreDeProducto('VENTILADOR XIAOMI SMART DESKTOP AIR CIRCULATION WHITE 9872EU', 'smart-home');
    assert.ok(/^Ventilador\b/.test(vent), vent);
    assert.ok(!/desktop/i.test(vent), vent);
});

test('conservar el tipo en Almacenamiento no toca a los discos normales', () => {
    // El cambio se hizo por los NAS; un SSD o un HD no llevan prefijo de tipo.
    const ssd = nombreDeProducto('SSD 1TB KINGSTON NV3 M.2 NVME PCIE 4.0 SNV3S/1000G', 'almacenamiento-ssd');
    assert.ok(/Kingston/i.test(ssd), ssd);
    assert.ok(!/^(Almacenamiento|NAS)\b/.test(ssd), ssd);
    const hd = nombreDeProducto('HD 2TB SEAGATE BARRACUDA ST2000DM008 7200RPM', 'almacenamiento-ssd');
    assert.ok(/Seagate/i.test(hd), hd);
    assert.ok(!/^(Almacenamiento|NAS)\b/.test(hd), hd);
});
