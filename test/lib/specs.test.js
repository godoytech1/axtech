import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerSpecs } from '../../src/lib/specs.js';

const valores = (titulo) => Object.fromEntries(extraerSpecs(titulo).map((s) => [s.etiqueta, s.valor]));

test('extrae el patron completo de un notebook', () => {
    const v = valores('NB HP 15-FA2013DX I5-13420H/8GB/512/RTX3050/15/W11 RTX3050');
    assert.equal(v['Procesador'], 'I5-13420H');
    assert.equal(v['Memoria RAM'], '8 GB');
    assert.equal(v['Tarjeta de video'], 'RTX3050');
    assert.equal(v['Pantalla'], '15"');
    assert.equal(v['Sistema operativo'], 'Windows 11');
});

test('extrae de un monitor con prefijo abreviado', () => {
    const v = valores('MON 55 SAMSUNG SMART LS55CG970NNXGO CURVO 4K QHD 165Hz');
    assert.equal(v['Pantalla'], '55"');
    assert.equal(v['Resolucion'], '4K');
    assert.equal(v['Frecuencia'], '165 Hz');
});

test('extrae de un televisor', () => {
    const v = valores('TV 32 MTEK MK32FSAH SMART ANDROID 11 WIFI/BT');
    assert.equal(v['Pantalla'], '32"');
    assert.equal(v['Sistema operativo'], 'ANDROID 11');
});

test('extrae de una fuente de poder', () => {
    const v = valores('Fuente 650W AZZA PSAZ-650W 80+ BRONZE BIVOLT BLACK');
    assert.equal(v['Potencia'], '650 W');
    assert.match(v['Certificacion'], /BRONZE/);
});

test('extrae la grafica de una tarjeta de video', () => {
    assert.equal(valores('VGA RX7600 8GB XFX SPEEDSTER SWFT210')['Tarjeta de video'], 'RX7600');
    assert.equal(valores('Tarjeta de Video ZOTAC GEFORCE RTX 5090 32GB')['Tarjeta de video'], 'RTX 5090');
});

test('reconoce pulgadas escritas con comillas', () => {
    assert.equal(valores('MONITOR AOC 24" FULL HD IPS')['Pantalla'], '24"');
});

test('no inventa especificaciones cuando el titulo no las tiene', () => {
    assert.deepEqual(extraerSpecs('TEC UP GAMER MG400 PT/BR ESSENTIAL USB BLACK'), []);
});

test('no repite la misma etiqueta dos veces', () => {
    const s = extraerSpecs('NB DELL 16GB DDR5 32GB RAM I7-13700H');
    const etiquetas = s.map((x) => x.etiqueta);
    assert.equal(etiquetas.length, new Set(etiquetas).size);
});

test('los valores no tienen espacios sobrantes', () => {
    for (const s of extraerSpecs('VGA RX7600 8GB XFX SPEEDSTER')) {
        assert.equal(s.valor, s.valor.trim());
        assert.ok(s.valor.length > 0);
    }
});

test('tolera entrada no textual', () => {
    assert.deepEqual(extraerSpecs(null), []);
    assert.deepEqual(extraerSpecs(''), []);
    assert.deepEqual(extraerSpecs(42), []);
});
