import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { excluido } from '../../src/lib/exclusiones.js';

/**
 * El caso que abrio este archivo: un collar de adiestramiento para perros
 * publicado en "Consolas y Videojuegos", porque su titulo dice "C/CONTROLE".
 *
 * Arreglar la regla de Consolas lo saco de esa categoria pero no de la
 * tienda: al no clasificar en ninguna, el sync le conservaba la que ya tenia.
 * La decision de no vender algo tiene que decirse aparte, y es lo que se
 * prueba aca.
 */

test('un articulo para mascotas no pertenece al rubro', () => {
    assert.equal(excluido('COLAR DE TREINAMENTO P/ CACHORROS A-MT688 BLACK *G C/CONTROLE REMOTE DOG TRAI'), true);
    assert.equal(excluido('COMEDERO AUTOMATICO PARA GATOS 3L'), true);
});

test('la tecnologia de verdad no se excluye', () => {
    // El riesgo de una lista asi es que se lleve por delante lo que si se
    // vende. Estos titulos son reales y tienen que pasar.
    const deben = [
        'MEM NB DDR4 8GB 3200 KINGSTON KCP432SS8/8',
        'VGA RTX5070 12GB MSI VENTUS 2X OC EDI GDDR7',
        'MOUSE LOGITECH G502 HERO WIRED BLACK',
        'ZIGBEE ZEMISMART MOTOR P/CORTINA DE ROLO HCO01CZ DC',
        'CONTROLE PS5 SONY DUAL SENSE CFI-ZCT1W COSMIC RED',
        'CAMERA IP INTELBRAS VIP 1230 B FULL HD'
    ];
    for (const titulo of deben) assert.equal(excluido(titulo), false, titulo);
});

test('ELGATO es una marca de hardware, no un animal', () => {
    // El proveedor la escribe con espacio. La primera version de la regla
    // llevaba la palabra "gato" y sacaba de la tienda un panel de luz para
    // streamers. Los dos errores no cuestan lo mismo: excluir de mas pierde
    // una venta, excluir de menos deja un producto raro en una categoria.
    assert.equal(excluido('PAINEL LED EL GATO NEO KEY LIGHTS 10LAJ9901'), false);
    assert.equal(excluido('ELGATO STREAM DECK MK.2 15 TECLAS 10GBA9901'), false);
    // "Gato" tambien es una herramienta.
    assert.equal(excluido('GATO HIDRAULICO 2 TONELADAS'), false);
});

test('no rompe con entradas vacias', () => {
    assert.equal(excluido(''), false);
    assert.equal(excluido(undefined), false);
    assert.equal(excluido(null), false);
});

test('ningun producto activo del catalogo esta excluido', () => {
    // Si esto falla es que el sync todavia no corrio, o que un patron nuevo
    // se llevo por delante algo que si se vende. Las dos cosas hay que verlas.
    const activos = JSON.parse(readFileSync('data/catalog.json', 'utf8'))
        .filter((p) => p.status === 'active' && excluido(p.title))
        .map((p) => p.title);
    assert.deepEqual(activos, []);
});
