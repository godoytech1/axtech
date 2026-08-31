import test from 'node:test';
import assert from 'node:assert/strict';
import {
    repararMojibake, traducir, limpiarTitulo, normalizarTitulo, sinGarantia, quitarGarantia
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

test('traduce el portugues que llegaba a la ficha del producto', () => {
    assert.equal(traducir('CPU OEM AMD AM4 R7 5700X SEM GARANTIA'), 'CPU OEM AMD AM4 R7 5700X Sin Garantía');
    assert.equal(traducir('HD 1TB SEAGATE PULL SEM GARNATIA'), 'HD 1TB SEAGATE PULL Sin Garantía');
    assert.equal(traducir('ROUTER DECO E4 PACK-2 SEM CAIXA'), 'ROUTER DECO E4 PACK-2 Sin Caja');
    assert.equal(traducir('Fuente 400W SATE BIVOLT NAO MODULAR'), 'Fuente 400W SATE BIVOLT No MODULAR');
});

test('las frases con "sem" se traducen antes que la palabra suelta', () => {
    assert.equal(traducir('MOUSE RAZER SEM FIO'), 'MOUSE RAZER Sin Cable');
    assert.equal(traducir('GABINETE AIGO SEM FAN'), 'GABINETE AIGO Sin FAN');
});

test('"anos" solo se traduce pegado a la garantia', () => {
    assert.equal(traducir('MEM DDR3 8GB GARANTIA 2 ANOS'), 'MEM DDR3 8GB Garantía 2 Años');
    // Suelto no se toca: el catalogo esta lleno de codigos de modelo.
    assert.equal(traducir('TECLADO MODELO ANOS X1'), 'TECLADO MODELO ANOS X1');
});

test('repara el titulo que el proveedor corta a la mitad', () => {
    // "GARANTIA 2 AS" es "ANOS" partido; se veia asi en la tienda el 31/08.
    assert.equal(traducir('MEM DDR3 8GB UP1600 GARANTIA 2 AS'), 'MEM DDR3 8GB UP1600 Garantía 2 Años');
});

test('traducir es idempotente: el sync reescribe el titulo cada noche', () => {
    const una = traducir('CPU OEM INTEL I5 9500 SEM GARANTIA');
    assert.equal(traducir(una), una);
});

test('sinGarantia lee el aviso del proveedor en cualquiera de sus formas', () => {
    assert.equal(sinGarantia('CPU OEM AMD R7 5700X S/CX S/FAN SEM GARANTIA'), true);
    assert.equal(sinGarantia('CPU OEM AMD R7 5700X S/CX S/FAN Sin Garantía'), true);
    assert.equal(sinGarantia('RTX3060TI CPO - S/Caja, S/GARANTIA'), true);
    assert.equal(sinGarantia('CPU OEM INTEL I5 9500 S/CX S/FAN S/G'), true);
    // Tener garantia no es no tenerla.
    assert.equal(sinGarantia('MEM DDR3 8GB GARANTIA 2 ANOS'), false);
    assert.equal(sinGarantia('HD 8TB SEAGATE GARANTIA BR'), false);
    assert.equal(sinGarantia('MOUSE LOGITECH G203'), false);
});

test('quitarGarantia saca la palabra pero deja la jerga del rubro', () => {
    assert.equal(normalizarTitulo('CPU OEM AMD R7 5700X S/CX S/FAN SEM GARANTIA'), 'CPU OEM AMD R7 5700X S/CX S/FAN');
    assert.equal(normalizarTitulo('MEM DDR3 8GB UP1600 GARANTIA 2 ANOS'), 'MEM DDR3 8GB UP1600');
    assert.equal(normalizarTitulo('HD 8TB SEAGATE ST8000DM004 GARANTIA BR'), 'HD 8TB SEAGATE ST8000DM004');
    // S/CX, S/FAN y S/G describen el producto: no dicen "garantia" y se quedan.
    assert.equal(normalizarTitulo('CPU OEM INTEL I5 9500 S/CX S/FAN S/G'), 'CPU OEM INTEL I5 9500 S/CX S/FAN S/G');
});

test('normalizarTitulo es idempotente', () => {
    const una = normalizarTitulo('CPU OEM AMD R7 5700X S/CX SEM GARANTIA');
    assert.equal(normalizarTitulo(una), una);
});
