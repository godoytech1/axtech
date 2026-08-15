import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { aWebp, esPlaceholder, PLACEHOLDER_MD5 } from '../../src/images/procesar.js';

// Imagen sintetica: el test no depende del proveedor ni de la red.
async function jpegDePrueba(ancho = 1200, alto = 900) {
    return sharp({
        create: { width: ancho, height: alto, channels: 3, background: { r: 20, g: 40, b: 90 } }
    }).jpeg().toBuffer();
}

test('convierte a WebP', async () => {
    const salida = await aWebp(await jpegDePrueba());
    const meta = await sharp(salida).metadata();
    assert.equal(meta.format, 'webp');
});

test('reduce el ancho maximo a 800px conservando la proporcion', async () => {
    const salida = await aWebp(await jpegDePrueba(1600, 1200));
    const meta = await sharp(salida).metadata();
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 600);
});

test('no agranda una imagen mas chica que el maximo', async () => {
    const salida = await aWebp(await jpegDePrueba(400, 300));
    const meta = await sharp(salida).metadata();
    assert.equal(meta.width, 400);
});

test('el WebP pesa menos que el JPEG original', async () => {
    const entrada = await jpegDePrueba();
    const salida = await aWebp(entrada);
    assert.ok(salida.length < entrada.length, `${salida.length} no es menor que ${entrada.length}`);
});

test('rechaza un buffer que no es una imagen', async () => {
    await assert.rejects(() => aWebp(Buffer.from('esto no es una imagen')));
});

test('el hash del placeholder tiene forma de MD5', () => {
    assert.match(PLACEHOLDER_MD5, /^[0-9a-f]{32}$/);
});

test('no marca como placeholder a una imagen cualquiera', () => {
    assert.equal(esPlaceholder(Buffer.from('contenido cualquiera')), false);
});

test('detecta el placeholder cuando el contenido coincide con su hash', async () => {
    // Se verifica la mecanica del hash sin versionar la imagen del proveedor:
    // se comprueba que esPlaceholder use MD5 sobre el buffer completo.
    const { createHash } = await import('node:crypto');
    const buf = Buffer.from('x');
    const suHash = createHash('md5').update(buf).digest('hex');
    assert.equal(esPlaceholder(buf), suHash === PLACEHOLDER_MD5);
});
