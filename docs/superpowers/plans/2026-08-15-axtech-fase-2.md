# AXTECH Fase 2 — SEO real: una página por producto y por categoría

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasar de 1 URL indexable a ~3.400, para que Google pueda encontrar los productos de AXTECH cuando alguien los busca por nombre.

**Architecture:** El build genera HTML estático por producto y por categoría, con datos estructurados y Open Graph. Las páginas de producto son autónomas: llevan su propio dato incrustado y no descargan el catálogo completo. Un extractor de especificaciones saca del título los datos técnicos que el proveedor no entrega estructurados, y una compuerta de calidad marca `noindex` a las páginas que no tienen suficiente que decir.

**Tech Stack:** Node.js ≥ 20 (ESM), `node:test`, HTML/CSS/JS vanilla, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md` (§8)

## Global Constraints

- **Sin dependencias de producción.**
- **Node.js ≥ 20.**
- **Campos prohibidos** en `data/catalog.json` y `dist/`: `pyg_orig`, `pyg_orig_str`, `usd`, `brl`, `orig_url`, `title_orig`, `titleOrig`, `cost`, `costo`.
- **El nombre y dominio del proveedor no aparecen en código versionado ni en `dist/`.** El build lo verifica contra `SUPPLIER_NAME` y falla.
- **Título del sitio**, exacto y sin sufijos de país: `AXTECH | Tu Tienda de Tecnología y Hardware`
- **WhatsApp**: `595976914662`. Moneda: `PYG`.
- **Fuente ASCII pura** en `src/lib/`.
- **Commits frecuentes.**

## Punto de partida medido (2026-08-15)

| Dato | Valor |
|---|---|
| Productos publicados | **5.004** |
| Categorías con productos | 28 |
| URLs indexables hoy | **1** |
| Con marca `GENERIC` | ~33 % |
| `products.js` | 157 KB gzip (límite 150) |
| Filtrado en el cliente | 2,6 ms sobre 5.004 productos |
| Límite de archivos de Cloudflare Pages | 20.000 |

**Proyección de archivos a desplegar**: 5.063 imágenes + ~3.400 páginas de
producto + ~1.600 con `noindex` + 28 categorías + estáticos ≈ **10.150**.
Dentro del límite, con margen.

## Decisiones de alcance, con su razón

**Las páginas de producto NO cargan `products.js`.** Llevan su producto
incrustado como JSON-LD y un objeto mínimo para el carrito. Una página que
muestra un producto no tiene por qué descargar 157 KB con los otros 5.003.
Esto también hace que el presupuesto excedido deje de importar en las páginas
que más van a recibir tráfico de buscadores.

**Sin chunking del índice en esta fase.** Con las páginas de producto
autónomas, `products.js` solo lo cargan la home y las categorías. Sigue 7 %
por encima del presupuesto; queda anotado y se resuelve en una fase de
limpieza posterior, no bloquea el SEO.

**Sin partir `app.js` en módulos ES.** Mismo razonamiento que en la Fase 1B:
2.000 líneas sin tests, y el beneficio es de mantenimiento, no de usuario. El
SEO no lo necesita.

**La home sigue siendo la SPA actual.** El spec (§8.1) pedía generarla con
productos en el HTML. No se hace acá porque la home ya funciona, Google
ejecuta JavaScript para indexarla, y el valor de SEO está en las páginas de
producto y categoría —que sí son estáticas—, no en una home que compite por
términos genéricos donde AXTECH no va a ganar de todos modos. Queda anotado
como deuda; si Search Console muestra problemas de rastreo en `/`, se resuelve
entonces con datos en la mano en vez de por precaución.

**Compuerta de calidad honesta.** Medido: con el criterio "título ≥ 25
caracteres Y (al menos 1 especificación O marca conocida)", **3.370 de 5.004
(67 %) califican**. El resto se genera igual —para que el enlazado interno y
la navegación funcionen— pero con `noindex` y fuera del sitemap. Publicar 5.000
páginas finas perjudica al dominio entero; 3.400 buenas, no.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/specs.js` | **Crear.** Extraer especificaciones del título |
| `src/lib/seo.js` | **Crear.** JSON-LD, meta tags, compuerta de calidad |
| `src/build/plantillas.js` | **Crear.** Plantillas HTML de producto y categoría |
| `src/build/paginas.js` | **Crear.** Generación de las páginas estáticas |
| `src/build/sitemap.js` | **Crear.** Sitemaps segmentados |
| `src/build/index.js` | **Modificar.** Orquestar la generación |
| `src/lib/taxonomy.js` | **Modificar.** Ampliar la lista de marcas |
| `index.css` | **Modificar.** Estilos de las páginas nuevas |
| `robots.txt` | **Modificar.** Apuntar al índice de sitemaps |
| `test/lib/specs.test.js`, `test/lib/seo.test.js` | **Crear.** |
| `AGENTS.md` | **Modificar.** Documentar la estructura de URLs |

### URLs

```
/                          home
/c/{categoria}/            28 categorias
/c/{categoria}/{n}/        paginacion (36 por pagina)
/p/{slug}/                 ~5.000 productos
/sitemap.xml               indice
/sitemap-paginas.xml
/sitemap-productos-{n}.xml segmentado de a 5.000
```

---

## Task 1: Extractor de especificaciones (`src/lib/specs.js`)

El proveedor no entrega especificaciones estructuradas, pero sus títulos son
densos: `NB HP 15-FA2013DX I5-13420H/8GB/512/RTX3050/15/W11` contiene
procesador, memoria, almacenamiento, gráfica, pantalla y sistema operativo.

**Files:**
- Create: `src/lib/specs.js`
- Test: `test/lib/specs.test.js`

**Interfaces:**
- Consumes: nada
- Produces: `extraerSpecs(titulo: string) => Array<{etiqueta: string, valor: string}>`

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/specs.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { extraerSpecs } from '../../src/lib/specs.js';

const valores = (titulo) => Object.fromEntries(extraerSpecs(titulo).map((s) => [s.etiqueta, s.valor]));

test('extrae el patron completo de un notebook', () => {
    const v = valores('NB HP 15-FA2013DX I5-13420H/8GB/512/RTX3050/15/W11 RTX3050');
    assert.equal(v['Procesador'], 'I5-13420H');
    assert.equal(v['Memoria RAM'], '8 GB');
    assert.equal(v['Tarjeta de video'], 'RTX3050');
    assert.equal(v['Pantalla'], '15"');
    assert.equal(v['Sistema operativo'], 'Windows 11');
});

test('extrae de un monitor con prefijo abreviado', () => {
    const v = valores('MON 55 SAMSUNG SMART LS55CG970NNXGO CURVO 4K QHD 165Hz');
    assert.equal(v['Pantalla'], '55"');
    assert.equal(v['Resolucion'], '4K');
    assert.equal(v['Frecuencia'], '165 Hz');
});

test('extrae de un televisor', () => {
    const v = valores('TV 32 MTEK MK32FSAH SMART ANDROID 11 WIFI/BT');
    assert.equal(v['Pantalla'], '32"');
    assert.equal(v['Sistema operativo'], 'ANDROID 11');
});

test('extrae de una fuente de poder', () => {
    const v = valores('Fuente 650W AZZA PSAZ-650W 80+ BRONZE BIVOLT BLACK');
    assert.equal(v['Potencia'], '650 W');
    assert.match(v['Certificacion'], /BRONZE/);
});

test('extrae la grafica de una tarjeta de video', () => {
    assert.equal(valores('VGA RX7600 8GB XFX SPEEDSTER SWFT210')['Tarjeta de video'], 'RX7600');
    assert.equal(valores('Tarjeta de Video ZOTAC GEFORCE RTX 5090 32GB')['Tarjeta de video'], 'RTX 5090');
});

test('reconoce pulgadas escritas con comillas', () => {
    assert.equal(valores('MONITOR AOC 24" FULL HD IPS')['Pantalla'], '24"');
});

test('no inventa especificaciones cuando el titulo no las tiene', () => {
    assert.deepEqual(extraerSpecs('TEC UP GAMER MG400 PT/BR ESSENTIAL USB BLACK'), []);
});

test('no repite la misma etiqueta dos veces', () => {
    const s = extraerSpecs('NB DELL 16GB DDR5 32GB RAM I7-13700H');
    const etiquetas = s.map((x) => x.etiqueta);
    assert.equal(etiquetas.length, new Set(etiquetas).size);
});

test('los valores no tienen espacios sobrantes', () => {
    for (const s of extraerSpecs('VGA RX7600 8GB XFX SPEEDSTER')) {
        assert.equal(s.valor, s.valor.trim());
        assert.ok(s.valor.length > 0);
    }
});

test('tolera entrada no textual', () => {
    assert.deepEqual(extraerSpecs(null), []);
    assert.deepEqual(extraerSpecs(''), []);
    assert.deepEqual(extraerSpecs(42), []);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test "test/lib/specs.test.js"`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementar**

Crear `src/lib/specs.js`:

```javascript
/**
 * Extrae especificaciones tecnicas del titulo.
 *
 * El proveedor no entrega datos estructurados, pero sus titulos son densos:
 * "NB HP 15-FA2013DX I5-13420H/8GB/512/RTX3050/15/W11" tiene seis datos
 * dentro. Sin esto, las paginas de producto quedarian con nada mas que un
 * nombre y un precio, y Google las trataria como contenido fino.
 *
 * Cada etiqueta se extrae UNA sola vez: gana el primer patron que matchea,
 * por eso el orden dentro de cada etiqueta importa (del mas especifico al mas
 * general).
 */
const EXTRACTORES = [
    ['Procesador', /\b(i[3579]-\d{4,5}[A-Z]{0,3}|ultra\s?[579]-?\d{3}[A-Z]{0,2}|ryzen\s?[3579]\s?\d{4}[A-Z]{0,3}|r[3579]-\d{3,4}[A-Z]{0,2}|core\s?\d-\d{3}[A-Z]?|athlon-?\w+|celeron\s?\w+|pentium\s?\w+|snapdragon\s?\w+)\b/i],

    // Patron tipico de notebook: CPU/RAM/ALMACENAMIENTO/PANTALLA/SO
    ['Memoria RAM', /\/(\d{1,3})\s?GB?\//i, (m) => `${m[1]} GB`],
    ['Memoria RAM', /\b(\d{1,3})\s?GB\s?(?:DDR[45]|RAM)\b/i, (m) => `${m[1]} GB`],

    ['Almacenamiento', /\b(\d\s?TB|\d{3,4}\s?GB)\s?(?:SSD|NVME|HD|EMMC)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, ' ')],
    ['Almacenamiento', /\/(\d{3,4}|[1-9]\s?TB)\/(?=\d{2}\/|W1|FREEDOS|LINUX)/i,
        (m) => (/TB/i.test(m[1]) ? m[1].toUpperCase().replace(/\s+/g, '') : `${m[1]} GB`)],

    ['Tarjeta de video', /\b(RTX\s?\d{4}\s?(?:TI|SUPER)?|GTX\s?\d{3,4}\s?(?:TI)?|RX\s?\d{4}\s?(?:XT|GRE)?|ARC\s?[AB]\d{3})\b/i],

    ['Pantalla', /\b(\d{2}(?:\.\d)?)\s?(?:"|POLEGADAS|PULGADAS|INCH)/i, (m) => `${m[1]}"`],
    ['Pantalla', /^(?:MON|TV)\s(\d{2,3})\b/i, (m) => `${m[1]}"`],
    ['Pantalla', /\/(1[0-9](?:\.\d)?)\/(?:W1|FREEDOS|LINUX)/i, (m) => `${m[1]}"`],

    ['Resolucion', /\b(4K|8K|UHD|QHD|FHD|FULL\s?HD|2K|1080P|1440P|2\.5K)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, ' ')],
    ['Frecuencia', /\b(\d{2,3})\s?HZ\b/i, (m) => `${m[1]} Hz`],
    ['Panel', /\b(QD-?OLED|OLED|QLED|MINI\s?LED|AMOLED|IPS|VA|TN)\b/i, (m) => m[1].toUpperCase().replace(/\s+/g, '')],

    ['Sistema operativo', /\b(W11|W10|WINDOWS\s?1[01]|FREEDOS|LINUX|CHROME\s?OS|ANDROID\s?\d{0,2})\b/i,
        (m) => ({ W11: 'Windows 11', W10: 'Windows 10' })[m[1].toUpperCase()] || m[1].toUpperCase()],

    ['Potencia', /\b(\d{3,4})\s?W\b/i, (m) => `${m[1]} W`],
    ['Certificacion', /\b(80\s?\+?\s?(?:PLUS\s?)?(?:BRONZE|SILVER|GOLD|PLATINUM|PLATA|ORO))\b/i],
    ['Conectividad', /\b(WI-?FI\s?[567]E?|BLUETOOTH|USB-?C|THUNDERBOLT)\b/i],
    ['Socket', /\b(AM[45]|LGA\s?\d{3,4})\b/i],
    ['Capacidad', /\b(\d{4,6})\s?MAH\b/i, (m) => `${m[1]} mAh`]
];

/**
 * @param {string} titulo
 * @returns {Array<{etiqueta: string, valor: string}>}
 */
export function extraerSpecs(titulo) {
    if (typeof titulo !== 'string' || !titulo) return [];
    const salida = [];
    const yaExtraidas = new Set();

    for (const [etiqueta, patron, formatear] of EXTRACTORES) {
        if (yaExtraidas.has(etiqueta)) continue;
        const m = patron.exec(titulo);
        if (!m) continue;

        const valor = (formatear ? formatear(m) : m[1].toUpperCase().replace(/\s+/g, ' ')).trim();
        if (!valor) continue;

        yaExtraidas.add(etiqueta);
        salida.push({ etiqueta, valor });
    }
    return salida;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test "test/lib/specs.test.js"`
Expected: PASS — 10 tests.

- [ ] **Step 5: Medir la cobertura real**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { extraerSpecs } from './src/lib/specs.js';
const c = JSON.parse(readFileSync('data/catalog.json','utf8')).filter(p => p.status === 'active');
const n = c.map(p => extraerSpecs(p.title).length);
console.log('con 1 o mas specs:', n.filter(x => x >= 1).length, 'de', c.length);
console.log('con 2 o mas specs:', n.filter(x => x >= 2).length);
"
```
Registrar el resultado: es la base de la compuerta de calidad de la Task 3.

- [ ] **Step 6: Verificar que el fuente es ASCII puro y commitear**

```bash
LC_ALL=C grep -n '[^ -~]' src/lib/specs.js || echo "ASCII puro"
git add src/lib/specs.js test/lib/specs.test.js
git commit -m "feat: extraccion de especificaciones desde el titulo"
```

---

## Task 2: Ampliar la lista de marcas

Medido: el 33 % del catálogo queda como `GENERIC`, y esa es la causa principal
de que 1.634 páginas no califiquen para indexarse. Cada marca agregada mueve
productos de `noindex` a indexable.

**Files:**
- Modify: `src/lib/taxonomy.js`

**Interfaces:**
- Consumes: nada
- Produces: `MARCAS` ampliada

- [ ] **Step 1: Listar las marcas más frecuentes entre los GENERIC**

```bash
node -e "
const c = JSON.parse(require('node:fs').readFileSync('data/catalog.json','utf8'))
  .filter(p => p.status === 'active' && p.brand === 'GENERIC');
const g = {};
for (const p of c) {
  for (const w of p.title.split(/[\s,\/()\-]+/).slice(0, 3)) {
    const k = w.toUpperCase().replace(/[^A-Z]/g, '');
    if (k.length >= 3) g[k] = (g[k] || 0) + 1;
  }
}
Object.entries(g).sort((a,b) => b[1]-a[1]).slice(0, 40)
  .forEach(([k,v]) => console.log(String(v).padStart(4), k));
"
```

- [ ] **Step 2: Agregar al arreglo `MARCAS` las que sean marcas reales**

En `src/lib/taxonomy.js`, agregar al arreglo `MARCAS` las marcas identificadas
en el Step 1 que sean fabricantes reales (no palabras genéricas como `CABLE`,
`SMART` o `GAMER`). Candidatas observadas: `PLAYGAME`, `GAMESIR`, `PXN`,
`BLULORY`, `4LIFE`, `TROVE`, `HTC`, `SUNKING`, `TIANQIU`, `AFOX`, `FTX`,
`ECOPOWER`, `SATE`, `MOZA`, `THERMALRIGHT`, `MIKROTIK`, `UBIQUITI`, `TAPO`,
`ZEMISMART`, `HOMIE`, `SONOFF`.

**No agregar** palabras que aparezcan en muchos títulos sin ser marca: harían
que productos de distintos fabricantes se agrupen mal.

- [ ] **Step 3: Verificar que los tests siguen pasando**

Run: `node --test "test/lib/taxonomy.test.js"`
Expected: PASS.

El test `la marca mas larga gana cuando una contiene a otra` protege contra el
riesgo principal de ampliar la lista.

- [ ] **Step 4: Medir la mejora**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { detectarMarca } from './src/lib/taxonomy.js';
const c = JSON.parse(readFileSync('data/catalog.json','utf8')).filter(p => p.status === 'active');
const sinMarca = c.filter(p => !detectarMarca(p.title)).length;
console.log('sin marca reconocida:', sinMarca, '(' + (sinMarca/c.length*100).toFixed(1) + '%, era 33%)');
"
```

- [ ] **Step 5: Aplicar las marcas al catálogo y commitear**

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
import { detectarMarca } from './src/lib/taxonomy.js';
const c = JSON.parse(readFileSync('data/catalog.json','utf8'));
let n = 0;
for (const p of c) {
  if (p.brand === 'GENERIC') { const m = detectarMarca(p.title); if (m) { p.brand = m; n++; } }
}
writeFileSync('data/catalog.json', JSON.stringify(c, null, 2) + '\n', 'utf8');
console.log('marcas recuperadas:', n);
"
git add src/lib/taxonomy.js data/catalog.json
git commit -m "feat: ampliar la lista de marcas para reducir GENERIC"
```

---

## Task 3: SEO — datos estructurados y compuerta de calidad (`src/lib/seo.js`)

**Files:**
- Create: `src/lib/seo.js`
- Test: `test/lib/seo.test.js`

**Interfaces:**
- Consumes: `extraerSpecs` de `src/lib/specs.js`
- Produces:
  - `esIndexable(producto) => boolean`
  - `jsonLdProducto(producto, urlBase) => object`
  - `jsonLdCategoria(categoria, productos, urlBase) => object`
  - `jsonLdTienda(urlBase) => object`
  - `jsonLdMigaDePan(migas: Array<{nombre, ruta}>, urlBase) => object`
  - `descripcionDe(producto) => string`
  - `escaparHtml(texto) => string`

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/seo.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import {
    esIndexable, jsonLdProducto, jsonLdCategoria, jsonLdTienda, descripcionDe, escaparHtml
} from '../../src/lib/seo.js';

const BASE = 'https://axtech.pages.dev';

function producto(extra = {}) {
    return {
        id: 4, slug: 'nb-hp-victus-4', title: 'NB HP 15-FA2013DX I5-13420H/8GB/512/RTX3050/15/W11',
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
    assert.ok(ld.additionalProperty.some((p) => p.name === 'Procesador'));
});

test('el JSON-LD de categoria es un ItemList con posiciones', () => {
    const ld = jsonLdCategoria({ id: 'notebooks', nombre: 'Notebooks' }, [producto(), producto({ id: 5, slug: 'x-5' })], BASE);
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

test('la descripcion menciona marca, categoria y precio', () => {
    const d = descripcionDe(producto());
    assert.ok(d.includes('HP'));
    assert.ok(/4\.474\.000/.test(d));
    assert.ok(d.length <= 160, 'debe caber en un meta description');
});

test('la descripcion incluye las especificaciones cuando existen', () => {
    assert.match(descripcionDe(producto()), /I5-13420H/);
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
```

Agregar `jsonLdMigaDePan` al import del principio del archivo de test.

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test "test/lib/seo.test.js"`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementar**

Crear `src/lib/seo.js`:

```javascript
import { extraerSpecs } from './specs.js';

const WHATSAPP = '595976914662';
const NOMBRE_TIENDA = 'AXTECH';
const LARGO_MINIMO_TITULO = 25;

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Escapa para insertar texto dentro de HTML. */
export function escaparHtml(texto) {
    if (texto === null || texto === undefined) return '';
    return String(texto).replace(/[&<>"']/g, (c) => ESCAPES[c]);
}

/**
 * Decide si una pagina merece indexarse.
 *
 * Google penaliza el dominio entero cuando se le sirven miles de paginas
 * finas. Es preferible tener 3.400 paginas buenas que 5.000 mediocres: las
 * que no califican se generan igual (para que el enlazado interno funcione y
 * el usuario pueda llegar) pero llevan noindex y quedan fuera del sitemap.
 */
export function esIndexable(p) {
    if (!p || typeof p.price !== 'number' || p.price <= 0) return false;
    if (typeof p.title !== 'string' || p.title.trim().length < LARGO_MINIMO_TITULO) return false;
    const tieneMarca = Boolean(p.brand) && p.brand !== 'GENERIC';
    return tieneMarca || extraerSpecs(p.title).length >= 1;
}

const formatearGs = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/** Meta description: marca, especificaciones si hay, y precio. Max 160 caracteres. */
export function descripcionDe(p) {
    const specs = extraerSpecs(p.title).slice(0, 3).map((s) => s.valor).join(', ');
    const partes = [p.brand && p.brand !== 'GENERIC' ? p.brand : null, specs || null];
    const detalle = partes.filter(Boolean).join(' - ');
    const base = detalle
        ? `${detalle}. Precio ${formatearGs(p.price)} en ${NOMBRE_TIENDA}. Consulta por WhatsApp.`
        : `${p.title}. Precio ${formatearGs(p.price)} en ${NOMBRE_TIENDA}. Consulta por WhatsApp.`;
    return base.length <= 160 ? base : base.slice(0, 157) + '...';
}

export function jsonLdProducto(p, urlBase) {
    const specs = extraerSpecs(p.title);
    return {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: p.title,
        description: descripcionDe(p),
        image: `${urlBase}${p.image}`,
        sku: String(p.id),
        brand: { '@type': 'Brand', name: p.brand || NOMBRE_TIENDA },
        ...(specs.length
            ? { additionalProperty: specs.map((s) => ({ '@type': 'PropertyValue', name: s.etiqueta, value: s.valor })) }
            : {}),
        offers: {
            '@type': 'Offer',
            url: `${urlBase}/p/${p.slug}/`,
            priceCurrency: 'PYG',
            price: String(p.price),
            availability: 'https://schema.org/InStock',
            seller: { '@type': 'Organization', name: NOMBRE_TIENDA }
        }
    };
}

export function jsonLdCategoria(categoria, productos, urlBase) {
    return {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: categoria.nombre,
        numberOfItems: productos.length,
        itemListElement: productos.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            url: `${urlBase}/p/${p.slug}/`,
            name: p.title
        }))
    };
}

export function jsonLdTienda(urlBase) {
    return {
        '@context': 'https://schema.org',
        '@type': 'Store',
        name: NOMBRE_TIENDA,
        description: 'Tienda de tecnologia y hardware. Notebooks, tarjetas de video, procesadores y mas.',
        url: urlBase,
        telephone: `+${WHATSAPP}`,
        areaServed: 'PY',
        currenciesAccepted: 'PYG',
        paymentAccepted: 'Transferencia bancaria, Giro, Efectivo',
        openingHours: 'Mo-Fr 08:00-20:00'
    };
}

export function jsonLdMigaDePan(migas, urlBase) {
    return {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: migas.map((m, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: m.nombre,
            item: `${urlBase}${m.ruta}`
        }))
    };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test "test/lib/seo.test.js"`
Expected: PASS — 13 tests.

- [ ] **Step 5: Medir cuántas páginas serán indexables**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { esIndexable } from './src/lib/seo.js';
const c = JSON.parse(readFileSync('data/catalog.json','utf8')).filter(p => p.status === 'active');
const sin = new Set(JSON.parse(readFileSync('data/sin-imagen.json','utf8')));
const pub = c.filter(p => !sin.has(p.id));
const ok = pub.filter(esIndexable).length;
console.log('publicables:', pub.length, '| indexables:', ok, '(' + (ok/pub.length*100).toFixed(1) + '%)');
"
```

- [ ] **Step 6: Commit**

```bash
git add src/lib/seo.js test/lib/seo.test.js
git commit -m "feat: datos estructurados y compuerta de calidad para SEO"
```

---

## Task 4: Plantillas HTML (`src/build/plantillas.js`)

**Files:**
- Create: `src/build/plantillas.js`

**Interfaces:**
- Consumes: `escaparHtml`, `descripcionDe`, `jsonLdProducto`, `jsonLdCategoria`,
  `jsonLdTienda`, `jsonLdMigaDePan`, `esIndexable` de `src/lib/seo.js`;
  `extraerSpecs` de `src/lib/specs.js`
- Produces:
  - `paginaDeProducto({producto, categoria, relacionados, urlBase}) => string`
  - `paginaDeCategoria({categoria, productos, pagina, totalPaginas, urlBase}) => string`

- [ ] **Step 1: Escribir las plantillas**

Crear `src/build/plantillas.js`. **Todo texto que venga del catalogo pasa por
`escaparHtml`**: los titulos se raspan de un tercero.

```javascript
import {
    escaparHtml, descripcionDe, esIndexable,
    jsonLdProducto, jsonLdCategoria, jsonLdTienda, jsonLdMigaDePan
} from '../lib/seo.js';
import { extraerSpecs } from '../lib/specs.js';

const WHATSAPP = '595976914662';
const TITULO_SITIO = 'AXTECH | Tu Tienda de Tecnología y Hardware';

const formatearGs = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

function cabecera({ titulo, descripcion, canonical, imagen, indexable, jsonLd }) {
    const bloques = jsonLd
        .map((o) => `<script type="application/ld+json">${JSON.stringify(o).replace(/</g, '\\u003c')}</script>`)
        .join('\n    ');
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escaparHtml(titulo)}</title>
    <meta name="description" content="${escaparHtml(descripcion)}">
    <link rel="canonical" href="${canonical}">
    ${indexable ? '' : '<meta name="robots" content="noindex,follow">'}
    <meta property="og:type" content="product">
    <meta property="og:title" content="${escaparHtml(titulo)}">
    <meta property="og:description" content="${escaparHtml(descripcion)}">
    <meta property="og:image" content="${imagen}">
    <meta property="og:url" content="${canonical}">
    <meta property="og:site_name" content="AXTECH">
    <meta property="og:locale" content="es_PY">
    <meta name="twitter:card" content="summary_large_image">
    <link rel="icon" type="image/png" sizes="192x192" href="/assets/favicon_centered.png">
    <link rel="stylesheet" href="/index.css">
    ${bloques}
</head>`;
}

function encabezadoDelSitio() {
    return `<header class="header">
    <div class="container header-content">
        <a href="/" class="logo">
            <div class="logo-icon"><img src="/assets/logo.jpg" alt="AXTECH" class="logo-icon-img" width="48" height="48"></div>
            <div class="logo-text">
                <span class="logo-main">AXTECH</span>
                <span class="logo-sub">TECNOLOGÍA &amp; HARDWARE</span>
            </div>
        </a>
        <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener" class="contact-btn">
            <i class="lab la-whatsapp"></i>
            <div class="contact-btn-text"><span class="label">Consultas</span><span class="number">WhatsApp</span></div>
        </a>
    </div>
</header>`;
}

function pieDelSitio() {
    return `<footer class="footer">
    <div class="container footer-bottom-content">
        <p class="copyright">&copy; 2026 AXTECH. Todos los derechos reservados.</p>
        <a href="https://wa.me/${WHATSAPP}" target="_blank" rel="noopener">+595 976 914662</a>
    </div>
</footer>`;
}

export function paginaDeProducto({ producto: p, categoria, relacionados, urlBase }) {
    const specs = extraerSpecs(p.title);
    const canonical = `${urlBase}/p/${p.slug}/`;
    const titulo = `${p.title} - ${formatearGs(p.price)} | AXTECH`;
    const mensaje = encodeURIComponent(
        `Hola, quisiera consultar sobre el producto: ${p.title}\nPrecio: ${formatearGs(p.price)}\nLink / Imagen: ${canonical}`
    );

    const migas = [
        { nombre: 'Inicio', ruta: '/' },
        { nombre: categoria.nombre, ruta: `/c/${categoria.id}/` },
        { nombre: p.title, ruta: `/p/${p.slug}/` }
    ];

    const filasDeSpecs = specs.length
        ? `<table class="ficha-specs">
        <caption>Especificaciones</caption>
        ${specs.map((s) => `<tr><th scope="row">${escaparHtml(s.etiqueta)}</th><td>${escaparHtml(s.valor)}</td></tr>`).join('\n        ')}
    </table>`
        : '';

    const tarjetasRelacionadas = relacionados.map((r) => `
        <a class="relacionado" href="/p/${r.slug}/">
            <img src="${r.image}" alt="${escaparHtml(r.title)}" loading="lazy" width="150" height="150">
            <span class="relacionado-titulo">${escaparHtml(r.title)}</span>
            <span class="relacionado-precio">${formatearGs(r.price)}</span>
        </a>`).join('');

    return `${cabecera({
        titulo,
        descripcion: descripcionDe(p),
        canonical,
        imagen: `${urlBase}${p.image}`,
        indexable: esIndexable(p),
        jsonLd: [jsonLdProducto(p, urlBase), jsonLdMigaDePan(migas, urlBase)]
    })}
<body>
${encabezadoDelSitio()}
<main class="container ficha">
    <nav class="migas" aria-label="Ruta de navegación">
        <a href="/">Inicio</a> › <a href="/c/${categoria.id}/">${escaparHtml(categoria.nombre)}</a> › <span>${escaparHtml(p.title)}</span>
    </nav>
    <div class="ficha-cuerpo">
        <div class="ficha-imagen">
            <img src="${p.image}" alt="${escaparHtml(p.title)}" width="400" height="400">
        </div>
        <div class="ficha-datos">
            <p class="ficha-marca">${escaparHtml(p.brand)}</p>
            <h1 class="ficha-titulo">${escaparHtml(p.title)}</h1>
            <p class="ficha-precio">${formatearGs(p.price)}</p>
            <a class="btn btn-success ficha-cta" href="https://wa.me/${WHATSAPP}?text=${mensaje}" target="_blank" rel="noopener">
                <i class="lab la-whatsapp"></i> Consultar por WhatsApp
            </a>
            <p class="ficha-nota">Garantía de 3 meses. Envío con costo adicional a coordinar.</p>
            ${filasDeSpecs}
        </div>
    </div>
    ${relacionados.length ? `<section class="relacionados">
        <h2>Más en ${escaparHtml(categoria.nombre)}</h2>
        <div class="relacionados-grilla">${tarjetasRelacionadas}</div>
    </section>` : ''}
</main>
${pieDelSitio()}
</body>
</html>`;
}

export function paginaDeCategoria({ categoria, productos, pagina, totalPaginas, urlBase }) {
    const rutaBase = `/c/${categoria.id}/`;
    const canonical = `${urlBase}${pagina === 1 ? rutaBase : `${rutaBase}${pagina}/`}`;
    const titulo = pagina === 1
        ? `${categoria.nombre} en Paraguay | AXTECH`
        : `${categoria.nombre} - Página ${pagina} | AXTECH`;
    const descripcion = `${productos.length > 0 ? categoria.nombre : ''} al mejor precio en AXTECH. ${productos.length} productos disponibles con consulta por WhatsApp.`;

    const migas = [
        { nombre: 'Inicio', ruta: '/' },
        { nombre: categoria.nombre, ruta: rutaBase }
    ];

    const tarjetas = productos.map((p) => `
        <article class="producto">
            <a href="/p/${p.slug}/">
                <img src="${p.image}" alt="${escaparHtml(p.title)}" loading="lazy" width="220" height="220">
                <span class="producto-marca">${escaparHtml(p.brand)}</span>
                <h2 class="producto-titulo">${escaparHtml(p.title)}</h2>
                <span class="producto-precio">${formatearGs(p.price)}</span>
            </a>
        </article>`).join('');

    const anterior = pagina > 1 ? `<a rel="prev" href="${rutaBase}${pagina === 2 ? '' : pagina - 1 + '/'}">Anterior</a>` : '';
    const siguiente = pagina < totalPaginas ? `<a rel="next" href="${rutaBase}${pagina + 1}/">Siguiente</a>` : '';

    return `${cabecera({
        titulo,
        descripcion,
        canonical,
        imagen: `${urlBase}${productos[0]?.image || '/assets/logo.jpg'}`,
        indexable: productos.length > 0,
        jsonLd: [jsonLdCategoria(categoria, productos, urlBase), jsonLdMigaDePan(migas, urlBase), jsonLdTienda(urlBase)]
    })}
<body>
${encabezadoDelSitio()}
<main class="container listado">
    <nav class="migas" aria-label="Ruta de navegación">
        <a href="/">Inicio</a> › <span>${escaparHtml(categoria.nombre)}</span>
    </nav>
    <h1>${escaparHtml(categoria.nombre)}</h1>
    <p class="listado-conteo">${productos.length} productos en esta página</p>
    <div class="listado-grilla">${tarjetas}</div>
    <nav class="paginacion" aria-label="Paginación">
        ${anterior} <span>Página ${pagina} de ${totalPaginas}</span> ${siguiente}
    </nav>
    <p class="listado-volver"><a href="/">← Ver todo el catálogo</a></p>
</main>
${pieDelSitio()}
</body>
</html>`;
}
```

- [ ] **Step 2: Verificar que el HTML generado es válido**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { paginaDeProducto } from './src/build/plantillas.js';
import { CATEGORIAS } from './src/lib/taxonomy.js';
const c = JSON.parse(readFileSync('data/catalog.json','utf8')).filter(p => p.status === 'active');
const p = c.find(x => x.category === 'notebooks');
const cat = CATEGORIAS.find(x => x.id === 'notebooks');
const html = paginaDeProducto({ producto: p, categoria: cat, relacionados: c.filter(x => x.category === 'notebooks' && x.id !== p.id).slice(0, 4), urlBase: 'https://axtech.pages.dev' });
console.log('largo:', html.length, 'bytes');
console.log('tiene <h1>:', (html.match(/<h1/g) || []).length, '(debe ser 1)');
console.log('bloques JSON-LD:', (html.match(/application\/ld\+json/g) || []).length);
for (const m of html.matchAll(/<script type=\"application\/ld\+json\">(.*?)<\/script>/gs)) JSON.parse(m[1]);
console.log('JSON-LD valido: si');
"
```
Expected: exactamente 1 `<h1>`, 2 bloques JSON-LD, y todos parsean.

- [ ] **Step 3: Commit**

```bash
git add src/build/plantillas.js
git commit -m "feat: plantillas HTML de producto y categoria"
```

---

## Task 5: Generación de páginas y sitemaps

**Files:**
- Create: `src/build/paginas.js`, `src/build/sitemap.js`
- Modify: `src/build/index.js`, `robots.txt`

**Interfaces:**
- Consumes: `paginaDeProducto`, `paginaDeCategoria`; `esIndexable`; `CATEGORIAS`
- Produces: `generarPaginas({publicos, salida, urlBase}) => {productos, categorias, indexables}`

- [ ] **Step 1: Escribir el generador**

Crear `src/build/paginas.js`:

```javascript
import { writeFileSync, mkdirSync } from 'node:fs';
import { paginaDeProducto, paginaDeCategoria } from './plantillas.js';
import { esIndexable } from '../lib/seo.js';
import { CATEGORIAS } from '../lib/taxonomy.js';

const POR_PAGINA = 36;
const RELACIONADOS = 4;

function escribir(ruta, contenido) {
    mkdirSync(ruta.slice(0, ruta.lastIndexOf('/')), { recursive: true });
    writeFileSync(ruta, contenido, 'utf8');
}

export function generarPaginas({ publicos, salida, urlBase }) {
    const porCategoria = new Map();
    for (const p of publicos) {
        if (!porCategoria.has(p.category)) porCategoria.set(p.category, []);
        porCategoria.get(p.category).push(p);
    }

    const indexables = [];
    let paginasDeProducto = 0;
    let paginasDeCategoria = 0;

    for (const categoria of CATEGORIAS) {
        const items = porCategoria.get(categoria.id) || [];
        if (items.length === 0) continue;

        // Paginas de producto
        for (const p of items) {
            const relacionados = items.filter((x) => x.id !== p.id).slice(0, RELACIONADOS);
            escribir(`${salida}/p/${p.slug}/index.html`,
                paginaDeProducto({ producto: p, categoria, relacionados, urlBase }));
            paginasDeProducto++;
            if (esIndexable(p)) indexables.push(`/p/${p.slug}/`);
        }

        // Paginas de categoria, con paginacion
        const totalPaginas = Math.max(1, Math.ceil(items.length / POR_PAGINA));
        for (let n = 1; n <= totalPaginas; n++) {
            const trozo = items.slice((n - 1) * POR_PAGINA, n * POR_PAGINA);
            const ruta = n === 1 ? `${salida}/c/${categoria.id}/index.html` : `${salida}/c/${categoria.id}/${n}/index.html`;
            escribir(ruta, paginaDeCategoria({ categoria, productos: trozo, pagina: n, totalPaginas, urlBase }));
            paginasDeCategoria++;
            // Solo la primera pagina de cada categoria va al sitemap: las
            // siguientes son paginacion, no contenido nuevo.
            if (n === 1) indexables.push(`/c/${categoria.id}/`);
        }
    }

    return { productos: paginasDeProducto, categorias: paginasDeCategoria, indexables };
}
```

Crear `src/build/sitemap.js`:

```javascript
import { writeFileSync } from 'node:fs';

// Google admite 50.000 URLs por sitemap; se segmenta mucho antes para que
// cada archivo sea liviano y facil de reprocesar.
const POR_SITEMAP = 5000;

const urlXml = (loc, hoy) =>
    `  <url><loc>${loc}</loc><lastmod>${hoy}</lastmod></url>`;

export function generarSitemaps({ rutas, salida, urlBase }) {
    const hoy = new Date().toISOString().slice(0, 10);
    const trozos = [];
    for (let i = 0; i < rutas.length; i += POR_SITEMAP) trozos.push(rutas.slice(i, i + POR_SITEMAP));

    const archivos = [];
    trozos.forEach((trozo, i) => {
        const nombre = `sitemap-${i + 1}.xml`;
        const cuerpo = trozo.map((r) => urlXml(`${urlBase}${r}`, hoy)).join('\n');
        writeFileSync(`${salida}/${nombre}`,
            `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${cuerpo}\n</urlset>\n`, 'utf8');
        archivos.push(nombre);
    });

    const indice = archivos
        .map((a) => `  <sitemap><loc>${urlBase}/${a}</loc><lastmod>${hoy}</lastmod></sitemap>`)
        .join('\n');
    writeFileSync(`${salida}/sitemap.xml`,
        `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${indice}\n</sitemapindex>\n`, 'utf8');

    return { archivos: archivos.length, urls: rutas.length };
}
```

- [ ] **Step 2: Integrar en el build**

En `src/build/index.js`, agregar los imports:

```javascript
import { generarPaginas } from './paginas.js';
import { generarSitemaps } from './sitemap.js';
```

Y antes del bloque del guard, agregar:

```javascript
const urlBase = process.env.SITE_URL || 'https://axtech.pages.dev';
const { productos: nProd, categorias: nCat, indexables } =
    generarPaginas({ publicos, salida: SALIDA, urlBase });
const { archivos: nSitemaps, urls: nUrls } =
    generarSitemaps({ rutas: ['/', ...indexables], salida: SALIDA, urlBase });
console.log(`    paginas de producto:  ${nProd}`);
console.log(`    paginas de categoria: ${nCat}`);
console.log(`    URLs en el sitemap:   ${nUrls}  (${nSitemaps} archivos)`);
```

`sitemap.xml` deja de copiarse como estático: ahora se genera. Quitarlo de la
lista `ESTATICOS`.

- [ ] **Step 3: Actualizar `robots.txt`**

```
User-agent: *
Allow: /

Sitemap: https://axtech.pages.dev/sitemap.xml
```

- [ ] **Step 4: Construir y verificar**

```bash
node --env-file=.env src/build/index.js
echo "paginas de producto: $(find dist/p -name index.html | wc -l)"
echo "paginas de categoria: $(find dist/c -name index.html | wc -l)"
echo "archivos totales: $(find dist -type f | wc -l)   (limite Cloudflare: 20000)"
echo "URLs en sitemaps: $(grep -c '<loc>' dist/sitemap-*.xml | awk -F: '{s+=$2} END {print s}')"
```

Expected: ~5.000 páginas de producto, ~200 de categoría, menos de 20.000
archivos en total.

- [ ] **Step 5: Verificar que el guard sigue protegiendo las páginas nuevas**

El guard solo revisa `products.js`, `index.html` y `app.js`. Con miles de
páginas nuevas hay que ampliarlo. En `src/build/index.js`, reemplazar la lista
`aRevisar` por un recorrido de todo el HTML generado:

```javascript
import { readdirSync } from 'node:fs';

function todosLosArchivos(dir) {
    const salida = [];
    for (const e of readdirSync(dir, { withFileTypes: true })) {
        const ruta = `${dir}/${e.name}`;
        if (e.isDirectory()) salida.push(...todosLosArchivos(ruta));
        else if (/\.(html|js|json|xml)$/.test(e.name)) salida.push(ruta);
    }
    return salida;
}

const aRevisar = todosLosArchivos(SALIDA);
```

- [ ] **Step 6: Verificar una página real en el navegador**

```bash
npx --yes serve dist -l 4173
```

Abrir una página de producto y comprobar:
- Un solo `<h1>` con el nombre del producto.
- El precio y el botón de WhatsApp con el mensaje correcto.
- La imagen carga desde `/img/`.
- Las migas de pan enlazan a la categoría y al inicio.
- Los productos relacionados enlazan bien.
- La página **no descarga** `products.js` (pestaña Network).
- Sin errores en consola.

- [ ] **Step 7: Validar los datos estructurados**

```bash
node --input-type=module -e "
import { readFileSync, readdirSync } from 'node:fs';
const dirs = readdirSync('dist/p').slice(0, 50);
let n = 0;
for (const d of dirs) {
  const html = readFileSync('dist/p/' + d + '/index.html', 'utf8');
  for (const m of html.matchAll(/<script type=\"application\/ld\+json\">(.*?)<\/script>/gs)) { JSON.parse(m[1]); n++; }
}
console.log('bloques JSON-LD validados:', n);
"
```

- [ ] **Step 8: Commit**

```bash
git add src/build/ robots.txt
git commit -m "feat: generacion de paginas estaticas y sitemaps"
```

---

## Task 6: Estilos de las páginas nuevas

**Files:**
- Modify: `index.css`

- [ ] **Step 1: Agregar los estilos**

Al final de `index.css`, agregar. Todo usa las variables ya definidas en
`:root`, para que las páginas nuevas se vean como el resto del sitio:

```css
/* ======================================================================
   PAGINAS ESTATICAS (producto y categoria) - Fase 2
   ====================================================================== */

.migas {
    font-size: 0.85rem;
    color: var(--color-gray);
    padding: 1.25rem 0;
}
.migas a { color: var(--color-primary); text-decoration: none; }
.migas a:hover { text-decoration: underline; }

/* --- Ficha de producto --- */
.ficha-cuerpo {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.2fr);
    gap: 2.5rem;
    align-items: start;
    margin-bottom: 3rem;
}
.ficha-imagen {
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius);
    padding: 1.5rem;
    display: flex;
    justify-content: center;
}
.ficha-imagen img { max-width: 100%; height: auto; }

.ficha-marca {
    color: var(--color-primary);
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    font-size: 0.8rem;
    margin-bottom: 0.5rem;
}
.ficha-titulo {
    font-family: var(--font-heading);
    font-size: clamp(1.25rem, 3vw, 1.75rem);
    line-height: 1.3;
    margin-bottom: 1rem;
}
.ficha-precio {
    font-family: var(--font-heading);
    font-size: clamp(1.75rem, 5vw, 2.5rem);
    font-weight: 700;
    color: var(--color-white);
    margin-bottom: 1.5rem;
}
.ficha-cta {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    text-decoration: none;
    font-size: 1.05rem;
    padding: 0.9rem 1.75rem;
}
.ficha-nota {
    color: var(--color-gray);
    font-size: 0.85rem;
    margin: 1rem 0 2rem;
}

.ficha-specs {
    width: 100%;
    border-collapse: collapse;
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius);
    overflow: hidden;
}
.ficha-specs caption {
    text-align: left;
    font-family: var(--font-heading);
    font-weight: 600;
    padding: 0.75rem 1rem;
    color: var(--color-white);
}
.ficha-specs th,
.ficha-specs td {
    padding: 0.7rem 1rem;
    text-align: left;
    border-top: 1px solid var(--border-glass);
    font-size: 0.9rem;
}
.ficha-specs th { color: var(--color-gray); font-weight: 500; width: 45%; }
.ficha-specs td { color: var(--color-white); }

/* --- Relacionados --- */
.relacionados { margin: 3rem 0; }
.relacionados h2 {
    font-family: var(--font-heading);
    font-size: 1.25rem;
    margin-bottom: 1.25rem;
}
.relacionados-grilla {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
    gap: 1rem;
}
.relacionado {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius);
    padding: 1rem;
    text-decoration: none;
    transition: border-color 0.2s ease, transform 0.2s ease;
}
.relacionado:hover { border-color: var(--border-hover); transform: translateY(-2px); }
.relacionado img { width: 100%; height: auto; }
.relacionado-titulo {
    font-size: 0.8rem;
    color: var(--color-white);
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.relacionado-precio { font-weight: 700; color: var(--color-primary); }

/* --- Listado de categoria --- */
.listado h1 {
    font-family: var(--font-heading);
    font-size: clamp(1.5rem, 4vw, 2rem);
    margin-bottom: 0.35rem;
}
.listado-conteo { color: var(--color-gray); margin-bottom: 1.75rem; }
.listado-grilla {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: 1.25rem;
}
.producto a {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    background: var(--bg-card);
    border: 1px solid var(--border-glass);
    border-radius: var(--radius);
    padding: 1rem;
    height: 100%;
    text-decoration: none;
    transition: border-color 0.2s ease, transform 0.2s ease;
}
.producto a:hover { border-color: var(--border-hover); transform: translateY(-3px); }
.producto img { width: 100%; height: auto; }
.producto-marca {
    color: var(--color-primary);
    font-size: 0.72rem;
    letter-spacing: 0.05em;
    text-transform: uppercase;
}
.producto-titulo {
    font-size: 0.88rem;
    font-weight: 500;
    color: var(--color-white);
    line-height: 1.35;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
}
.producto-precio {
    margin-top: auto;
    font-family: var(--font-heading);
    font-size: 1.05rem;
    font-weight: 700;
    color: var(--color-white);
}

.paginacion {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.25rem;
    margin: 2.5rem 0;
    color: var(--color-gray);
}
.paginacion a { color: var(--color-primary); text-decoration: none; }
.paginacion a:hover { text-decoration: underline; }
.listado-volver { text-align: center; margin-bottom: 2.5rem; }
.listado-volver a { color: var(--color-primary); text-decoration: none; }

@media (max-width: 768px) {
    .ficha-cuerpo { grid-template-columns: 1fr; gap: 1.5rem; }
    .ficha-cta { width: 100%; justify-content: center; }
    .relacionados-grilla { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); }
    .listado-grilla { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); }
}
```

- [ ] **Step 2: Verificar en el navegador, incluido móvil**

Con el servidor local, abrir una página de producto y una de categoría, y
revisarlas en ancho de escritorio y en 390 px de ancho. Comprobar que nada se
desborda horizontalmente.

- [ ] **Step 3: Verificar el presupuesto de CSS**

```bash
gzip -c dist/index.css | wc -c | awk '{printf "index.css: %.0f KB gzip (limite 25)\n", $1/1024}'
```

- [ ] **Step 4: Commit**

```bash
git add index.css
git commit -m "feat: estilos de las paginas de producto y categoria"
```

---

## Task 7: Documentar y publicar

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Documentar la estructura de URLs en `AGENTS.md`**

Agregar una sección:

```markdown
## Estructura de URLs

```
/                     home
/c/{categoria}/       28 categorias
/c/{categoria}/{n}/   paginacion
/p/{slug}/            una por producto
/sitemap.xml          indice de sitemaps
```

Las páginas de producto son autónomas: no descargan el catálogo completo.

**Compuerta de calidad**: una página se indexa solo si tiene precio, título de
25 caracteres o más, y marca conocida o al menos una especificación. Las demás
se generan con `noindex` y quedan fuera del sitemap. Publicar miles de páginas
finas perjudica al dominio entero.
```

- [ ] **Step 2: Suite completa y build**

```bash
npm test
node --env-file=.env src/build/index.js
```

- [ ] **Step 3: Abrir el PR y fusionar tras el CI en verde**

```bash
git push -u origin feat/fase-2-seo
```

- [ ] **Step 4: Verificar en producción**

```bash
curl -s -o /dev/null -w "sitemap: %{http_code}\n" https://axtech.pages.dev/sitemap.xml
curl -s https://axtech.pages.dev/robots.txt
```

Abrir una página de producto real y comprobar que se ve bien.

- [ ] **Step 5: Enviar el sitemap a Google Search Console**

Es un paso manual del responsable del sitio: dar de alta la propiedad
`axtech.pages.dev` y enviar `https://axtech.pages.dev/sitemap.xml`.

---

## Criterio de aceptación de la Fase 2

- [ ] `npm test` pasa por completo.
- [ ] Se genera una página por producto publicado y una por categoría.
- [ ] Más de 3.000 URLs indexables en el sitemap.
- [ ] Cada página de producto tiene exactamente un `<h1>`.
- [ ] Todo el JSON-LD generado parsea como JSON válido.
- [ ] El JSON-LD de producto declara `priceCurrency: "PYG"`.
- [ ] Las páginas finas llevan `noindex` y **no** están en el sitemap.
- [ ] Las páginas de producto **no** descargan `products.js`.
- [ ] Cero menciones al proveedor en todo `dist/`, verificado sobre todos los archivos generados.
- [ ] Menos de 20.000 archivos en `dist/`.
- [ ] `index.css` sigue bajo 25 KB gzip.
- [ ] El sitio desplegado funciona y las páginas nuevas se ven bien en móvil.
