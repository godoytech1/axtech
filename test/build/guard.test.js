import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarFugas } from '../../src/build/guard.js';

test('no reporta nada en contenido limpio', () => {
    const limpio = 'const PRODUCTS = [{"id":1,"title":"Mouse","pyg":50000}];';
    assert.deepEqual(buscarFugas(limpio, {}), []);
});

test('detecta un campo prohibido', () => {
    const fugas = buscarFugas('{"pyg_orig":7950000}', {});
    assert.equal(fugas.length, 1);
    assert.ok(fugas[0].includes('pyg_orig'));
});

test('detecta varios campos prohibidos a la vez', () => {
    const fugas = buscarFugas('{"usd":"US$ 10","orig_url":"x","title_orig":"y"}', {});
    assert.equal(fugas.length, 3);
});

test('detecta una cadena prohibida como el dominio del proveedor', () => {
    const fugas = buscarFugas('img src="https://proveedor.test/x.jpg"', {
        cadenasProhibidas: ['proveedor.test']
    });
    assert.equal(fugas.length, 1);
    assert.ok(fugas[0].includes('proveedor.test'));
});

test('la busqueda de cadenas prohibidas ignora mayusculas', () => {
    const fugas = buscarFugas('PROVEEDOR.TEST', { cadenasProhibidas: ['proveedor.test'] });
    assert.equal(fugas.length, 1);
});

test('ignora las cadenas prohibidas vacias', () => {
    assert.deepEqual(buscarFugas('cualquier cosa', { cadenasProhibidas: ['', '   '] }), []);
});

test('no confunde un campo prohibido con un nombre que lo contiene', () => {
    assert.deepEqual(buscarFugas('{"pyg_original_no_es_lo_mismo":1}', {}), []);
});

test('funciona sin pasar opciones', () => {
    assert.deepEqual(buscarFugas('contenido limpio'), []);
});
