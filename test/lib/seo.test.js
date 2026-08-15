import test from 'node:test';
import assert from 'node:assert/strict';
import {
    esIndexable, jsonLdProducto, jsonLdCategoria, jsonLdTienda, jsonLdMigaDePan,
    descripcionDe, escaparHtml
} from '../../src/lib/seo.js';

const BASE = 'https://axtech.pages.dev';

function producto(extra = {}) {
    return {
        id: 4, slug: 'nb-hp-victus-4',
        title: 'NB HP 15-FA2013DX I5-13420H/8GB/512/RTX3050/15/W11',
        brand: 'HP', category: 'notebooks', price: 4474000, image: '/img/4.webp', ...extra
    };
}

test('escapa los caracteres peligrosos de HTML', () => {
    assert.equal(escaparHtml('<script>"x" & \'y\'</script>'),
        '&lt;script&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/script&gt;');
});

test('escaparHtml tolera entrada no textual', () => {
    assert.equal(escaparHtml(null), '');
    assert.equal(escaparHtml(123), '123');
});

test('un producto con specs y marca conocida es indexable', () => {
    assert.equal(esIndexable(producto()), true);
});

test('un producto de marca GENERIC y titulo corto no es indexable', () => {
    assert.equal(esIndexable(producto({ title: 'CABLE USB', brand: 'GENERIC' })), false);
});

test('un producto de marca conocida con titulo largo es indexable aunque no tenga specs', () => {
    assert.equal(esIndexable(producto({ title: 'TEC UP GAMER MG400 PT/BR ESSENTIAL USB', brand: 'UP GAMER' })), true);
});

test('un producto sin precio no es indexable', () => {
    assert.equal(esIndexable(producto({ price: 0 })), false);
    assert.equal(esIndexable(null), false);
});

test('el JSON-LD de producto declara moneda paraguaya y disponibilidad', () => {
    const ld = jsonLdProducto(producto(), BASE);
    assert.equal(ld['@type'], 'Product');
    assert.equal(ld.offers.priceCurrency, 'PYG');
    assert.equal(ld.offers.price, '4474000');
    assert.equal(ld.offers.availability, 'https://schema.org/InStock');
    assert.equal(ld.brand.name, 'HP');
});

test('el JSON-LD de producto usa URLs absolutas', () => {
    const ld = jsonLdProducto(producto(), BASE);
    assert.ok(ld.image.startsWith('https://'));
    assert.ok(ld.offers.url.startsWith('https://'));
});

test('el JSON-LD de producto incluye las especificaciones extraidas', () => {
    const ld = jsonLdProducto(producto(), BASE);
    assert.ok(Array.isArray(ld.additionalProperty));
    assert.ok(ld.additionalProperty.some((x) => x.name === 'Procesador'));
});

test('el JSON-LD de categoria es un ItemList con posiciones', () => {
    const ld = jsonLdCategoria(
        { id: 'notebooks', nombre: 'Notebooks' },
        [producto(), producto({ id: 5, slug: 'x-5' })],
        BASE
    );
    assert.equal(ld['@type'], 'ItemList');
    assert.equal(ld.itemListElement.length, 2);
    assert.equal(ld.itemListElement[0].position, 1);
});

test('el JSON-LD de tienda incluye el WhatsApp y Paraguay', () => {
    const ld = jsonLdTienda(BASE);
    assert.equal(ld['@type'], 'Store');
    assert.ok(JSON.stringify(ld).includes('595976914662'));
    assert.equal(ld.areaServed, 'PY');
});

test('la miga de pan numera las posiciones y usa URLs absolutas', () => {
    const ld = jsonLdMigaDePan(
        [{ nombre: 'Inicio', ruta: '/' }, { nombre: 'Notebooks', ruta: '/c/notebooks/' }],
        BASE
    );
    assert.equal(ld['@type'], 'BreadcrumbList');
    assert.equal(ld.itemListElement.length, 2);
    assert.equal(ld.itemListElement[0].position, 1);
    assert.equal(ld.itemListElement[1].item, `${BASE}/c/notebooks/`);
});

test('la descripcion menciona marca y precio y cabe en un meta description', () => {
    const d = descripcionDe(producto());
    assert.ok(d.includes('HP'));
    assert.ok(/4\.474\.000/.test(d));
    assert.ok(d.length <= 160);
});

test('la descripcion incluye las especificaciones cuando existen', () => {
    assert.match(descripcionDe(producto()), /I5-13420H/);
});
