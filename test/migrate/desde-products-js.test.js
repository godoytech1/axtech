import test from 'node:test';
import assert from 'node:assert/strict';
import { migrarCatalogo } from '../../src/migrate/desde-products-js.js';

const HOY = '2026-08-15';

function legado(extra = {}) {
    return {
        id: 10122,
        ref: '329967',
        brand: 'JVC',
        title: 'TV 100 JVC LT-100KM958',
        title_orig: 'TV 100 JVC LT-100KM958 ORIGINAL',
        category: 'Televisores',
        image: 'https://proveedor.test/produtos_img/v/IMG_329967_1.JPG',
        usd: 'US$ 1.250,00',
        brl: 'R$ 6.600,00',
        pyg_orig: 7950000,
        pyg_orig_str: 'Gs. 7.950.000',
        pyg: 8050000,
        pyg_str: 'Gs. 8.050.000',
        orig_url: 'https://proveedor.test/produto/tv/329967.html',
        specs: ['100"', '4K'],
        sob_consulta: false,
        ...extra
    };
}

test('elimina todos los campos sensibles', () => {
    const { catalogo } = migrarCatalogo([legado()], { hoy: HOY });
    const r = catalogo[0];
    for (const campo of ['pyg_orig', 'pyg_orig_str', 'usd', 'brl', 'orig_url', 'title_orig']) {
        assert.equal(r[campo], undefined, `sobrevivio el campo ${campo}`);
    }
});

test('no conserva ninguna url del proveedor', () => {
    const { catalogo } = migrarCatalogo([legado()], { hoy: HOY });
    assert.ok(!JSON.stringify(catalogo).includes('proveedor.test'));
});

test('conserva los campos de identidad y el precio de venta', () => {
    const { catalogo } = migrarCatalogo([legado()], { hoy: HOY });
    assert.deepEqual(catalogo[0], {
        id: 10122,
        ref: '329967',
        slug: 'tv-100-jvc-lt-100km958-10122',
        title: 'TV 100 JVC LT-100KM958',
        brand: 'JVC',
        category: 'Televisores',
        specs: ['100"', '4K'],
        price: 8050000,
        status: 'active',
        firstSeen: HOY,
        lastSeen: HOY
    });
});

test('los ocultos se reducen a sus campos de identidad', () => {
    const { catalogo } = migrarCatalogo(
        [legado({ sob_consulta: true, pyg: 0, pyg_str: 'Bajo Consulta' })],
        { hoy: HOY }
    );
    assert.deepEqual(Object.keys(catalogo[0]).sort(), [
        'brand', 'category', 'firstSeen', 'id', 'lastSeen', 'ref', 'slug', 'status', 'title'
    ]);
    assert.equal(catalogo[0].status, 'hidden');
});

test('un producto con precio cero pasa a oculto aunque diga que esta activo', () => {
    const { catalogo } = migrarCatalogo([legado({ sob_consulta: false, pyg: 0 })], { hoy: HOY });
    assert.equal(catalogo[0].status, 'hidden');
});

test('fusiona Relojes Mi Band en Relojes Smart', () => {
    const { catalogo, reporte } = migrarCatalogo(
        [legado({ category: 'Relojes Mi Band' })],
        { hoy: HOY }
    );
    assert.equal(catalogo[0].category, 'Relojes Smart');
    assert.equal(reporte.relojesFusionados, 1);
});

test('elimina duplicados por ref y conserva el que tiene precio', () => {
    const sinPrecio = legado({ id: 1, ref: '999', sob_consulta: true, pyg: 0 });
    const conPrecio = legado({ id: 2, ref: '999', sob_consulta: false, pyg: 500000 });
    const { catalogo, reporte } = migrarCatalogo([sinPrecio, conPrecio], { hoy: HOY });
    assert.equal(catalogo.length, 1);
    assert.equal(catalogo[0].id, 2);
    assert.equal(reporte.duplicadosEliminados, 1);
});

test('descarta registros sin titulo utilizable', () => {
    const { catalogo, reporte } = migrarCatalogo(
        [legado({ title: '   ' }), legado({ id: 2, ref: '2' })],
        { hoy: HOY }
    );
    assert.equal(catalogo.length, 1);
    assert.equal(reporte.sinTitulo, 1);
});

test('descarta registros sin ref porque no se pueden reconciliar', () => {
    const { catalogo } = migrarCatalogo([legado({ ref: undefined })], { hoy: HOY });
    assert.equal(catalogo.length, 0);
});

test('el reporte cuadra con el catalogo resultante', () => {
    const entrada = [
        legado({ id: 1, ref: '1' }),
        legado({ id: 2, ref: '2', sob_consulta: true, pyg: 0 })
    ];
    const { catalogo, reporte } = migrarCatalogo(entrada, { hoy: HOY });
    assert.equal(reporte.entrada, 2);
    assert.equal(reporte.activos, 1);
    assert.equal(reporte.ocultos, 1);
    assert.equal(reporte.activos + reporte.ocultos, catalogo.length);
});
