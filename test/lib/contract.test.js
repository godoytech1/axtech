import test from 'node:test';
import assert from 'node:assert/strict';
import { aPublicoLegado, CAMPOS_PROHIBIDOS } from '../../src/lib/contract.js';
import { readFileSync } from 'node:fs';

const OPCIONES = { idsSinImagen: new Set() };

function registroValido(extra = {}) {
    return {
        id: 10122,
        ref: '329967',
        slug: 'tv-100-jvc-10122',
        title: 'TV 100 JVC LT-100KM958',
        brand: 'JVC',
        category: 'Televisores',
        specs: ['100"', '4K'],
        price: 8050000,
        status: 'active',
        firstSeen: '2026-03-02',
        lastSeen: '2026-08-15',
        ...extra
    };
}

test('proyecta solo los campos que app.js consume', () => {
    const publico = aPublicoLegado(registroValido(), OPCIONES);
    assert.deepEqual(Object.keys(publico).sort(), [
        'brand', 'category', 'id', 'image', 'pyg', 'pyg_str', 'sin_garantia', 'sob_consulta', 'specs', 'title'
    ]);
});

test('formatea el precio y conserva el valor numerico', () => {
    const publico = aPublicoLegado(registroValido(), OPCIONES);
    assert.equal(publico.pyg, 8050000);
    assert.equal(publico.pyg_str, 'Gs. 8.050.000');
});

test('la imagen apunta a un archivo propio, no al proveedor', () => {
    const publico = aPublicoLegado(registroValido(), OPCIONES);
    assert.equal(publico.image, '/img/10122.webp');
});

test('no publica productos sin imagen propia', () => {
    // Regla 3 de AGENTS.md: nunca mostrar un producto sin imagen real.
    const opciones = { idsSinImagen: new Set([10122]) };
    assert.equal(aPublicoLegado(registroValido(), opciones), null);
});

test('el ref no aparece en ninguna parte de la salida', () => {
    const publico = aPublicoLegado(registroValido(), OPCIONES);
    assert.ok(!JSON.stringify(publico).includes('329967'));
});

test('funciona sin pasar opciones', () => {
    assert.equal(aPublicoLegado(registroValido()).image, '/img/10122.webp');
});

test('sob_consulta siempre es false: los ocultos no se publican', () => {
    assert.equal(aPublicoLegado(registroValido(), OPCIONES).sob_consulta, false);
});

test('descarta los registros ocultos', () => {
    assert.equal(aPublicoLegado(registroValido({ status: 'hidden' }), OPCIONES), null);
});

test('descarta los registros sin precio valido', () => {
    assert.equal(aPublicoLegado(registroValido({ price: 0 }), OPCIONES), null);
    assert.equal(aPublicoLegado(registroValido({ price: null }), OPCIONES), null);
});

test('ningun campo prohibido sobrevive a la proyeccion', () => {
    const contaminado = registroValido({
        pyg_orig: 7950000,
        usd: 'US$ 1.250,00',
        brl: 'R$ 6.600,00',
        orig_url: 'https://proveedor.test/producto/329967.html',
        title_orig: 'TV 100 JVC ORIGINAL'
    });
    const publico = aPublicoLegado(contaminado, OPCIONES);
    for (const campo of CAMPOS_PROHIBIDOS) {
        assert.ok(!(campo in publico), `el campo prohibido "${campo}" llego a la salida publica`);
    }
});

test('el ref no viaja al navegador aunque se use para la imagen', () => {
    const publico = aPublicoLegado(registroValido(), OPCIONES);
    assert.equal(publico.ref, undefined);
});

test('specs ausente siempre da un arreglo, nunca undefined', () => {
    // Lo que importa es que el front nunca reciba undefined. El contenido
    // puede venir del registro o derivarse del titulo; lo cubren los tests
    // de mas abajo.
    const publico = aPublicoLegado(registroValido({ specs: undefined }), OPCIONES);
    assert.ok(Array.isArray(publico.specs));
});

test('cuando el registro no trae specs, se derivan del titulo', () => {
    // Antes, 963 productos mostraban ficha completa en su pagina estatica y
    // ficha VACIA en el modal de la portada: el mismo producto con dos fichas
    // distintas segun por donde se llegara.
    const p = aPublicoLegado({
        id: 1, status: 'active', price: 1000,
        title: 'NB HP 14-EM0002WM ATHLON-7120U/4GB/128GB/14/W11 BLUE/INGLES',
        brand: 'HP', category: 'notebooks'
    });
    assert.ok(p.specs.length >= 3, `esperaba specs derivadas, hubo ${p.specs.length}`);
    assert.ok(p.specs.some((s) => s.startsWith('Procesador: ')));
});

test('las specs propias del registro tienen prioridad sobre las derivadas', () => {
    const p = aPublicoLegado({
        id: 1, status: 'active', price: 1000,
        title: 'NB HP 14-EM0002WM ATHLON-7120U/4GB/128GB/14/W11',
        brand: 'HP', category: 'notebooks', specs: ['Color negro']
    });
    assert.deepEqual(p.specs, ['Color negro']);
});

test('un titulo del que no se puede extraer nada da specs vacias, no null', () => {
    const p = aPublicoLegado({
        id: 1, status: 'active', price: 1000,
        title: 'CABLE HDMI 1M', brand: 'GENERIC', category: 'adaptadores-y-cables'
    });
    assert.ok(Array.isArray(p.specs));
});

test('ningun producto del catalogo lleva la garantia en el nombre', () => {
    // Decision del dueño el 31/08: el nombre dice QUE es el producto; la
    // garantia va en su propio renglon de la ficha, desde el campo sinGarantia.
    const conGarantia = JSON.parse(readFileSync('data/catalog.json', 'utf8'))
        .filter((p) => /garant/i.test(p.title))
        .map((p) => p.title);
    assert.deepEqual(conGarantia, []);
});
