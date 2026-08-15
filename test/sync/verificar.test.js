import test from 'node:test';
import assert from 'node:assert/strict';
import { verificarLista, verificarCambios, LIMITES } from '../../src/sync/verificar.js';

const listaSana = {
    productosEnLista: 6000,
    productosEnListaPrevia: 6000,
    tipoDeCambio: 6164,
    limites: LIMITES
};

const cambiosNormales = {
    reporte: { ocultados: 12, sinClasificar: 40, saltos: [{}, {}], actualizados: 300, nuevos: 8 },
    activosPrevios: 5000,
    purgados: [1, 2],
    totalPrevio: 15000,
    limites: LIMITES
};

// --- verificarLista: antes de tocar nada ----------------------------------

test('una lista sana no reporta problemas', () => {
    assert.deepEqual(verificarLista(listaSana), []);
});

test('una lista vacia se rechaza', () => {
    // El caso real: el proveedor devuelve una pagina de error, el parser da
    // cero productos, y sin este freno el sync ocultaria el catalogo entero.
    const p = verificarLista({ ...listaSana, productosEnLista: 0 });
    assert.ok(p.length > 0);
    assert.match(p.join(' '), /minimo/i);
});

test('una lista truncada se rechaza', () => {
    assert.ok(verificarLista({ ...listaSana, productosEnLista: 1200 }).length > 0);
});

test('una caida del 20% respecto de la corrida anterior se rechaza', () => {
    const p = verificarLista({ ...listaSana, productosEnLista: 4800 });
    assert.match(p.join(' '), /caida/i);
});

test('una caida del 5% pasa: el catalogo del proveedor se mueve', () => {
    assert.deepEqual(verificarLista({ ...listaSana, productosEnLista: 5700 }), []);
});

test('un crecimiento grande no se frena', () => {
    assert.deepEqual(verificarLista({ ...listaSana, productosEnLista: 9000 }), []);
});

test('sin corrida previa no se compara, solo se exige el minimo', () => {
    assert.deepEqual(verificarLista({ ...listaSana, productosEnListaPrevia: null }), []);
    assert.ok(verificarLista({ ...listaSana, productosEnListaPrevia: null, productosEnLista: 10 }).length > 0);
});

test('un tipo de cambio absurdo se rechaza', () => {
    assert.ok(verificarLista({ ...listaSana, tipoDeCambio: 1 }).length > 0);
    assert.ok(verificarLista({ ...listaSana, tipoDeCambio: 90000 }).length > 0);
    assert.ok(verificarLista({ ...listaSana, tipoDeCambio: undefined }).length > 0);
});

// --- verificarCambios: calculado, todavia sin escribir --------------------

test('un dia normal pasa', () => {
    assert.deepEqual(verificarCambios(cambiosNormales), []);
});

test('ocultar mas del 10% de los activos se rechaza', () => {
    const p = verificarCambios({
        ...cambiosNormales,
        reporte: { ...cambiosNormales.reporte, ocultados: 600 }
    });
    assert.match(p.join(' '), /ocultar/i);
});

test('purgar mas del 5% del catalogo se rechaza', () => {
    const p = verificarCambios({ ...cambiosNormales, purgados: new Array(1000).fill(0) });
    assert.match(p.join(' '), /purga/i);
});

test('demasiados saltos de precio a la vez se rechazan', () => {
    // Sintoma tipico de un tipo de cambio mal cargado: no cambian diez
    // precios, cambian todos.
    const p = verificarCambios({
        ...cambiosNormales,
        reporte: { ...cambiosNormales.reporte, saltos: new Array(400).fill({}) }
    });
    assert.match(p.join(' '), /saltar/i);
});

test('acumula todos los problemas, no solo el primero', () => {
    const p = verificarCambios({
        ...cambiosNormales,
        reporte: { ...cambiosNormales.reporte, ocultados: 900, saltos: new Array(900).fill({}) },
        purgados: new Array(2000).fill(0)
    });
    assert.equal(p.length, 3);
});

test('sin activos previos no se divide por cero', () => {
    assert.deepEqual(
        verificarCambios({ ...cambiosNormales, activosPrevios: 0, totalPrevio: 0, purgados: [], reporte: { ...cambiosNormales.reporte, ocultados: 0 } }),
        []
    );
});
