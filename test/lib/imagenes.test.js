import test from 'node:test';
import assert from 'node:assert/strict';
import { nombreDeArchivo, rutaPublica } from '../../src/lib/imagenes.js';

test('el nombre usa el id interno, no el codigo del proveedor', () => {
    assert.equal(nombreDeArchivo(10122), '10122.webp');
    assert.equal(nombreDeArchivo(4), '4.webp');
});

test('la ruta publica cuelga de /img', () => {
    assert.equal(rutaPublica(10122), '/img/10122.webp');
});

test('la ruta no contiene ninguna referencia externa', () => {
    assert.ok(!rutaPublica(10122).includes('http'));
    assert.ok(rutaPublica(10122).startsWith('/'));
});
