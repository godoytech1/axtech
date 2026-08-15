import test from 'node:test';
import assert from 'node:assert/strict';
import {
    repararMojibake, traducir, limpiarTitulo, normalizarTitulo
} from '../../src/lib/normalize.js';

// U+FFFD es el caracter de reemplazo que quedo donde habia una vocal acentuada
// cuando el scraper viejo partio un caracter UTF-8 multibyte en el borde de un
// chunk. Se escribe escapado para que el fuente sea ASCII puro.
const R = String.fromCharCode(0xFFFD);

test('repara MEMORIA con vocal perdida', () => {
    assert.equal(repararMojibake(`MEM${R}RIA MARKVISION DDR3L`), 'MEMORIA MARKVISION DDR3L');
});

test('repara VIDEO con vocal perdida', () => {
    assert.equal(repararMojibake(`PLACA DE V${R}DEO ZOTAC RTX5090`), 'PLACA DE VIDEO ZOTAC RTX5090');
});

test('repara y traduce al espanol en un paso', () => {
    // Las palabras corruptas que ademas estaban en portugues se reparan
    // directo al espanol: no tiene sentido reconstruir "RECARREGAVEL" para
    // despues traducirlo.
    assert.equal(repararMojibake(`PILHAS RECARREG${R}VEL PHILIPS AA`), 'PILHAS RECARGABLE PHILIPS AA');
    assert.equal(repararMojibake(`PLACA M${R}E ASUS B550`), 'PLACA MADRE ASUS B550');
});

test('un separador perdido se convierte en espacio, no en nada', () => {
    // Caso medido: MSI?PRO, XIAOMI?4K, USB?3.0. Borrar el caracter pegaria
    // las palabras; el respaldo pone un espacio.
    assert.equal(repararMojibake(`MSI${R}PRO B550`), 'MSI PRO B550');
    assert.equal(repararMojibake(`XIAOMI${R}4K`), 'XIAOMI 4K');
});

test('repara los casos con dos caracteres corruptos en la misma palabra', () => {
    assert.equal(repararMojibake(`GRAVA${R}${R}O DE VIDEO`), 'GRABACION DE VIDEO');
    assert.equal(repararMojibake(`EDI${R}${R}O LIMITADA`), 'EDICION LIMITADA');
});

test('deja intacto el texto sin corrupcion', () => {
    assert.equal(repararMojibake('MONITOR AOC 24 FULL HD'), 'MONITOR AOC 24 FULL HD');
});

test('quita cualquier caracter de reemplazo que no coincida con un patron conocido', () => {
    const r = repararMojibake(`COSA ${R} RARA`);
    assert.ok(!r.includes(R), 'no debe quedar ningun U+FFFD');
});

test('tolera entrada no textual', () => {
    assert.equal(repararMojibake(null), '');
    assert.equal(repararMojibake(undefined), '');
    assert.equal(repararMojibake(123), '');
});

test('traduce colores del portugues', () => {
    assert.equal(traducir('GABINETE PRETO'), 'GABINETE Negro');
    assert.equal(traducir('MOUSE BRANCO'), 'MOUSE Blanco');
});

test('traduce terminos tecnicos del portugues', () => {
    assert.equal(traducir('CONTROLE SEM FIO'), 'CONTROLE Sin Cable');
    assert.equal(traducir('FONTE 650W'), 'Fuente 650W');
    assert.equal(traducir('TECLADO SEM FIO'), 'TECLADO Sin Cable');
});

test('traduce solo palabras completas', () => {
    // "FONTELA" contiene "fonte" pero no debe traducirse.
    assert.equal(traducir('MARCA FONTELA'), 'MARCA FONTELA');
});

test('normaliza unidades de frecuencia y tiempo de respuesta', () => {
    assert.equal(limpiarTitulo('MONITOR 144 hz 1 ms'), 'MONITOR 144Hz 1Ms');
});

test('colapsa espacios repetidos y recorta', () => {
    assert.equal(limpiarTitulo('  SSD   1TB  '), 'SSD 1TB');
});

test('quita separadores colgando al final', () => {
    assert.equal(limpiarTitulo('TV 32 ECOPOWER HD/SMARTV/HDMI -'), 'TV 32 ECOPOWER HD/SMARTV/HDMI');
    assert.equal(limpiarTitulo('MOUSE LOGITECH,'), 'MOUSE LOGITECH');
});

test('normalizarTitulo aplica reparacion, traduccion y limpieza en orden', () => {
    assert.equal(
        normalizarTitulo(`MEM${R}RIA KEEPDATA DDR2 2GB, PRETO  -`),
        'MEMORIA KEEPDATA DDR2 2GB, Negro'
    );
});

test('normalizarTitulo tolera entrada vacia o no textual', () => {
    assert.equal(normalizarTitulo(''), '');
    assert.equal(normalizarTitulo(null), '');
    assert.equal(normalizarTitulo(undefined), '');
});
