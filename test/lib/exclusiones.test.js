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

test('ningun patron de exclusion se lleva por delante medio catalogo', () => {
    // Antes exigia CERO activos excluidos, y eso creaba un circulo cerrado:
    // agregar un patron deja productos activos excluidos hasta que el sync los
    // oculte, pero el sync corre estos tests antes de empezar y no arrancaba.
    // El 2026-09-29 once productos --seis atornilladores, una motosierra, una
    // amoladora y tres procesadoras de alimentos-- dejaron el sync en rojo.
    //
    // Lo que importa vigilar no es que haya alguno, sino que un patron nuevo
    // no barra con lo que si se vende. Se listan siempre para que se vean, y
    // se falla recien pasado el 0,5% del catalogo.
    const catalogo = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
    const activos = catalogo.filter((p) => p.status === 'active');
    const pendientes = activos.filter((p) => excluido(p.title)).map((p) => p.title);

    if (pendientes.length) {
        console.log(`  ${pendientes.length} activos quedan excluidos y se ocultan en el proximo sync:`);
        for (const t of pendientes.slice(0, 15)) console.log(`      ${t.slice(0, 70)}`);
    }
    const tope = Math.ceil(activos.length * 0.005);
    assert.ok(
        pendientes.length <= tope,
        `${pendientes.length} activos excluidos, tope ${tope}: un patron nuevo se llevo algo que se vende`
    );
});

test('excluye lo que el proveedor prohibe vender en Paraguay', () => {
    assert.equal(excluido('ROUTER TP-LINK ARCHER MR200 AC750 4G LTE BRASIL NAO VENDER P/PY'), true);
    assert.equal(excluido('NOTEBOOK X NO VENDER'), true);
    // No confundir con un producto que simplemente menciona a Brasil.
    assert.equal(excluido('HD 8TB SEAGATE BARRACUDA ST8000DM004 GARANTIA BR'), false);
    assert.equal(excluido('ROUTER TP-LINK ARCHER C6 AC1200'), false);
});

test('una capa de lluvia para moto no es una funda', () => {
    // Caia en Fundas porque abre con "CAPA", igual que las de notebook.
    assert.equal(excluido('CAPA DE CHUVA P/ MOTO LUO LU-040 XL-170 BLACK'), true);
    // Y las fundas de verdad se quedan: buscar "capa" sola se llevaria 23.
    assert.equal(excluido('CAPA P/ NB SATE A-KP12 15.6 Negro/Rojo'), false);
    assert.equal(excluido('CAPA P/TABLET SAMSUNG S10 SM-X820 12.4 BLACK'), false);
    assert.equal(excluido('CAPA P/ IPAD USAMS SMART KEYBOARD 10.2 BLK'), false);
});
