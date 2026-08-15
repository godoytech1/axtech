import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarLista, purgar } from '../../src/sync/aplicar.js';

const config = {
    umbralBarato: 200000,
    minimoBarato: 20000,
    minimoBase: 60000,
    tipoDeCambio: 6000,
    pct: { default: 0.13 }
};

// Titulo real de un mouse: clasifica sin ambiguedad y detecta marca.
const lista = () => new Map([['500001', { titulo: 'MOUSE LOGITECH G203 LIGHTSYNC RGB 8000DPI', usd: 20 }]]);

test('un ref nuevo entra como activo con id posterior a ultimoId', () => {
    const { catalogo, ultimoId } = aplicarLista({
        catalogo: [], lista: lista(), hoy: '2026-01-01', config, ultimoId: 7
    });
    assert.equal(catalogo.length, 1);
    assert.equal(catalogo[0].id, 8);
    assert.equal(ultimoId, 8);
    assert.equal(catalogo[0].status, 'active');
    assert.equal(catalogo[0].firstSeen, '2026-01-01');
    assert.equal(catalogo[0].lastSeen, '2026-01-01');
    assert.equal(catalogo[0].brand, 'LOGITECH');
    assert.ok(catalogo[0].price > 0);
    assert.ok(catalogo[0].slug.includes('8'), 'el slug lleva el id');
});

test('ultimoId no retrocede aunque el catalogo tenga ids mas bajos', () => {
    // Este es el bug que motiva meta.json: si el id se dedujera del catalogo,
    // tras purgar los ids altos un producto nuevo reusaria un id ya usado y
    // heredaria la imagen cacheada del producto borrado.
    const previo = [{ id: 3, ref: '111', title: 'viejo', status: 'hidden', lastSeen: '2025-12-01' }];
    const { ultimoId, catalogo } = aplicarLista({
        catalogo: previo, lista: lista(), hoy: '2026-01-01', config, ultimoId: 900
    });
    assert.equal(ultimoId, 901);
    assert.equal(catalogo.find((p) => p.ref === '500001').id, 901);
});

test('no muta el catalogo recibido', () => {
    const original = [{ id: 1, ref: '111', title: 'x', status: 'active', price: 5000, specs: [], lastSeen: '2025-12-01' }];
    const copia = structuredClone(original);
    aplicarLista({ catalogo: original, lista: lista(), hoy: '2026-01-01', config, ultimoId: 1 });
    assert.deepEqual(original, copia);
});

test('un activo ausente de la lista se oculta, pierde el precio y conserva lastSeen', () => {
    const previo = [{ id: 1, ref: '999', title: 'X', status: 'active', price: 5000, specs: ['a'], lastSeen: '2025-12-01' }];
    const { catalogo, reporte } = aplicarLista({
        catalogo: previo, lista: lista(), hoy: '2026-01-01', config, ultimoId: 1
    });
    const x = catalogo.find((p) => p.ref === '999');
    assert.equal(x.status, 'hidden');
    assert.equal(x.price, undefined);
    assert.equal(x.specs, undefined);
    // lastSeen es lo que la purga mide: tocarlo aqui haria que nada se purgue nunca.
    assert.equal(x.lastSeen, '2025-12-01');
    assert.equal(reporte.ocultados, 1);
});

test('un producto ya oculto y ausente no se vuelve a contar como ocultado', () => {
    const previo = [{ id: 1, ref: '999', title: 'X', status: 'hidden', lastSeen: '2025-12-01' }];
    const { reporte } = aplicarLista({ catalogo: previo, lista: lista(), hoy: '2026-01-01', config, ultimoId: 1 });
    assert.equal(reporte.ocultados, 0);
});

test('un oculto que reaparece revive con precio y lastSeen de hoy', () => {
    const previo = [{ id: 1, ref: '500001', title: 'titulo viejo', status: 'hidden', lastSeen: '2025-12-01' }];
    const { catalogo, reporte } = aplicarLista({
        catalogo: previo, lista: lista(), hoy: '2026-01-01', config, ultimoId: 1
    });
    assert.equal(catalogo[0].status, 'active');
    assert.equal(catalogo[0].lastSeen, '2026-01-01');
    assert.ok(catalogo[0].price > 0);
    assert.equal(reporte.revividos, 1);
    assert.equal(reporte.nuevos, 0);
});

test('un precio que no cambia se cuenta como sin cambio', () => {
    const uno = aplicarLista({ catalogo: [], lista: lista(), hoy: '2026-01-01', config, ultimoId: 0 });
    const dos = aplicarLista({
        catalogo: uno.catalogo, lista: lista(), hoy: '2026-01-02', config, ultimoId: uno.ultimoId
    });
    assert.equal(dos.reporte.sinCambio, 1);
    assert.equal(dos.reporte.actualizados, 0);
    assert.equal(dos.catalogo[0].lastSeen, '2026-01-02');
});

test('reporta los saltos de precio grandes con su magnitud', () => {
    const previo = [{ id: 1, ref: '500001', title: 'v', status: 'active', price: 10000, specs: [], lastSeen: '2025-12-01' }];
    const { reporte } = aplicarLista({ catalogo: previo, lista: lista(), hoy: '2026-01-01', config, ultimoId: 1 });
    assert.equal(reporte.actualizados, 1);
    assert.equal(reporte.saltos.length, 1);
    assert.equal(reporte.saltos[0].antes, 10000);
    assert.ok(reporte.saltos[0].delta > 1);
});

test('un titulo que no clasifica se descarta y se cuenta', () => {
    const rara = new Map([['700001', { titulo: 'ZZZ OBJETO SIN CATEGORIA POSIBLE QQQ', usd: 5 }]]);
    const { catalogo, reporte } = aplicarLista({ catalogo: [], lista: rara, hoy: '2026-01-01', config, ultimoId: 0 });
    assert.equal(catalogo.length, 0);
    assert.equal(reporte.sinClasificar, 1);
});

test('un producto ya catalogado cuyo titulo deja de clasificar conserva su categoria y ACTUALIZA el precio', () => {
    // Sin esto, un cambio de titulo del proveedor congela el precio para
    // siempre y en silencio: el producto sigue publicado, sigue figurando en
    // la lista, y su precio nunca se vuelve a tocar. Medido sobre el catalogo
    // real: le pasaba a 6 productos activos.
    const rara = new Map([['700001', { titulo: 'ZZZ OBJETO SIN CATEGORIA POSIBLE QQQ', usd: 5 }]]);
    const previo = [{
        id: 1, ref: '700001', title: 'viejo', status: 'active',
        category: 'refrigeracion', price: 999, specs: [], lastSeen: '2025-12-01'
    }];
    const { catalogo, reporte } = aplicarLista({ catalogo: previo, lista: rara, hoy: '2026-01-01', config, ultimoId: 1 });
    assert.equal(catalogo[0].category, 'refrigeracion');
    assert.notEqual(catalogo[0].price, 999);
    assert.equal(catalogo[0].status, 'active');
    assert.equal(reporte.sinClasificar, 0);
    assert.equal(reporte.categoriaHeredada, 1);
});

test('un producto sin categoria previa y que no clasifica sigue descartandose', () => {
    const rara = new Map([['700001', { titulo: 'ZZZ OBJETO SIN CATEGORIA POSIBLE QQQ', usd: 5 }]]);
    const previo = [{ id: 1, ref: '700001', title: 'v', status: 'hidden', category: null, lastSeen: '2025-12-01' }];
    const { catalogo, reporte } = aplicarLista({ catalogo: previo, lista: rara, hoy: '2026-01-01', config, ultimoId: 1 });
    assert.equal(catalogo[0].status, 'hidden');
    assert.equal(reporte.sinClasificar, 1);
});

test('el precio sale del dolar de la lista, no del precio anterior (idempotente)', () => {
    const uno = aplicarLista({ catalogo: [], lista: lista(), hoy: '2026-01-01', config, ultimoId: 0 });
    const dos = aplicarLista({ catalogo: uno.catalogo, lista: lista(), hoy: '2026-01-01', config, ultimoId: uno.ultimoId });
    const tres = aplicarLista({ catalogo: dos.catalogo, lista: lista(), hoy: '2026-01-01', config, ultimoId: dos.ultimoId });
    assert.equal(uno.catalogo[0].price, tres.catalogo[0].price);
});

// --- purgar ---------------------------------------------------------------

test('purgar borra los ocultos con mas de 30 dias y respeta a los activos', () => {
    const cat = [
        { id: 1, status: 'hidden', lastSeen: '2025-12-01' },
        { id: 2, status: 'hidden', lastSeen: '2025-12-25' },
        { id: 3, status: 'active', lastSeen: '2025-01-01' }
    ];
    const { catalogo, purgados } = purgar({ catalogo: cat, hoy: '2026-01-01', diasGracia: 30 });
    assert.deepEqual(purgados, [1]);
    assert.equal(catalogo.length, 2);
});

test('purgar es exacto en el limite: 30 dias no, 31 si', () => {
    const cat = [
        { id: 1, status: 'hidden', lastSeen: '2025-12-02' }, // 30 dias
        { id: 2, status: 'hidden', lastSeen: '2025-12-01' }  // 31 dias
    ];
    const { purgados } = purgar({ catalogo: cat, hoy: '2026-01-01', diasGracia: 30 });
    assert.deepEqual(purgados, [2]);
});

test('purgar no toca registros sin lastSeen', () => {
    const cat = [{ id: 1, status: 'hidden' }];
    const { purgados, catalogo } = purgar({ catalogo: cat, hoy: '2026-01-01', diasGracia: 30 });
    assert.deepEqual(purgados, []);
    assert.equal(catalogo.length, 1);
});

test('purgar no muta el catalogo recibido', () => {
    const cat = [{ id: 1, status: 'hidden', lastSeen: '2020-01-01' }];
    purgar({ catalogo: cat, hoy: '2026-01-01', diasGracia: 30 });
    assert.equal(cat.length, 1);
});
