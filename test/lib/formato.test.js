import test from 'node:test';
import assert from 'node:assert/strict';
import { formatearGs } from '../../src/lib/formato.js';

test('formatea con punto como separador de miles', () => {
    assert.equal(formatearGs(8050000), 'Gs. 8.050.000');
});

test('formatea montos de menos de mil sin separador', () => {
    assert.equal(formatearGs(500), 'Gs. 500');
});

test('formatea exactamente mil', () => {
    assert.equal(formatearGs(1000), 'Gs. 1.000');
});

test('redondea decimales al entero mas cercano', () => {
    assert.equal(formatearGs(1000.6), 'Gs. 1.001');
});

test('formatea cero', () => {
    assert.equal(formatearGs(0), 'Gs. 0');
});

test('devuelve null para valores no numericos', () => {
    assert.equal(formatearGs(null), null);
    assert.equal(formatearGs(undefined), null);
    assert.equal(formatearGs(NaN), null);
    assert.equal(formatearGs('8050000'), null);
});
