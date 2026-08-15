import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parsearLista } from '../../src/lib/lista-precios.js';

// Fixtures sinteticas: mismo formato que la lista real, datos inventados.
// Se regeneran con `node test/fixtures/generar.js`.
const FIXTURA_OK = readFileSync('test/fixtures/lista-ok.txt', 'latin1');
const FIXTURA_ROTA = readFileSync('test/fixtures/lista-rota.txt', 'latin1');

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

// --- Contra la fixtura completa -------------------------------------------
//
// Los tests de arriba prueban lineas sueltas. Estos prueban un archivo entero
// con encabezado, pie, saltos CRLF, basura intercalada y acentos en latin1:
// las cuatro cosas que en un archivo real rompen un parser que solo se probo
// contra lineas sueltas.

test('parsea la fixtura completa ignorando encabezado, pie y basura', () => {
    const m = parsearLista(FIXTURA_OK);
    // 6 lineas con formato de producto: una tiene precio 0 y otra repite ref.
    assert.equal(m.size, 4);
    assert.deepEqual([...m.keys()].sort(), ['100001', '100002', '100003', '99999']);
});

test('la fixtura conserva los acentos leidos como latin1', () => {
    const m = parsearLista(FIXTURA_OK);
    assert.equal(m.get('99999').titulo, `MOUSE ACME M100 ${String.fromCharCode(0xD3)}PTICO`);
});

test('acepta refs de 5 y de 6 digitos', () => {
    const m = parsearLista(FIXTURA_OK);
    assert.equal(m.get('99999').usd, 9);
    assert.equal(m.get('100001').usd, 1.5);
});

test('en la fixtura el ref repetido queda con la ultima version', () => {
    assert.match(parsearLista(FIXTURA_OK).get('100002').titulo, /REV2$/);
    assert.equal(parsearLista(FIXTURA_OK).get('100002').usd, 49.9);
});

test('el separador de miles funciona dentro del archivo completo', () => {
    assert.equal(parsearLista(FIXTURA_OK).get('100003').usd, 5220);
});

test('una pagina de error HTML no produce ningun producto', () => {
    // Este es el caso peligroso: si el parser inventara productos a partir de
    // basura, el sync los tomaria por buenos. Y si devuelve cero, es el freno
    // de src/sync/verificar.js el que aborta.
    assert.equal(parsearLista(FIXTURA_ROTA).size, 0);
});
