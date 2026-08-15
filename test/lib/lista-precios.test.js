import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearLista } from '../../src/lib/lista-precios.js';

const ENCABEZADO = [
    'Proveedor - Informatica e acessorios',
    'Para melhor visualizacao use a fonte Lucida Console.',
    '==============================================================',
    '',
    'Lista de precos 15/08/2026 - 09:14:26 ',
    '=============================================================='
].join('\n');

test('extrae ref, titulo y precio de una linea', () => {
    const r = parsearLista('332726......ABRIDOR DE VINHO SMARTFY AV01B 10W BLACK....U$9,00');
    assert.equal(r.size, 1);
    assert.deepEqual(r.get('332726'), { titulo: 'ABRIDOR DE VINHO SMARTFY AV01B 10W BLACK', usd: 9 });
});

test('interpreta la coma como separador decimal', () => {
    const r = parsearLista('167104......ADAPTADOR COOLER MASTER LGA 1700....U$0,90');
    assert.equal(r.get('167104').usd, 0.9);
});

test('interpreta el punto como separador de miles', () => {
    const r = parsearLista('999999......NOTEBOOK CARO....U$5.220,00');
    assert.equal(r.get('999999').usd, 5220);
});

test('ignora encabezados y separadores', () => {
    assert.equal(parsearLista(ENCABEZADO).size, 0);
});

test('procesa un archivo completo con encabezado', () => {
    const texto = ENCABEZADO + '\n' +
        '332726......PRODUCTO UNO....U$9,00\n' +
        '167104......PRODUCTO DOS....U$0,90\n';
    const r = parsearLista(texto);
    assert.equal(r.size, 2);
    assert.equal(r.get('332726').usd, 9);
});

test('descarta precios de cero o negativos', () => {
    assert.equal(parsearLista('111111......SIN PRECIO....U$0,00').size, 0);
});

test('conserva el ultimo si un ref aparece repetido', () => {
    const r = parsearLista(
        '222222......VERSION VIEJA....U$10,00\n' +
        '222222......VERSION NUEVA....U$12,00'
    );
    assert.equal(r.size, 1);
    assert.equal(r.get('222222').usd, 12);
    assert.equal(r.get('222222').titulo, 'VERSION NUEVA');
});

test('recorta espacios sobrantes del titulo', () => {
    const r = parsearLista('333333......  TITULO CON ESPACIOS  ....U$5,00');
    assert.equal(r.get('333333').titulo, 'TITULO CON ESPACIOS');
});

test('tolera texto vacio o no textual', () => {
    assert.equal(parsearLista('').size, 0);
    assert.equal(parsearLista(null).size, 0);
    assert.equal(parsearLista(undefined).size, 0);
});
