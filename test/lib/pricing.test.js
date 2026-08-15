import test from 'node:test';
import assert from 'node:assert/strict';
import { precioFinal, costoDesdePrecioLegado, cargarConfig, validarConfig } from '../../src/lib/pricing.js';

const CFG = {
    umbralBarato: 200000,
    minimoBarato: 50000,
    minimoBase: 100000,
    pct: { 'tarjetas-de-video': 0.12, 'teclados': 0.25, default: 0.15 }
};

test('aplica el porcentaje cuando supera al minimo', () => {
    // 20.000.000 * 12% = 2.400.000 > 100.000
    assert.equal(precioFinal(20000000, 'tarjetas-de-video', CFG), 22400000);
});

test('aplica el minimo cuando el porcentaje se queda corto', () => {
    // 300.000 * 12% = 36.000 < 100.000 -> gana el minimo
    assert.equal(precioFinal(300000, 'tarjetas-de-video', CFG), 400000);
});

test('usa el minimo reducido debajo del umbral barato', () => {
    // 100.000 * 15% = 15.000 < 50.000 -> gana el minimo barato
    assert.equal(precioFinal(100000, 'sin-categoria', CFG), 150000);
});

test('usa el porcentaje por defecto para categorias sin tarifa propia', () => {
    assert.equal(precioFinal(1000000, 'categoria-desconocida', CFG), 1150000);
});

test('el resultado siempre es multiplo de 1000', () => {
    for (const costo of [53082, 167108, 452557, 1067683, 3705699, 25451530]) {
        const p = precioFinal(costo, 'teclados', CFG);
        assert.equal(p % 1000, 0, `${p} no es multiplo de 1000`);
    }
});

test('el precio siempre supera al costo', () => {
    for (const costo of [1, 1000, 199999, 200000, 25451530]) {
        assert.ok(precioFinal(costo, 'teclados', CFG) > costo);
    }
});

test('la ganancia nunca baja del minimo aplicable', () => {
    assert.ok(precioFinal(150000, 'teclados', CFG) - 150000 >= 50000);
    assert.ok(precioFinal(500000, 'teclados', CFG) - 500000 >= 100000);
});

test('es monotona creciente respecto del costo', () => {
    let previo = 0;
    for (const costo of [50000, 100000, 200000, 500000, 1000000, 5000000]) {
        const p = precioFinal(costo, 'teclados', CFG);
        assert.ok(p > previo, `no crecio: ${costo} -> ${p}`);
        previo = p;
    }
});

test('ningun precio supera el doble del costo', () => {
    // Detecta una configuracion mal cargada (por ejemplo pct = 1.2 en vez de 0.12).
    for (const costo of [200000, 500000, 1000000, 25451530]) {
        assert.ok(precioFinal(costo, 'teclados', CFG) <= costo * 2);
    }
});

test('devuelve null ante costos invalidos', () => {
    assert.equal(precioFinal(0, 'teclados', CFG), null);
    assert.equal(precioFinal(-5, 'teclados', CFG), null);
    assert.equal(precioFinal(NaN, 'teclados', CFG), null);
    assert.equal(precioFinal(null, 'teclados', CFG), null);
    assert.equal(precioFinal('100000', 'teclados', CFG), null);
});

// --- Inversion de la formula vieja ---

test('invierte la rama barata', () => {
    assert.equal(costoDesdePrecioLegado(200000, 'Monitores'), 150000);
});

test('invierte la rama estandar', () => {
    assert.equal(costoDesdePrecioLegado(600000, 'Monitores'), 500000);
});

test('invierte la rama de categorias especiales', () => {
    assert.equal(costoDesdePrecioLegado(650000, 'Tarjetas de Video'), 500000);
});

test('devuelve null en el rango imposible', () => {
    // Entre 250.000 y 300.000 ninguna rama podia producir un precio.
    assert.equal(costoDesdePrecioLegado(270000, 'Monitores'), null);
});

test('devuelve null ante precios invalidos', () => {
    assert.equal(costoDesdePrecioLegado(0, 'Monitores'), null);
    assert.equal(costoDesdePrecioLegado(null, 'Monitores'), null);
});

// --- validarConfig ---------------------------------------------------------
//
// El archivo real es un secreto y en CI no existe, asi que ningun test puede
// mirarlo. Lo que se prueba es la validacion, que corre cada vez que se carga
// la config: en el build, en el sync y en cada corrida local.

const CFG_VALIDA = {
    tipoDeCambio: 6164, umbralBarato: 200000, minimoBarato: 20000,
    minimoBase: 60000, pct: { default: 0.13 }
};

test('una config completa no reporta problemas', () => {
    assert.deepEqual(validarConfig(CFG_VALIDA), []);
});

test('rechaza un tipo de cambio fuera de rango o ausente', () => {
    // Un tipo de cambio equivocado no rompe nada de forma visible: publica
    // precios equivocados, que en una tienda es peor que caerse.
    assert.ok(validarConfig({ ...CFG_VALIDA, tipoDeCambio: 1 }).length);
    assert.ok(validarConfig({ ...CFG_VALIDA, tipoDeCambio: 90000 }).length);
    assert.ok(validarConfig({ ...CFG_VALIDA, tipoDeCambio: undefined }).length);
    assert.ok(validarConfig({ ...CFG_VALIDA, tipoDeCambio: '6164' }).length);
});

test('exige pct.default: sin el, una categoria nueva daria NaN', () => {
    assert.ok(validarConfig({ ...CFG_VALIDA, pct: {} }).length);
    assert.ok(validarConfig({ ...CFG_VALIDA, pct: undefined }).length);
});

test('exige los tres umbrales como numeros positivos', () => {
    assert.ok(validarConfig({ ...CFG_VALIDA, minimoBase: 0 }).length);
    assert.ok(validarConfig({ ...CFG_VALIDA, umbralBarato: -1 }).length);
    assert.ok(validarConfig({ ...CFG_VALIDA, minimoBarato: null }).length);
});

test('acumula todos los problemas de una config vacia', () => {
    assert.ok(validarConfig({}).length >= 5);
    assert.deepEqual(validarConfig(null), ['no es un objeto']);
});

test('cargarConfig falla ruidosamente ante una config invalida', () => {
    const previo = process.env.PRICING_CONFIG;
    process.env.PRICING_CONFIG = JSON.stringify({ ...CFG_VALIDA, tipoDeCambio: 5 });
    try {
        assert.throws(() => cargarConfig(), /tipoDeCambio/);
    } finally {
        if (previo === undefined) delete process.env.PRICING_CONFIG;
        else process.env.PRICING_CONFIG = previo;
    }
});
