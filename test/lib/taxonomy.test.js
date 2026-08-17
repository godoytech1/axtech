import test from 'node:test';
import assert from 'node:assert/strict';
import {
    CATEGORIAS, SLUG_PROVEEDOR_A_CATEGORIA, IDS_EN_REGLAS, clasificar, detectarMarca
} from '../../src/lib/taxonomy.js';

test('ninguna categoria es un cajon de sastre llamado Perifericos', () => {
    assert.ok(!CATEGORIAS.some((c) => /perif/i.test(c.id)));
    assert.ok(CATEGORIAS.length >= 24, 'deberia haber al menos 24 categorias');
});

test('cada categoria tiene id, nombre e icono, y los ids son unicos', () => {
    const vistos = new Set();
    for (const c of CATEGORIAS) {
        assert.ok(c.id && c.nombre && c.icono, `categoria incompleta: ${JSON.stringify(c)}`);
        assert.ok(/^[a-z0-9-]+$/.test(c.id), `el id no es un slug: ${c.id}`);
        assert.ok(!vistos.has(c.id), `id duplicado: ${c.id}`);
        vistos.add(c.id);
    }
});

test('toda categoria usada por una regla existe en CATEGORIAS', () => {
    // Sin este test, una regla puede clasificar hacia una categoria que el
    // front no conoce, y esos productos quedan invisibles en la navegacion.
    const ids = new Set(CATEGORIAS.map((c) => c.id));
    for (const id of IDS_EN_REGLAS) {
        assert.ok(ids.has(id), `una regla clasifica hacia una categoria inexistente: ${id}`);
    }
});

test('todo destino del mapa de slugs existe como categoria', () => {
    const ids = new Set(CATEGORIAS.map((c) => c.id));
    for (const destino of Object.values(SLUG_PROVEEDOR_A_CATEGORIA)) {
        assert.ok(ids.has(destino), `el mapa apunta a una categoria inexistente: ${destino}`);
    }
});

test('el slug del proveedor tiene prioridad sobre el titulo', () => {
    const r = clasificar({ titulo: 'MEMORIA PARA NOTEBOOK 8GB', slugProveedor: 'memoria-ram-notebook' });
    assert.equal(r, 'memorias-ram');
});

test('un dispositivo le gana a sus componentes', () => {
    // Caso medido: sin esta regla se clasificaron 15 notebooks en vez de 149.
    assert.equal(clasificar({ titulo: 'NOTEBOOK HP VICTUS, CORE I5, 8GB RAM, 512GB SSD' }), 'notebooks');
    assert.equal(clasificar({ titulo: 'NOTEBOOK ACER NITRO RTX 4060 16GB DDR5 1TB NVME' }), 'notebooks');
});

test('un procesador con graficos integrados no es una tarjeta de video', () => {
    // Caso medido: "Radeon Graphics" en un APU lo mandaba a tarjetas de video.
    assert.equal(clasificar({ titulo: 'Procesador AMD RYZEN 5 5600G, RADEON GRAPHICS, AM4' }), 'procesadores');
});

test('clasifica tarjetas de video reales', () => {
    assert.equal(clasificar({ titulo: 'Tarjeta de Video ZOTAC GEFORCE RTX 5090 32GB' }), 'tarjetas-de-video');
    assert.equal(clasificar({ titulo: 'VGA 8GB SAPPHIRE RX 7600 PULSE' }), 'tarjetas-de-video');
});

test('un accesorio de un dispositivo no es el dispositivo', () => {
    assert.equal(clasificar({ titulo: 'Cable LIGHTNING A USB 1M Blanco' }), 'adaptadores-y-cables');
    assert.equal(clasificar({ titulo: 'Pelicula DE VIDRIO PARA IPHONE 13 PRO' }), 'peliculas-y-fundas');
});

test('clasifica las fuentes escritas solo como "Fuente NNNW"', () => {
    // Caso medido: 99 fuentes quedaban sin clasificar por exigir "fonte".
    assert.equal(clasificar({ titulo: 'Fuente 650W GIGABYTE GP-P650G 80+Oro' }), 'fuentes-de-poder');
});

test('clasifica pilas y baterias como energia', () => {
    assert.equal(clasificar({ titulo: 'Pila 27A 12V SUNKING ALKALINA CARTELA 5 UNIDADES' }), 'ups-y-energia');
});

test('clasifica dispositivos zigbee como domotica', () => {
    assert.equal(clasificar({ titulo: 'ZIGBEE ZEMISMART LAMPADA RGB ZB-GU53' }), 'smart-home');
    assert.equal(clasificar({ titulo: 'SONOFF INTERRUPTOR SMART PAREDE T3EU1C' }), 'smart-home');
    assert.equal(clasificar({ titulo: 'TOMADA SMART TP-LINK WIFI TAPO P110' }), 'smart-home');
});

test('devuelve null cuando no puede decidir', () => {
    assert.equal(clasificar({ titulo: 'ARTICULO GENERICO XYZ 12345' }), null);
    assert.equal(clasificar({ titulo: '' }), null);
    assert.equal(clasificar({}), null);
    assert.equal(clasificar(), null);
});

test('detecta marcas conocidas', () => {
    assert.equal(detectarMarca('NOTEBOOK HP VICTUS 15'), 'HP');
    assert.equal(detectarMarca('Tarjeta de Video ZOTAC RTX 5090'), 'ZOTAC');
});

test('la marca mas larga gana cuando una contiene a otra', () => {
    assert.equal(detectarMarca('GABINETE COOLER MASTER MB520'), 'COOLER MASTER');
});

test('resuelve alias de marca', () => {
    assert.equal(detectarMarca('TECLADO LOGI MX KEYS'), 'LOGITECH');
});

test('devuelve null si no reconoce la marca', () => {
    assert.equal(detectarMarca('PRODUCTO SIN MARCA CONOCIDA'), null);
    assert.equal(detectarMarca(null), null);
});

// Casos encontrados al preparar el sync automatico: 6 productos activos cuyo
// titulo en la lista ya no clasificaba. Tres de ellos ademas estaban
// publicados en la categoria equivocada.

test('un controlador ARGB es refrigeracion, no una consola', () => {
    // "CONTROLADOR" es un hub de ventiladores y RGB. Estaba publicado en
    // "Consolas y Videojuegos", donde ningun comprador lo buscaria.
    assert.equal(clasificar({ titulo: 'CONTROLADOR SATE ARGB ACB-5 BLACK 9X3PIN 9XPWM' }), 'refrigeracion');
    assert.equal(clasificar({ titulo: 'CONTROLADOR SATE ARGB ACB-71 BLACK 10X3PIN 8XPWM SATA POWER' }), 'refrigeracion');
});

test('un control de consola sigue siendo consola', () => {
    // El arreglo de arriba no puede llevarse por delante los mandos de verdad.
    assert.equal(clasificar({ titulo: 'CONTROLE XBOX SERIES X WIRELESS BLACK' }), 'consolas-y-videojuegos');
    assert.equal(clasificar({ titulo: 'JOYSTICK DUALSENSE PS5 WHITE' }), 'consolas-y-videojuegos');
});

test('los equipos Ubiquiti de exterior son redes', () => {
    assert.equal(clasificar({ titulo: 'UI. NANOSTATION5 AIRMAX NS5-BR 5GHZ 14DBI' }), 'redes-y-conectividad');
    assert.equal(clasificar({ titulo: 'UI. NBE-M5-16-BR 5GHZ NANOBEAM 16DBI' }), 'redes-y-conectividad');
    assert.equal(clasificar({ titulo: 'UI. NHD-COVER-MARBLE CAPA-TAMPA PARA UAP NANOHD 1P' }), 'redes-y-conectividad');
});

// --- Cuatro grupos mal clasificados, encontrados comparando que reglas
// compiten por cada titulo. En todos, una palabra que era una CARACTERISTICA
// del producto le ganaba a la palabra que decia QUE ERA el producto.

test('un teclado con cable es un teclado, no un cable', () => {
    // "C/Cable" es "con cable": una caracteristica, no el producto.
    // Afectaba a 57 productos, entre ellos fuentes y cargadores.
    assert.equal(clasificar({ titulo: 'TEC REDRAGON K530RGB-PRO DRACONIC MEC.USA C/Cable BLACK BROWN' }), 'teclados');
    assert.equal(clasificar({ titulo: 'Cargador XIAOMI 120W C/Cable CHARGING COMBO WHITE USB-A' }), 'ups-y-energia');
});

test('un cable de verdad sigue siendo un cable', () => {
    assert.equal(clasificar({ titulo: 'Cable DE FORCA P/ Fuente 1.5M PADRAO USA' }), 'adaptadores-y-cables');
    assert.equal(clasificar({ titulo: 'ADAPTADOR USB P/ RJ45 TP-LINK UE300 USB 3.0' }), 'adaptadores-y-cables');
});

test('un gabinete Cooler Master es un gabinete, no refrigeracion', () => {
    // La marca del fabricante le ganaba al tipo de producto. 61 gabinetes.
    assert.equal(clasificar({ titulo: 'GABINETE COOLER MASTER SNEAKER-X CPT KIT RED/WHITE' }), 'gabinetes');
    assert.equal(clasificar({ titulo: 'GABINETE COOLER MASTER MASTERBOX Q300L V2 ARGB BLK' }), 'gabinetes');
    assert.equal(clasificar({ titulo: 'GABINETE GAMEMAX T20 BLACK S/FAN BTF SFX USA Fuente ITX' }), 'gabinetes');
});

test('un ventilador PARA gabinete sigue siendo refrigeracion', () => {
    // El arreglo de arriba no puede llevarse por delante los coolers de caja.
    assert.equal(clasificar({ titulo: 'COOLER FAN P/ GABINETE 8X8 Negro' }), 'refrigeracion');
    assert.equal(clasificar({ titulo: 'COOLER FAN MTEK MF-120 RGB 120MM P/ GABINETE' }), 'refrigeracion');
});

test('VGA como PUERTO no convierte a una placa madre en placa de video', () => {
    // "HDMI/VGA" es la lista de salidas de video de la placa. 120 productos,
    // casi todos placas madre, estaban en Tarjetas de Video.
    assert.equal(clasificar({ titulo: 'MB AM4 UP GAMER A520M HDMI/VGA/M.2/DDR4' }), 'placas-madre');
    assert.equal(clasificar({ titulo: 'MB 1700 ASUS PRIME H610M-A D4 DDR4 HDMI/DP/VGA/2M' }), 'placas-madre');
});

test('una placa de video de verdad sigue siendo placa de video', () => {
    assert.equal(clasificar({ titulo: 'VGA RX7600 8GB XFX SPEEDSTER SWFT210' }), 'tarjetas-de-video');
    assert.equal(clasificar({ titulo: 'VGA GT730 4GB STAR DDR3 128BITS DVI/HDMI' }), 'tarjetas-de-video');
    assert.equal(clasificar({ titulo: 'PLACA DE VIDEO ASUS RTX 4070 12GB' }), 'tarjetas-de-video');
});

test('unos auriculares Redmi son auriculares, no un telefono', () => {
    // La marca de celulares le ganaba al tipo de producto. 22 auriculares.
    assert.equal(clasificar({ titulo: 'FONE XIAOMI REDMI BUDS 5 Blanco M2316E1 BHR7626CN' }), 'auriculares-y-headsets');
    assert.equal(clasificar({ titulo: 'FONE XIAOMI REDMI BUDS 6 PLAY Negro M2420E1' }), 'auriculares-y-headsets');
});

test('un celular Redmi sigue siendo un celular', () => {
    assert.equal(clasificar({ titulo: 'CEL XIAOMI REDMI NOTE 14 256GB 8GB Negro' }), 'telefonos-y-celulares');
});

// Productos que nunca clasificaron por titulo y arrastraban una categoria
// vieja de la migracion: quedaban publicados en el lugar equivocado sin que
// nada lo reportara.

test('una PC armada es una PC de escritorio, no un procesador', () => {
    assert.equal(clasificar({ titulo: 'PC UP GAMER LIGHT I3 3220/8GB/240SSD/230W' }), 'pcs-de-escritorio');
    assert.equal(clasificar({ titulo: 'PC UP GAMER R5 5600GT/16GB/512GB/600W 4FAN RGB' }), 'pcs-de-escritorio');
    assert.equal(clasificar({ titulo: 'PC UP MONTADO I5 4A/16GB/GT740 4GB/480GB/400W' }), 'pcs-de-escritorio');
});

test('una caja de streaming va con los televisores', () => {
    assert.equal(clasificar({ titulo: 'AMAZON FIRE TV STICK HD 2024 4697713' }), 'televisores');
});

test('un proyector no es una placa de video', () => {
    // Estaban en Tarjetas de Video por el puerto VGA de su ficha. Pasaron por
    // Televisores mientras no habia categoria propia; hoy tienen la suya.
    assert.equal(clasificar({ titulo: 'PROJETOR OPTOMA ZX300 3500 LUMENS VGA/USB/WHITE' }), 'proyectores');
    assert.equal(clasificar({ titulo: 'PROJETOR ACER X1128I 4800 LUMENS HDMI VGA BIVOLT' }), 'proyectores');
});

// --- Proyectores -----------------------------------------------------------
//
// La regla no necesita ninguna exclusion. De los 28 productos del proveedor
// que dicen "PROJETOR", 21 son proyectores y 7 son accesorios PARA uno: 5
// cables VGA y 2 soportes. Los accesorios ya se resuelven antes que los
// dispositivos (regla 1 del orden), asi que se quedan donde estan solos.

test('un proyector es un proyector', () => {
    assert.equal(clasificar({ titulo: 'PROJETOR EPSON CO-W01 3000L/WXGA/HDMI' }), 'proyectores');
    assert.equal(clasificar({ titulo: 'PROJETOR ACER X1128I 4800 LUMENS HDMI VGA BIVOLT' }), 'proyectores');
    assert.equal(clasificar({ titulo: 'PROJETOR DUB HOME CINEMA DUB 3800 ANDROID/4K/BT5.0' }), 'proyectores');
    assert.equal(clasificar({ titulo: 'PROYECTOR PORTATIL 1080P HDMI' }), 'proyectores');
});

test('un cable PARA proyector sigue siendo un cable', () => {
    assert.equal(clasificar({ titulo: 'Cable VGA 10M MICROFINS P/ MON E PROJETOR 15 PINS' }), 'adaptadores-y-cables');
    assert.equal(clasificar({ titulo: 'Cable VGA 40M C/ FILTRO PROJETOR/MONITOR 15 PINOS' }), 'adaptadores-y-cables');
});

test('un soporte PARA proyector sigue siendo un soporte', () => {
    assert.equal(clasificar({ titulo: 'Soporte P/ PROJETOR FTX FTX-18F 13,5KG Negro' }), 'soportes-y-bases');
});

test('un proyector ya no cae en televisores', () => {
    // Se agruparon ahi mientras no habia categoria propia.
    assert.notEqual(clasificar({ titulo: 'PROJETOR OPTOMA ZX300 3500 LUMENS VGA/USB/WHITE' }), 'televisores');
});

test('las cajas de streaming siguen en televisores', () => {
    assert.equal(clasificar({ titulo: 'AMAZON FIRE TV STICK HD 2024 4697713' }), 'televisores');
    assert.equal(clasificar({ titulo: 'SMART TV 50 SAMSUNG 4K UHD' }), 'televisores');
});
