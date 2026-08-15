import test from 'node:test';
import assert from 'node:assert/strict';
import { slugificar, slugDeProducto } from '../../src/lib/slug.js';

test('pasa a minusculas y une con guiones', () => {
    assert.equal(slugificar('Tarjeta De Video'), 'tarjeta-de-video');
});

test('quita acentos y enies', () => {
    assert.equal(slugificar('Periféricos y Diseño'), 'perifericos-y-diseno');
});

test('elimina simbolos y comillas', () => {
    assert.equal(slugificar('TV 100" JVC 4K/SMART'), 'tv-100-jvc-4k-smart');
});

test('colapsa separadores repetidos', () => {
    assert.equal(slugificar('SSD   ---   1TB'), 'ssd-1tb');
});

test('no deja guiones al principio ni al final', () => {
    assert.equal(slugificar('  --Monitor--  '), 'monitor');
});

test('limita a 60 caracteres sin dejar guion colgando', () => {
    const largo = slugificar('a'.repeat(80));
    assert.ok(largo.length <= 60);
    assert.ok(!largo.endsWith('-'));
});

test('devuelve cadena vacia si no queda nada utilizable', () => {
    assert.equal(slugificar('!!!'), '');
    assert.equal(slugificar(''), '');
    assert.equal(slugificar(null), '');
});

test('el slug de producto agrega el id como sufijo', () => {
    assert.equal(slugDeProducto('Monitor AOC 24"', 10122), 'monitor-aoc-24-10122');
});

test('el slug de producto usa un respaldo si el titulo no aporta nada', () => {
    assert.equal(slugDeProducto('!!!', 10122), 'producto-10122');
});

test('el slug de producto es unico para el mismo titulo con distinto id', () => {
    assert.notEqual(slugDeProducto('Mouse', 1), slugDeProducto('Mouse', 2));
});
