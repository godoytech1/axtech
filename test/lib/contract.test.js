import test from 'node:test';
import assert from 'node:assert/strict';
import { aPublicoLegado, CAMPOS_PROHIBIDOS } from '../../src/lib/contract.js';

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
        'brand', 'category', 'id', 'image', 'pyg', 'pyg_str', 'sob_consulta', 'specs', 'title'
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

test('specs ausente se normaliza a arreglo vacio', () => {
    const publico = aPublicoLegado(registroValido({ specs: undefined }), OPCIONES);
    assert.deepEqual(publico.specs, []);
});
