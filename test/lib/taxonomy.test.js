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
