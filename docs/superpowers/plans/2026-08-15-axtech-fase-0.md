# AXTECH Fase 0 — Seguridad de datos, hosting y limpieza

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar los costos y la identidad del proveedor del repositorio y de lo que se sirve al navegador, reducir el catálogo público de 10,4 MB a ~0,5 MB, y mover el sitio a Cloudflare Pages — sin cambiar cómo se ve ni cómo funciona para el visitante.

**Architecture:** Se separa la fuente de verdad (`data/catalog.json`, sin costos ni proveedor) de lo que se entrega (`dist/`, generado por un build). Un script de migración única convierte el `products.js` legado al formato nuevo. El build proyecta solo los productos activos a través de una whitelist de campos, y un guard falla el build si algún campo prohibido sobrevive. `app.js` e `index.html` cambian lo mínimo indispensable.

**Tech Stack:** Node.js ≥ 20 (ESM), `node:test` + `node:assert` (sin dependencias externas), HTML/CSS/JS vanilla, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md`

## Global Constraints

- **Sin dependencias de producción.** El proyecto no usa frameworks ni librerías. Los tests usan `node:test`, incluido en Node. No agregar paquetes de npm en esta fase.
- **Node.js ≥ 20** (`node:test` estable). El CI corre Node 24.
- **Campos prohibidos** en `data/catalog.json` y en todo `dist/`: `pyg_orig`, `pyg_orig_str`, `usd`, `brl`, `orig_url`, `title_orig`, `titleOrig`, `cost`, `costo`.
- **El dominio del proveedor nunca se escribe en código versionado.** Se lee de `process.env.SUPPLIER_IMG_BASE`.
- **Título del sitio**, exacto y sin sufijos de país: `AXTECH | Tu Tienda de Tecnología y Hardware`
- **WhatsApp del negocio**: `595976914662`
- **Formato de precio**: `Gs. 8.050.000` (separador de miles con punto, sin decimales).
- **Idioma del código**: identificadores y comentarios en español, coherente con el proyecto existente.
- **Commits frecuentes**, uno por tarea como mínimo.

## Nota sobre el estado intermedio de esta fase

La Fase 0 **conserva los nombres de categoría actuales** en su forma legible
(`"Televisores"`, `"Tarjetas de Video"`), porque `app.js` filtra comparando
contra esas cadenas exactas. La taxonomía definitiva de 24 categorías en formato
slug (§6.2 del spec) se introduce en la Fase 1 junto con `taxonomy.js`. La única
excepción es la fusión de `Relojes Mi Band` → `Relojes Smart`, que sí ocurre acá
porque son una categoría duplicada, no un cambio de taxonomía.

Del mismo modo, `dist/products.js` mantiene en esta fase el formato legado
(`const PRODUCTS = [...]`) para que `app.js` siga funcionando sin reescribirse.
La Fase 1 lo reemplaza por chunks JSON cargados con `fetch`.

Sobre los secretos: esta fase mueve **solo el proveedor** (`SUPPLIER_IMG_BASE`)
a variables de entorno. El secreto `PRICING_CONFIG` llega en la Fase 1, cuando
exista `src/lib/pricing.js` que lo consuma; adelantarlo no tendría lector.

Sobre la purga a 30 días: esta fase asigna `lastSeen = hoy` a todos los
registros porque no hay historial disponible. La purga no elimina nada todavía
— empieza a operar en la Fase 4, cuando el sync corregido lleve el `lastSeen`
real de cada corrida.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `package.json` | **Crear.** Scripts, `type: module`, motor de Node |
| `.gitignore` | **Modificar.** Agregar `dist/`, `node_modules/`, `config/pricing.config.json`, `.claude/worktrees/` |
| `.env.example` | **Crear.** Plantilla de variables de entorno, sin valores reales |
| `src/lib/formato.js` | **Crear.** Formateo de precios en guaraníes |
| `src/lib/slug.js` | **Crear.** Generación de slugs de URL |
| `src/lib/contract.js` | **Crear.** Whitelist de campos públicos y proyección |
| `src/migrate/desde-products-js.js` | **Crear.** Migración única del catálogo legado |
| `src/migrate/ejecutar.js` | **Crear.** Ejecutable de la migración |
| `src/build/guard.js` | **Crear.** Detección de fugas en la salida |
| `src/build/index.js` | **Crear.** Build: catálogo → `dist/` |
| `data/catalog.json` | **Crear** (generado). Fuente de verdad sin datos sensibles |
| `test/lib/*.test.js` | **Crear.** Tests unitarios |
| `test/migrate/*.test.js` | **Crear.** Tests de migración |
| `test/build/*.test.js` | **Crear.** Tests del guard |
| `app.js` | **Modificar** líneas 338, 341, 344 y 1935: quitar `ref` y `title_orig` del texto de búsqueda |
| `index.html` | **Modificar.** Quitar los scripts de Vercel Analytics y Speed Insights |
| `AGENTS.md` | **Crear.** Fuente de verdad única de reglas |
| `CLAUDE.md` | **Reescribir.** Stub que apunta a `AGENTS.md` |
| `REGLAS_PROYECTO_AXTECH.md` | **Eliminar.** Fusionado en `AGENTS.md` |
| `.agents/` | **Eliminar.** Skills obsoletas, se rehacen en la Fase 4 |
| `historia_de_conversacion.md` | **Eliminar.** 267 KB sin valor operativo |
| `assets/` | **Limpiar.** 31 de 34 archivos no se referencian |
| `sync-legacy.cjs` | **Renombrar** a `sync-legacy.cjs` (es CommonJS; se congela hasta la Fase 4) |
| `.github/workflows/daily_sync.yml` | **Modificar.** Pausar el cron, actualizar la ruta del script |
| `.github/workflows/ci.yml` | **Crear.** Tests + build + guard en cada PR |

---

## Task 1: Andamiaje del proyecto Node

**Files:**
- Create: `package.json`, `.env.example`
- Modify: `.gitignore`
- Rename: `sync-legacy.cjs` → `sync-legacy.cjs`
- Modify: `.github/workflows/daily_sync.yml:31`

**Interfaces:**
- Consumes: nada (primera tarea)
- Produces: el comando `npm test` ejecuta `node --test test/`; el comando `npm run build` ejecuta `node src/build/index.js`; el comando `npm run migrate` ejecuta `node src/migrate/ejecutar.js`

- [ ] **Step 1: Crear `package.json`**

`sync-legacy.cjs` usa `require()`, así que al activar `"type": "module"` hay que
renombrarlo a `.cjs` o dejaría de correr. Se renombra en el Step 3.

```json
{
  "name": "axtech",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "test": "node --test test/",
    "build": "node src/build/index.js",
    "migrate": "node src/migrate/ejecutar.js"
  }
}
```

- [ ] **Step 2: Ampliar `.gitignore`**

Reemplazar el contenido completo del archivo por:

```gitignore
.vercel
.env*
!.env.example
node_modules/
dist/
config/pricing.config.json
.claude/worktrees/
```

- [ ] **Step 3: Renombrar el sync legado y actualizar el workflow**

```bash
git mv sync-legacy.cjs sync-legacy.cjs
```

En `.github/workflows/daily_sync.yml`, cambiar la línea `run: node sync-legacy.cjs` por:

```yaml
        run: node sync-legacy.cjs
```

- [ ] **Step 4: Crear `.env.example`**

Sin valores reales. Este archivo sí se versiona (está exceptuado en `.gitignore`).

```bash
# Base de las imágenes del proveedor. Se usa solo durante la Fase 0;
# a partir de la Fase 1 las imágenes se sirven desde Cloudflare R2.
SUPPLIER_IMG_BASE=

# Base pública de las imágenes propias en R2 (Fase 1 en adelante).
R2_PUBLIC_BASE=
```

- [ ] **Step 5: Crear el directorio de tests con un test de humo**

Crear `test/humo.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';

test('el runner de node:test funciona', () => {
    assert.equal(1 + 1, 2);
});
```

- [ ] **Step 6: Verificar que el runner corre**

Run: `npm test`
Expected: PASS — 1 test, 0 fallos.

- [ ] **Step 7: Commit**

```bash
git add package.json .gitignore .env.example test/humo.test.js sync-legacy.cjs .github/workflows/daily_sync.yml
git commit -m "chore: andamiaje de Node con node:test y ESM"
```

---

## Task 2: Formateo de precios (`src/lib/formato.js`)

Se implementa sin `toLocaleString` porque su salida depende de los datos de ICU
del entorno, lo que haría que los tests pasaran en una máquina y fallaran en
otra. El proyecto necesita una salida determinista.

**Files:**
- Create: `src/lib/formato.js`
- Test: `test/lib/formato.test.js`

**Interfaces:**
- Consumes: nada
- Produces: `formatearGs(monto: number) => string`

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/formato.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatearGs } from '../../src/lib/formato.js';

test('formatea con punto como separador de miles', () => {
    assert.equal(formatearGs(8050000), 'Gs. 8.050.000');
});

test('formatea montos de menos de mil sin separador', () => {
    assert.equal(formatearGs(500), 'Gs. 500');
});

test('formatea exactamente mil', () => {
    assert.equal(formatearGs(1000), 'Gs. 1.000');
});

test('redondea decimales al entero mas cercano', () => {
    assert.equal(formatearGs(1000.6), 'Gs. 1.001');
});

test('formatea cero', () => {
    assert.equal(formatearGs(0), 'Gs. 0');
});

test('devuelve null para valores no numericos', () => {
    assert.equal(formatearGs(null), null);
    assert.equal(formatearGs(undefined), null);
    assert.equal(formatearGs(NaN), null);
    assert.equal(formatearGs('8050000'), null);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test test/lib/formato.test.js`
Expected: FAIL — `Cannot find module '.../src/lib/formato.js'`

- [ ] **Step 3: Implementar**

Crear `src/lib/formato.js`:

```javascript
/**
 * Formatea un monto en guaraníes con punto como separador de miles.
 * Implementación determinista: no depende de los datos de ICU del entorno.
 */
export function formatearGs(monto) {
    if (typeof monto !== 'number' || !Number.isFinite(monto)) return null;
    const entero = Math.round(monto);
    const conPuntos = String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `Gs. ${entero < 0 ? '-' : ''}${conPuntos}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test test/lib/formato.test.js`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/formato.js test/lib/formato.test.js
git commit -m "feat: formateo determinista de precios en guaranies"
```

---

## Task 3: Slugs de URL (`src/lib/slug.js`)

**Files:**
- Create: `src/lib/slug.js`
- Test: `test/lib/slug.test.js`

**Interfaces:**
- Consumes: nada
- Produces: `slugificar(texto: string) => string`, `slugDeProducto(titulo: string, id: number) => string`

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/slug.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { slugificar, slugDeProducto } from '../../src/lib/slug.js';

test('pasa a minusculas y une con guiones', () => {
    assert.equal(slugificar('Tarjeta De Video'), 'tarjeta-de-video');
});

test('quita acentos y enies', () => {
    assert.equal(slugificar('Periféricos y Diseño'), 'perifericos-y-diseno');
});

test('elimina simbolos y comillas', () => {
    assert.equal(slugificar('TV 100" JVC 4K/SMART'), 'tv-100-jvc-4k-smart');
});

test('colapsa separadores repetidos', () => {
    assert.equal(slugificar('SSD   ---   1TB'), 'ssd-1tb');
});

test('no deja guiones al principio ni al final', () => {
    assert.equal(slugificar('  --Monitor--  '), 'monitor');
});

test('limita a 60 caracteres sin dejar guion colgando', () => {
    const largo = slugificar('a'.repeat(80));
    assert.ok(largo.length <= 60);
    assert.ok(!largo.endsWith('-'));
});

test('devuelve cadena vacia si no queda nada utilizable', () => {
    assert.equal(slugificar('!!!'), '');
    assert.equal(slugificar(''), '');
    assert.equal(slugificar(null), '');
});

test('el slug de producto agrega el id como sufijo', () => {
    assert.equal(slugDeProducto('Monitor AOC 24"', 10122), 'monitor-aoc-24-10122');
});

test('el slug de producto usa un respaldo si el titulo no aporta nada', () => {
    assert.equal(slugDeProducto('!!!', 10122), 'producto-10122');
});

test('el slug de producto es unico para el mismo titulo con distinto id', () => {
    assert.notEqual(slugDeProducto('Mouse', 1), slugDeProducto('Mouse', 2));
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test test/lib/slug.test.js`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar**

Crear `src/lib/slug.js`:

```javascript
const LARGO_MAXIMO = 60;

/**
 * Convierte texto libre en un slug apto para URL: minúsculas, sin acentos,
 * separado por guiones simples.
 */
export function slugificar(texto) {
    if (typeof texto !== 'string') return '';
    return texto
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, LARGO_MAXIMO)
        .replace(/-+$/g, '');
}

/**
 * Slug de un producto. El id como sufijo garantiza unicidad aunque dos
 * productos compartan título.
 */
export function slugDeProducto(titulo, id) {
    const base = slugificar(titulo);
    return base ? `${base}-${id}` : `producto-${id}`;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test test/lib/slug.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/slug.js test/lib/slug.test.js
git commit -m "feat: generacion de slugs de URL"
```

---

## Task 4: Contrato de datos públicos (`src/lib/contract.js`)

Es el módulo que hace estructuralmente imposible que un costo llegue al
navegador: la proyección es una whitelist, no una lista de exclusiones. Un campo
nuevo en el catálogo no se publica salvo que alguien lo agregue explícitamente.

**Files:**
- Create: `src/lib/contract.js`
- Test: `test/lib/contract.test.js`

**Interfaces:**
- Consumes: `formatearGs` de `src/lib/formato.js`
- Produces:
  - `CAMPOS_PROHIBIDOS: string[]`
  - `aPublicoLegado(registro: object, baseImagenes: string) => object | null`

`aPublicoLegado` produce la forma que consume el `app.js` actual. Es
transitoria: la Fase 1 la reemplaza por la proyección definitiva de §4.2 del
spec.

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/contract.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { aPublicoLegado, CAMPOS_PROHIBIDOS } from '../../src/lib/contract.js';

const BASE = 'https://img.ejemplo.test';

function registroValido(extra = {}) {
    return {
        id: 10122,
        ref: '329967',
        slug: 'tv-100-jvc-10122',
        title: 'TV 100 JVC LT-100KM958',
        brand: 'JVC',
        category: 'Televisores',
        specs: ['100"', '4K'],
        price: 8050000,
        status: 'active',
        firstSeen: '2026-03-02',
        lastSeen: '2026-08-15',
        ...extra
    };
}

test('proyecta solo los campos que app.js consume', () => {
    const publico = aPublicoLegado(registroValido(), BASE);
    assert.deepEqual(Object.keys(publico).sort(), [
        'brand', 'category', 'id', 'image', 'pyg', 'pyg_str', 'sob_consulta', 'specs', 'title'
    ]);
});

test('formatea el precio y conserva el valor numerico', () => {
    const publico = aPublicoLegado(registroValido(), BASE);
    assert.equal(publico.pyg, 8050000);
    assert.equal(publico.pyg_str, 'Gs. 8.050.000');
});

test('deriva la url de imagen desde la base y el ref', () => {
    const publico = aPublicoLegado(registroValido(), BASE);
    assert.equal(publico.image, `${BASE}/IMG_329967_1.JPG`);
});

test('sob_consulta siempre es false: los ocultos no se publican', () => {
    assert.equal(aPublicoLegado(registroValido(), BASE).sob_consulta, false);
});

test('descarta los registros ocultos', () => {
    assert.equal(aPublicoLegado(registroValido({ status: 'hidden' }), BASE), null);
});

test('descarta los registros sin precio valido', () => {
    assert.equal(aPublicoLegado(registroValido({ price: 0 }), BASE), null);
    assert.equal(aPublicoLegado(registroValido({ price: null }), BASE), null);
});

test('ningun campo prohibido sobrevive a la proyeccion', () => {
    const contaminado = registroValido({
        pyg_orig: 7950000,
        usd: 'US$ 1.250,00',
        brl: 'R$ 6.600,00',
        orig_url: 'https://proveedor.test/producto/329967.html',
        title_orig: 'TV 100 JVC ORIGINAL'
    });
    const publico = aPublicoLegado(contaminado, BASE);
    for (const campo of CAMPOS_PROHIBIDOS) {
        assert.ok(!(campo in publico), `el campo prohibido "${campo}" llego a la salida publica`);
    }
});

test('el ref no viaja al navegador aunque se use para la imagen', () => {
    const publico = aPublicoLegado(registroValido(), BASE);
    assert.equal(publico.ref, undefined);
});

test('specs ausente se normaliza a arreglo vacio', () => {
    const publico = aPublicoLegado(registroValido({ specs: undefined }), BASE);
    assert.deepEqual(publico.specs, []);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test test/lib/contract.test.js`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar**

Crear `src/lib/contract.js`:

```javascript
import { formatearGs } from './formato.js';

/**
 * Campos que jamás pueden aparecer ni en data/catalog.json ni en dist/.
 * Revelan el costo, el margen o la identidad del proveedor.
 */
export const CAMPOS_PROHIBIDOS = [
    'pyg_orig',
    'pyg_orig_str',
    'usd',
    'brl',
    'orig_url',
    'title_orig',
    'titleOrig',
    'cost',
    'costo'
];

/**
 * Proyecta un registro del catálogo a la forma que consume el app.js actual.
 *
 * Es una whitelist: agregar un campo al catálogo no lo publica salvo que se
 * lo agregue acá explícitamente. Esa es la garantía de que un costo no puede
 * llegar al navegador por descuido.
 *
 * TRANSITORIO — la Fase 1 lo reemplaza por la proyección definitiva (§4.2).
 *
 * @returns el objeto público, o null si el registro no debe publicarse.
 */
export function aPublicoLegado(registro, baseImagenes) {
    if (!registro || registro.status !== 'active') return null;
    if (typeof registro.price !== 'number' || registro.price <= 0) return null;

    return {
        id: registro.id,
        title: registro.title,
        brand: registro.brand,
        category: registro.category,
        image: `${baseImagenes}/IMG_${registro.ref}_1.JPG`,
        pyg: registro.price,
        pyg_str: formatearGs(registro.price),
        specs: Array.isArray(registro.specs) ? registro.specs : [],
        sob_consulta: false
    };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test test/lib/contract.test.js`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/contract.js test/lib/contract.test.js
git commit -m "feat: contrato de proyeccion publica con whitelist de campos"
```

---

## Task 5: Migración del catálogo legado (`src/migrate/desde-products-js.js`)

La función es pura: recibe el arreglo legado y devuelve `{ catalogo, reporte }`.
No lee ni escribe archivos, para poder testearla con datos pequeños.

Los registros ocultos se conservan pero **reducidos a sus campos de identidad**
(sin `specs` ni `price`). Preserva la correspondencia `id` ↔ `ref` que el sync
necesita, sin inflar el archivo.

**Files:**
- Create: `src/migrate/desde-products-js.js`
- Test: `test/migrate/desde-products-js.test.js`

**Interfaces:**
- Consumes: `slugDeProducto` de `src/lib/slug.js`
- Produces: `migrarCatalogo(legado: object[], opciones: { hoy: string }) => { catalogo: object[], reporte: object }`

El `reporte` tiene la forma:
```javascript
{ entrada: number, activos: number, ocultos: number,
  duplicadosEliminados: number, sinTitulo: number, relojesFusionados: number }
```

- [ ] **Step 1: Escribir el test que falla**

Crear `test/migrate/desde-products-js.test.js`:

```javascript
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
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test test/migrate/desde-products-js.test.js`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar**

Crear `src/migrate/desde-products-js.js`:

```javascript
import { slugDeProducto } from '../lib/slug.js';

const FUSIONES_DE_CATEGORIA = {
    'Relojes Mi Band': 'Relojes Smart'
};

/**
 * Convierte el catálogo legado (products.js) al formato de data/catalog.json.
 *
 * Función pura: no toca el sistema de archivos, para poder testearla con
 * conjuntos de datos pequeños.
 */
export function migrarCatalogo(legado, { hoy }) {
    const reporte = {
        entrada: legado.length,
        activos: 0,
        ocultos: 0,
        duplicadosEliminados: 0,
        sinTitulo: 0,
        relojesFusionados: 0
    };

    const porRef = new Map();

    for (const viejo of legado) {
        const ref = viejo.ref === undefined || viejo.ref === null ? '' : String(viejo.ref).trim();
        if (!ref) continue;

        const title = typeof viejo.title === 'string' ? viejo.title.trim() : '';
        if (!title) {
            reporte.sinTitulo++;
            continue;
        }

        let category = viejo.category || 'Periféricos';
        if (FUSIONES_DE_CATEGORIA[category]) {
            category = FUSIONES_DE_CATEGORIA[category];
            reporte.relojesFusionados++;
        }

        const precio = typeof viejo.pyg === 'number' ? viejo.pyg : 0;
        const activo = viejo.sob_consulta === false && precio > 0;

        const base = {
            id: viejo.id,
            ref,
            slug: slugDeProducto(title, viejo.id),
            title,
            brand: viejo.brand || 'GENERIC',
            category,
            status: activo ? 'active' : 'hidden',
            firstSeen: hoy,
            lastSeen: hoy
        };

        // Los ocultos se guardan reducidos: preservan la correspondencia
        // id <-> ref que el sync necesita, sin inflar el archivo.
        const registro = activo
            ? { ...base, specs: Array.isArray(viejo.specs) ? viejo.specs : [], price: precio }
            : base;

        // Orden de claves estable, para que el diff de git sea legible.
        const ordenado = activo
            ? {
                id: registro.id, ref: registro.ref, slug: registro.slug,
                title: registro.title, brand: registro.brand, category: registro.category,
                specs: registro.specs, price: registro.price, status: registro.status,
                firstSeen: registro.firstSeen, lastSeen: registro.lastSeen
            }
            : registro;

        const previo = porRef.get(ref);
        if (previo) {
            reporte.duplicadosEliminados++;
            // Ante un duplicado gana el que tiene precio; si empatan, el primero.
            if (previo.status !== 'active' && ordenado.status === 'active') {
                porRef.set(ref, ordenado);
            }
        } else {
            porRef.set(ref, ordenado);
        }
    }

    const catalogo = [...porRef.values()];
    for (const r of catalogo) {
        if (r.status === 'active') reporte.activos++;
        else reporte.ocultos++;
    }

    return { catalogo, reporte };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test test/migrate/desde-products-js.test.js`
Expected: PASS — 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/migrate/desde-products-js.js test/migrate/desde-products-js.test.js
git commit -m "feat: migracion del catalogo legado sin campos sensibles"
```

---

## Task 6: Ejecutar la migración y generar `data/catalog.json`

**Files:**
- Create: `src/migrate/ejecutar.js`
- Create (generado): `data/catalog.json`

**Interfaces:**
- Consumes: `migrarCatalogo` de `src/migrate/desde-products-js.js`
- Produces: `data/catalog.json` en disco

- [ ] **Step 1: Escribir el ejecutable**

Crear `src/migrate/ejecutar.js`. Lee `products.js` con `JSON.parse` en vez de
`eval` — el archivo legado es JSON válido una vez removido el prefijo.

```javascript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { migrarCatalogo } from './desde-products-js.js';

const ORIGEN = 'products.js';
const DESTINO = 'data/catalog.json';

const crudo = readFileSync(ORIGEN, 'utf8');
const soloJson = crudo
    .replace(/^\/\/.*$/m, '')
    .replace('const PRODUCTS =', '')
    .trim()
    .replace(/;\s*$/, '');

const legado = JSON.parse(soloJson);
const hoy = new Date().toISOString().slice(0, 10);
const { catalogo, reporte } = migrarCatalogo(legado, { hoy });

mkdirSync('data', { recursive: true });
writeFileSync(DESTINO, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');

console.log('=== Migración del catálogo ===');
console.log(`  Entrada:                 ${reporte.entrada}`);
console.log(`  Sin título (descartados): ${reporte.sinTitulo}`);
console.log(`  Duplicados eliminados:   ${reporte.duplicadosEliminados}`);
console.log(`  Relojes fusionados:      ${reporte.relojesFusionados}`);
console.log(`  Activos:                 ${reporte.activos}`);
console.log(`  Ocultos:                 ${reporte.ocultos}`);
console.log(`  Total escrito:           ${catalogo.length}`);
console.log(`\n✅ ${DESTINO}`);
```

- [ ] **Step 2: Correr la migración**

Run: `npm run migrate`
Expected: se imprime el reporte. Verificar que **Activos ≈ 2.524** y
**Entrada = 12.998** — si difieren mucho, detenerse e investigar antes de seguir.

- [ ] **Step 3: Verificar que no quedó nada sensible en el archivo generado**

Run:
```bash
grep -c "proveedor\|pyg_orig\|orig_url\|title_orig\|\"usd\"\|\"brl\"" data/catalog.json
```
Expected: `0`

- [ ] **Step 4: Verificar el tamaño resultante**

Run: `ls -la data/catalog.json`
Expected: sustancialmente menor a los 10,4 MB de `products.js` (esperado: ~2 MB).

- [ ] **Step 5: Commit**

```bash
git add src/migrate/ejecutar.js data/catalog.json
git commit -m "feat: catalogo migrado a data/catalog.json sin datos sensibles"
```

---

## Task 7: Guard de fugas (`src/build/guard.js`)

Convierte la fuga de datos en algo imposible de reintroducir por descuido: el
build falla si detecta un campo prohibido o el dominio del proveedor en la
salida.

**Files:**
- Create: `src/build/guard.js`
- Test: `test/build/guard.test.js`

**Interfaces:**
- Consumes: `CAMPOS_PROHIBIDOS` de `src/lib/contract.js`
- Produces: `buscarFugas(texto: string, opciones: { cadenasProhibidas?: string[] }) => string[]`

Devuelve un arreglo de descripciones de fuga; vacío significa que está limpio.

- [ ] **Step 1: Escribir el test que falla**

Crear `test/build/guard.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { buscarFugas } from '../../src/build/guard.js';

test('no reporta nada en contenido limpio', () => {
    const limpio = 'const PRODUCTS = [{"id":1,"title":"Mouse","pyg":50000}];';
    assert.deepEqual(buscarFugas(limpio, {}), []);
});

test('detecta un campo prohibido', () => {
    const fugas = buscarFugas('{"pyg_orig":7950000}', {});
    assert.equal(fugas.length, 1);
    assert.ok(fugas[0].includes('pyg_orig'));
});

test('detecta varios campos prohibidos a la vez', () => {
    const fugas = buscarFugas('{"usd":"US$ 10","orig_url":"x","title_orig":"y"}', {});
    assert.equal(fugas.length, 3);
});

test('detecta una cadena prohibida como el dominio del proveedor', () => {
    const fugas = buscarFugas('img src="https://proveedor.test/x.jpg"', {
        cadenasProhibidas: ['proveedor.test']
    });
    assert.equal(fugas.length, 1);
    assert.ok(fugas[0].includes('proveedor.test'));
});

test('la busqueda de cadenas prohibidas ignora mayusculas', () => {
    const fugas = buscarFugas('PROVEEDOR.TEST', { cadenasProhibidas: ['proveedor.test'] });
    assert.equal(fugas.length, 1);
});

test('ignora las cadenas prohibidas vacias', () => {
    assert.deepEqual(buscarFugas('cualquier cosa', { cadenasProhibidas: ['', '   '] }), []);
});

test('no confunde un campo prohibido con un nombre que lo contiene', () => {
    assert.deepEqual(buscarFugas('{"pyg_original_no_es_lo_mismo":1}', {}), []);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test test/build/guard.test.js`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar**

Crear `src/build/guard.js`:

```javascript
import { CAMPOS_PROHIBIDOS } from '../lib/contract.js';

/**
 * Busca fugas de información sensible en un texto generado.
 *
 * Los campos se buscan como clave JSON exacta ("campo":) para no confundir
 * un campo prohibido con otro nombre que lo contenga como prefijo.
 *
 * @returns descripciones de las fugas encontradas; vacío = limpio.
 */
export function buscarFugas(texto, { cadenasProhibidas = [] } = {}) {
    const fugas = [];

    for (const campo of CAMPOS_PROHIBIDOS) {
        if (texto.includes(`"${campo}":`)) {
            fugas.push(`campo prohibido en la salida: "${campo}"`);
        }
    }

    for (const cadena of cadenasProhibidas) {
        const limpia = String(cadena).trim();
        if (!limpia) continue;
        if (texto.toLowerCase().includes(limpia.toLowerCase())) {
            fugas.push(`cadena prohibida en la salida: "${limpia}"`);
        }
    }

    return fugas;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test test/build/guard.test.js`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/build/guard.js test/build/guard.test.js
git commit -m "feat: guard que detecta fugas de datos sensibles en la salida"
```

---

## Task 8: Build a `dist/` (`src/build/index.js`)

**Files:**
- Create: `src/build/index.js`

**Interfaces:**
- Consumes: `aPublicoLegado` de `src/lib/contract.js`, `buscarFugas` de `src/build/guard.js`
- Produces: el directorio `dist/` listo para desplegar

- [ ] **Step 1: Escribir el build**

Crear `src/build/index.js`:

```javascript
import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, statSync } from 'node:fs';
import { aPublicoLegado } from '../lib/contract.js';
import { buscarFugas } from './guard.js';

const SALIDA = 'dist';
const ESTATICOS = ['index.html', 'index.css', 'app.js', 'robots.txt', 'sitemap.xml'];

const baseImagenes = process.env.SUPPLIER_IMG_BASE;
if (!baseImagenes) {
    console.error('❌ Falta la variable de entorno SUPPLIER_IMG_BASE.');
    console.error('   Definila en tu archivo .env local o como secreto del CI.');
    process.exit(1);
}

const catalogo = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const publicos = catalogo
    .map((registro) => aPublicoLegado(registro, baseImagenes))
    .filter((registro) => registro !== null);

rmSync(SALIDA, { recursive: true, force: true });
mkdirSync(SALIDA, { recursive: true });

for (const archivo of ESTATICOS) {
    cpSync(archivo, `${SALIDA}/${archivo}`);
}
cpSync('assets', `${SALIDA}/assets`, { recursive: true });

const contenido =
    '// Catálogo público de AXTECH. Generado por src/build/index.js — no editar a mano.\n' +
    'const PRODUCTS =\n' +
    JSON.stringify(publicos) +
    ';\n';
writeFileSync(`${SALIDA}/products.js`, contenido, 'utf8');

// El guard corre sobre la salida real.
//
// En esta fase NO se verifica el dominio del proveedor: las imágenes todavía
// se sirven desde su sitio, así que su host aparece necesariamente en
// dist/products.js. Esa verificación se activa en la Fase 1, cuando las
// imágenes pasen a Cloudflare R2 (§4.3 del spec).
const aRevisar = [`${SALIDA}/products.js`, `${SALIDA}/index.html`, `${SALIDA}/app.js`];
const fugas = [];
for (const archivo of aRevisar) {
    const encontradas = buscarFugas(readFileSync(archivo, 'utf8'));
    fugas.push(...encontradas.map((f) => `${archivo}: ${f}`));
}

if (fugas.length > 0) {
    console.error('❌ El build encontró fugas de información sensible:');
    for (const fuga of fugas) console.error(`   - ${fuga}`);
    process.exit(1);
}

const bytes = statSync(`${SALIDA}/products.js`).size;
console.log(`✅ Build completo: ${publicos.length} productos publicados.`);
console.log(`   dist/products.js — ${(bytes / 1024 / 1024).toFixed(2)} MB`);
```

- [ ] **Step 2: Preparar el entorno local**

Crear `C:\Page\.claude\worktrees\axtech-overhaul\.env` (no se versiona) con la
base real de imágenes del proveedor. El valor sale del campo `image` de
`products.js`: la parte anterior a `/IMG_`.

```
SUPPLIER_IMG_BASE=https://<host-del-proveedor>/produtos_img/v
```

- [ ] **Step 3: Correr el build**

Run: `node --env-file=.env src/build/index.js`
Expected: `✅ Build completo` con ~2.524 productos y `dist/products.js` de menos de 1 MB.

- [ ] **Step 4: Verificar que el guard efectivamente bloquea**

Un guard que nunca se vio fallar no es un guard. Prueba deliberada:

1. En `src/lib/contract.js`, agregar temporalmente `pyg_orig: 123456,` al objeto
   que devuelve `aPublicoLegado`.
2. Run: `node --env-file=.env src/build/index.js`
   Expected: **FALLA** con `campo prohibido en la salida: "pyg_orig"` y código
   de salida distinto de 0.
3. Revertir el cambio en `src/lib/contract.js`.
4. Run: `node --env-file=.env src/build/index.js`
   Expected: vuelve a completar correctamente.

- [ ] **Step 5: Verificar el sitio localmente**

Run: `npx --yes serve dist -l 4173`

Abrir `http://localhost:4173` y confirmar: el catálogo carga, la búsqueda
funciona, los filtros de categoría funcionan, el carrito funciona, el modal de
producto abre. Ningún producto debe mostrar "Bajo Consulta".

- [ ] **Step 6: Commit**

```bash
git add src/build/index.js
git commit -m "feat: build que genera dist/ con guard de fugas"
```

---

## Task 9: Adaptar `app.js` e `index.html`

`ref` y `title_orig` ya no existen en el catálogo público. `app.js` los usa solo
para armar el texto de búsqueda. Si no se corrige, `p.ref` queda `undefined` y
se interpola como la cadena `"undefined"` en el índice — con lo que buscar
"undefined" devolvería todo el catálogo.

**Files:**
- Modify: `app.js:338`, `app.js:341`, `app.js:344`, `app.js:1935`
- Modify: `index.html:27-36`

**Interfaces:**
- Consumes: `dist/products.js` generado en Task 8
- Produces: nada para tareas posteriores

- [ ] **Step 1: Quitar `title_orig` y `ref` del texto de búsqueda principal**

En `app.js`, eliminar la línea 338:

```javascript
                const titleOrigLower = (p.title_orig || '').toLowerCase();
```

Y reemplazar la línea 344 por:

```javascript
                    ? `${titleLower} ${brandLower} ${categoryLower} ${specsLower}`
```

- [ ] **Step 2: Quitar `ref` del texto de búsqueda de las sugerencias**

En `app.js`, reemplazar la línea 1935 por:

```javascript
            const textToSearch = `${p.title} ${p.brand} ${p.category}`.toLowerCase();
```

- [ ] **Step 3: Quitar los scripts de Vercel de `index.html`**

Eliminar el bloque completo de las líneas 27 a 36 (los dos `<script>` inline y
los dos `<script defer src="/_vercel/...">`). Cloudflare Web Analytics se agrega
en la Fase 1; en esta fase el sitio queda sin analítica por unos días.

- [ ] **Step 4: Reconstruir y verificar la búsqueda**

Run: `node --env-file=.env src/build/index.js`

Abrir el sitio local y verificar:
- Buscar `undefined` → **no** debe devolver resultados.
- Buscar `rtx` → devuelve tarjetas de video.
- Buscar `ssd kingston` → exige que ambas palabras coincidan.

- [ ] **Step 5: Commit**

```bash
git add app.js index.html
git commit -m "fix: quitar ref y title_orig del indice de busqueda del cliente"
```

---

## Task 10: Limpieza del repositorio y documentación única

**Files:**
- Delete: `historia_de_conversacion.md`, `REGLAS_PROYECTO_AXTECH.md`, `.agents/`, `products.js`, y 31 archivos de `assets/`
- Create: `AGENTS.md`
- Modify: `CLAUDE.md`

**Interfaces:**
- Consumes: nada
- Produces: nada

- [ ] **Step 1: Borrar el peso muerto**

`products.js` ya no es la fuente de verdad: lo reemplazó `data/catalog.json`.
`.agents/` contiene skills que documentan reglas obsoletas (el margen fijo de
+100.000) y se rehacen en la Fase 4.

```bash
git rm -r --quiet historia_de_conversacion.md REGLAS_PROYECTO_AXTECH.md .agents products.js
```

- [ ] **Step 2: Borrar los assets sin usar**

Solo se referencian `logo.jpg`, `favicon.ico` y `favicon_centered.png`
(verificado con grep sobre `index.html`, `index.css` y `app.js`).

```bash
cd assets && ls | grep -vE '^(logo\.jpg|favicon\.ico|favicon_centered\.png)$' | xargs git rm --quiet && cd ..
ls assets
```
Expected: exactamente 3 archivos.

- [ ] **Step 3: Escribir `AGENTS.md` como fuente de verdad única**

Crear `AGENTS.md`:

```markdown
# AXTECH — Reglas del Proyecto

Fuente de verdad única. Si algo de este documento contradice al código, **el
código gana** y este documento se corrige.

## Principio rector

Las reglas numéricas no viven en prosa. Viven en código, con tests:

| Regla | Dónde vive | Tests |
|---|---|---|
| Precios y márgenes | `src/lib/pricing.js` + `config/pricing.config.json` | `test/lib/pricing.test.js` |
| Categorías y marcas | `src/lib/taxonomy.js` | `test/lib/taxonomy.test.js` |
| Traducciones PT→ES | `src/lib/normalize.js` | `test/lib/normalize.test.js` |
| Campos públicos permitidos | `src/lib/contract.js` | `test/lib/contract.test.js` |

Este documento explica el *porqué*. Nunca duplica los valores.

## Reglas que no se negocian

1. **Ningún dato de costo, margen o proveedor sale al repositorio ni a `dist/`.**
   Verificado por `src/build/guard.js`; el build falla si aparece alguno.
   Campos prohibidos: ver `CAMPOS_PROHIBIDOS` en `src/lib/contract.js`.
2. **La proyección pública es una whitelist**, no una lista de exclusiones.
   Un campo nuevo en el catálogo no se publica salvo que se agregue
   explícitamente en `src/lib/contract.js`.
3. **Nunca mostrar productos sin imagen real** ni con el placeholder del
   proveedor (MD5 `709f820266febfe1c9c5fe7456a7499e`).
4. **Título del sitio**, exacto: `AXTECH | Tu Tienda de Tecnología y Hardware`.
   Sin sufijos de país.
5. **Los modelos de hardware se conservan íntegros** en los títulos:
   `RTX 4070`, `RX 7600`, `Ryzen 7 7800X3D`, `i7-14700K`.
6. **Nunca mencionar públicamente al proveedor** ni enlazar a su sitio.

## Negocio

- **Tienda**: AXTECH — 100% online, sin local físico.
- **WhatsApp**: `595976914662`
- **Instagram**: `@axtech_py`
- **Cierre de ventas**: por WhatsApp. No hay pago en línea.
- **Mensaje al consultar un producto**:
  ```
  Hola, quisiera consultar sobre el producto: [Título]
  Precio: [Precio]
  Link / Imagen: [URL de la imagen]
  ```

## Arquitectura

```
data/catalog.json   fuente de verdad (sin costos, sin proveedor)
       ↓ src/build
dist/               lo único que se despliega
```

- **Stack**: HTML5, CSS3 vanilla, JavaScript ES6+ vanilla. Sin frameworks.
- **Sin dependencias de producción.** Tests con `node:test`.
- **Hosting**: Cloudflare Pages. Imágenes en Cloudflare R2.
- **Node**: ≥ 20.

## Comandos

```bash
npm test                                  # Tests
node --env-file=.env src/build/index.js   # Build a dist/
```

## Flujo de trabajo

- Se trabaja en ramas, nunca directo en `main`.
- Cada PR debe pasar CI: tests + build + guard de fugas.
- Los secretos (proveedor, márgenes, credenciales) van en GitHub Secrets y
  en un `.env` local. Nunca en el repositorio ni en un chat.

## Documento de diseño

`docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md`
```

- [ ] **Step 4: Reducir `CLAUDE.md` a un stub**

Reemplazar todo el contenido de `CLAUDE.md` por:

```markdown
# AXTECH

Las reglas del proyecto viven en **[AGENTS.md](./AGENTS.md)**.

Este archivo existe solo para que Claude Code encuentre el camino. No agregues
reglas acá: se desincronizarían.
```

- [ ] **Step 5: Verificar que el build sigue funcionando tras la limpieza**

Run: `npm test && node --env-file=.env src/build/index.js`
Expected: todos los tests pasan y el build completa.

- [ ] **Step 6: Verificar cuánto se redujo el repositorio**

Run: `du -sh assets && git count-objects -vH | grep size-pack`

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: documentacion unica en AGENTS.md y limpieza del repositorio"
```

---

## Task 11: Pausar el cron y agregar CI

**Files:**
- Modify: `.github/workflows/daily_sync.yml`
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: `npm test` y `npm run build` de Task 1
- Produces: nada

- [ ] **Step 1: Pausar el cron nocturno**

En `.github/workflows/daily_sync.yml`, comentar el bloque `schedule` y dejar
`workflow_dispatch`, para poder correrlo manualmente si hiciera falta:

```yaml
on:
  # PAUSADO durante la refactorización (Fases 0-3).
  # Se reactiva en la Fase 4 con el sync reescrito.
  # schedule:
  #   - cron: '0 7 * * *'
  workflow_dispatch:
```

- [ ] **Step 2: Crear el workflow de CI**

Crear `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  verificar:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '24'

      - name: Tests
        run: npm test

      - name: Build
        run: node src/build/index.js
        env:
          SUPPLIER_IMG_BASE: ${{ secrets.SUPPLIER_IMG_BASE }}

      - name: Verificar que no hay datos sensibles en el repositorio
        run: |
          if grep -rEl '"(pyg_orig|usd|brl|orig_url|title_orig)":' \
               --include='*.json' --include='*.js' \
               --exclude-dir=node_modules --exclude-dir=dist \
               --exclude='*.test.js' --exclude='sync-legacy.cjs' . ; then
            echo "❌ Se encontraron campos sensibles en archivos versionados."
            exit 1
          fi
          echo "✅ Sin campos sensibles en el repositorio."
```

- [ ] **Step 3: Verificar la exclusión del grep localmente**

El guard del CI excluye `*.test.js` (los tests contienen campos sensibles a
propósito, para probar que se bloquean) y `sync-legacy.cjs` (código legado
congelado hasta la Fase 4).

Run:
```bash
grep -rEl '"(pyg_orig|usd|brl|orig_url|title_orig)":' \
  --include='*.json' --include='*.js' \
  --exclude-dir=node_modules --exclude-dir=dist \
  --exclude='*.test.js' --exclude='sync-legacy.cjs' .
```
Expected: sin salida.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/
git commit -m "ci: pausar el sync nocturno y agregar verificacion en PR"
```

---

## Task 12: Migración a Cloudflare Pages y repositorio limpio

Esta tarea requiere credenciales y acciones en interfaces web. **Requisito
previo**: los tokens nuevos deben estar cargados en `.env` (local) y en GitHub
Secrets — nunca pegados en un chat.

**Files:**
- Create: `wrangler.toml`

**Interfaces:**
- Consumes: `dist/` generado por Task 8
- Produces: el sitio publicado en Cloudflare Pages

- [ ] **Step 1: Confirmar los requisitos previos**

Verificar antes de tocar nada:
- Los tokens viejos (`ghp_ZXCA…`, `cfat_WoDM…`) fueron revocados.
- Existe `.env` local con `SUPPLIER_IMG_BASE`, `CLOUDFLARE_API_TOKEN` y `CLOUDFLARE_ACCOUNT_ID`.
- El secreto `SUPPLIER_IMG_BASE` está cargado en GitHub Secrets.

- [ ] **Step 2: Crear `wrangler.toml`**

```toml
name = "axtech"
compatibility_date = "2026-08-15"
pages_build_output_dir = "dist"
```

- [ ] **Step 3: Publicar un preview desde la máquina local**

Run:
```bash
node --env-file=.env src/build/index.js
npx --yes wrangler@latest pages deploy dist --project-name=axtech --branch=preview
```
Expected: se imprime una URL de preview.

- [ ] **Step 4: Verificar el preview**

Abrir la URL y confirmar contra el sitio actual (`axtech-py.vercel.app`):
catálogo, búsqueda, filtros por categoría, carrito, modal de producto y enlaces
de WhatsApp. Comprobar en las herramientas de desarrollo que `products.js` pesa
menos de 1 MB y que **no aparece ninguna referencia a `pyg_orig` ni al dominio
del proveedor** en la respuesta.

- [ ] **Step 5: Recrear el repositorio de GitHub sin el historial contaminado**

El historial actual contiene meses de costos. Reescribirlo no es confiable
(GitHub cachea objetos, los forks conservan copias), y son ~30 commits
automáticos sin valor.

Se trabajó en el worktree `C:\Page\.claude\worktrees\axtech-overhaul`. Hay que
consolidar en `C:\Page` antes de recrear el repositorio.

1. Fusionar la rama en `main` y salir del worktree:
   ```bash
   cd /c/Page
   git merge feat/axtech-overhaul --no-ff -m "feat: fase 0 completa"
   git worktree remove .claude/worktrees/axtech-overhaul
   ```
2. En GitHub, renombrar el repositorio actual a `axtech-legacy` y marcarlo como
   privado (respaldo temporal; borrar en un mes, una vez confirmado que todo
   funciona).
3. Crear un repositorio nuevo `godoytech1/axtech`, público, vacío — sin README,
   sin `.gitignore`, sin licencia.
4. Desde `C:\Page`, descartar el historial y publicar el estado actual:
   ```bash
   cd /c/Page
   rm -rf .git
   git init
   git add -A
   git status --short | head -30    # revisar que no entre nada indebido
   git commit -m "chore: estado inicial limpio, sin datos sensibles en el historial"
   git branch -M main
   git remote add origin https://github.com/godoytech1/axtech.git
   git push -u origin main
   ```
5. Verificar que el historial nuevo está limpio:
   ```bash
   git log --oneline           # debe mostrar exactamente 1 commit
   git grep -c "pyg_orig" $(git rev-list --all) -- '*.json' '*.js' || echo "limpio"
   ```
6. Volver a cargar los GitHub Secrets en el repositorio nuevo
   (`SUPPLIER_IMG_BASE` como mínimo).

- [ ] **Step 6: Conectar Cloudflare Pages al repositorio nuevo**

En el panel de Cloudflare: Workers & Pages → Create → Pages → Connect to Git →
`godoytech1/axtech`.
- Build command: `node src/build/index.js`
- Build output directory: `dist`
- Variable de entorno: `SUPPLIER_IMG_BASE`

- [ ] **Step 7: Verificar producción y apagar Vercel**

Confirmar que el sitio en `axtech.pages.dev` funciona igual que el anterior.
Recién entonces, en Vercel, pausar el proyecto para que no queden dos sitios
publicados con contenidos distintos.

- [ ] **Step 8: Commit**

```bash
git add wrangler.toml
git commit -m "chore: configuracion de Cloudflare Pages"
```

---

## Criterio de aceptación de la Fase 0

Antes de dar la fase por terminada, verificar todo esto:

- [ ] `npm test` pasa por completo.
- [ ] `grep -rE '"(pyg_orig|usd|brl|orig_url|title_orig)":' data/ dist/` no devuelve nada.
- [ ] El dominio del proveedor no aparece en ningún archivo versionado.
- [ ] `dist/products.js` pesa menos de 1 MB (contra 10,4 MB antes).
- [ ] El sitio en Cloudflare Pages funciona igual que el anterior: catálogo, búsqueda, filtros, carrito, modal y WhatsApp.
- [ ] Buscar `undefined` no devuelve resultados.
- [ ] El cron nocturno está pausado.
- [ ] El repositorio nuevo no tiene costos en ningún commit de su historial.
- [ ] Los tokens viejos están revocados.
- [ ] `assets/` tiene exactamente 3 archivos.
- [ ] `AGENTS.md` es el único documento de reglas; `CLAUDE.md` es un stub.
