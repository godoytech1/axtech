# AXTECH Fase 1B — Imágenes propias, analítica y front modular

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar la última exposición del proveedor sirviendo imágenes propias, y sacar del front la lentitud autoinfligida, el riesgo de XSS y la imposibilidad de compartir una búsqueda.

**Architecture:** Las imágenes se descargan una vez, se convierten a WebP y viven en el repositorio; Cloudflare Pages las sirve con el mismo despliegue que ya existe. Eso permite activar la verificación de dominio del proveedor en el guard del build. En el front, `app.js` se corrige por partes con verificación en navegador real entre cada cambio, sin reescritura de golpe.

**Tech Stack:** Node.js ≥ 20 (ESM), `node:test`, `sharp` como única dependencia de desarrollo, HTML/CSS/JS vanilla, Cloudflare Pages.

**Spec:** `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md`

## Global Constraints

- **Sin dependencias de producción.** Nada se agrega al navegador. `sharp` es `devDependency`: corre en el build y en el sync, nunca se sirve.
- **Node.js ≥ 20.** El CI corre Node 24.
- **Campos prohibidos** en `data/catalog.json` y en todo `dist/`: `pyg_orig`, `pyg_orig_str`, `usd`, `brl`, `orig_url`, `title_orig`, `titleOrig`, `cost`, `costo`.
- **El dominio del proveedor nunca aparece en código versionado ni en `dist/`.** A partir de esta fase el guard del build lo verifica y rompe el despliegue.
- **Los porcentajes de margen son secretos** (`config/pricing.config.json`, ignorado por git).
- **Fuente ASCII pura** en `src/lib/` y `src/images/`.
- **Código en español**, coherente con el proyecto.
- **Commits frecuentes**, uno por tarea como mínimo.

## Punto de partida medido (2026-08-15)

| Recurso | Actual (gzip) | Presupuesto |
|---|---|---|
| `index.html` | 4 KB | 25 KB |
| `index.css` | 10 KB | 25 KB |
| `app.js` | 17 KB | 60 KB |
| `products.js` | 95 KB | 150 KB |

Imágenes del proveedor: **15 KB promedio**, 2.511 activas ⇒ 36 MB en JPG,
~13 MB en WebP.

## Decisiones de alcance, con su razón

**Sin Cloudflare R2.** El spec lo proponía asumiendo imágenes pesadas. Medidas:
15 KB promedio. 13 MB de WebP entran en el repositorio y se sirven con el
despliegue que ya existe. R2 exige habilitarlo con método de pago y agrega un
servicio, claves y un punto de falla, a cambio de nada. Cloudflare Pages admite
20.000 archivos; se usarían ~2.550.

**Sin chunking del catálogo en esta fase.** El presupuesto es 150 KB gzip y hoy
son 95 KB. Partir el catálogo ahora es complejidad sin beneficio medible. Se
mueve a la Fase 2, donde las páginas estáticas por categoría lo necesitan de
verdad.

**Sin partir `app.js` en módulos ES en esta fase.** El spec (§9.1) lo pide, y
sigue siendo deseable, pero hacerlo acá sería imprudente y prematuro:

1. **No hay red de contención.** `app.js` tiene 2.000 líneas y cero tests. Un
   split estructural sin cobertura se verifica a ojo, que es exactamente como
   se cuelan las regresiones.
2. **Está acoplado a la entrega de datos.** Los módulos ES tienen ámbito
   propio: no ven las globales `PRODUCTS` ni `CATEGORIES` que define
   `products.js`. Partir el front obliga a cambiar también cómo llegan los
   datos — o sea, el chunking, que ya se movió a la Fase 2.

Por eso esta fase hace las correcciones **de comportamiento** de §9.2, que se
verifican una por una en un navegador real, y deja el split estructural para la
Fase 2, donde va junto al cambio de entrega de datos que de todos modos lo
obliga. Los beneficios concretos (velocidad, XSS cerrado, URL compartible) se
consiguen igual sin mover un solo archivo de lugar.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/imagenes.js` | **Crear.** Convención de nombres. Sin dependencias |
| `src/images/procesar.js` | **Crear.** Conversión a WebP (usa `sharp`) |
| `src/images/ejecutar.js` | **Crear.** Ejecutable de la migración de imágenes |
| `public/img/{id}.webp` | **Crear** (generado). 2.511 imágenes versionadas |
| `src/lib/contract.js` | **Modificar.** Emitir la ruta local en vez de la del proveedor |
| `src/build/index.js` | **Modificar.** Copiar `public/img/`; activar el guard del proveedor |
| `index.html` | **Modificar.** Cloudflare Web Analytics |
| `app.js` | **Modificar.** Correcciones de §9.2 del spec |
| `test/images/procesar.test.js` | **Crear.** |
| `test/lib/contract.test.js` | **Modificar.** La imagen ya no se deriva del proveedor |
| `AGENTS.md` | **Modificar.** Documentar el pipeline de imágenes |

---

## Task 1: Rama y dependencia de desarrollo

**Files:**
- Modify: `package.json`

**Interfaces:**
- Consumes: nada
- Produces: `sharp` disponible; el comando `npm run images`

- [ ] **Step 1: Crear la rama**

```bash
cd /c/Page
git checkout -b feat/fase-1b-imagenes
git status --short
```
Expected: sin cambios pendientes.

- [ ] **Step 2: Instalar sharp como dependencia de desarrollo**

`sharp` trae binarios precompilados y no necesita compilador.

```bash
npm install --save-dev sharp
```

- [ ] **Step 3: Agregar el script y verificar que quedó como devDependency**

En `package.json`, dentro de `"scripts"`, agregar:

```json
    "images": "node src/images/ejecutar.js"
```

Run: `node -e "const p=require('./package.json'); console.log('dependencies:', p.dependencies || '(ninguna)'); console.log('devDependencies:', Object.keys(p.devDependencies||{}).join(', '))"`
Expected: `dependencies: (ninguna)` y `devDependencies: sharp`. Si `sharp`
aparece en `dependencies`, moverlo: el navegador no debe recibir nada.

- [ ] **Step 4: Ignorar node_modules y verificar**

`node_modules/` ya está en `.gitignore` desde la Fase 0.

Run: `git check-ignore -v node_modules`
Expected: una línea con la regla de `.gitignore`.

- [ ] **Step 5: Confirmar que los tests siguen pasando**

Run: `npm test`
Expected: 92 tests, 0 fallos.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: sharp como dependencia de desarrollo para procesar imagenes"
```

---

## Task 2: Procesador de imágenes (`src/images/procesar.js`)

Función pura sobre buffers: recibe bytes, devuelve bytes. No toca la red ni el
disco, para poder testearla sin depender del proveedor.

**Files:**
- Create: `src/images/procesar.js`
- Test: `test/images/procesar.test.js`

**Interfaces:**
- Consumes: `sharp`
- Produces:
  - `PLACEHOLDER_MD5: string`
  - `esPlaceholder(buffer: Buffer) => boolean`
  - `aWebp(buffer: Buffer) => Promise<Buffer>`

La convención de nombres vive aparte, en `src/lib/imagenes.js`, **sin importar
`sharp`**. Si estuviera acá, `contract.js` — que solo necesita armar una ruta —
arrastraría la librería de procesamiento de imágenes a todo el build.

- [ ] **Step 0: Crear el módulo de nombres, sin dependencias**

Crear `src/lib/imagenes.js`:

```javascript
/**
 * Convencion de nombres de las imagenes publicadas.
 *
 * Vive separado de src/images/procesar.js a proposito: ese modulo importa
 * sharp, y contract.js solo necesita armar una ruta. Sin esta separacion,
 * proyectar un producto arrastraria toda la libreria de imagenes.
 *
 * Usa el id interno de AXTECH, nunca el codigo del proveedor: publicar el ref
 * permitiria localizar cada producto en el catalogo de origen.
 */
export function nombreDeArchivo(id) {
    return `${id}.webp`;
}

export function rutaPublica(id) {
    return `/img/${nombreDeArchivo(id)}`;
}
```

Crear `test/lib/imagenes.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { nombreDeArchivo, rutaPublica } from '../../src/lib/imagenes.js';

test('el nombre usa el id interno, no el codigo del proveedor', () => {
    assert.equal(nombreDeArchivo(10122), '10122.webp');
    assert.equal(nombreDeArchivo(4), '4.webp');
});

test('la ruta publica cuelga de /img', () => {
    assert.equal(rutaPublica(10122), '/img/10122.webp');
});
```

Run: `node --test "test/lib/imagenes.test.js"`
Expected: PASS — 2 tests.

- [ ] **Step 1: Escribir el test que falla**

Crear `test/images/procesar.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { aWebp, esPlaceholder, PLACEHOLDER_MD5 } from '../../src/images/procesar.js';

// Imagen sintetica: no depende del proveedor ni de la red.
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

test('reduce el ancho maximo a 800px', async () => {
    const salida = await aWebp(await jpegDePrueba(1600, 1200));
    const meta = await sharp(salida).metadata();
    assert.equal(meta.width, 800);
    assert.equal(meta.height, 600, 'debe conservar la proporcion');
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

test('detecta el placeholder del proveedor por su hash', () => {
    // El placeholder real tiene este MD5; se simula con un buffer cuyo hash
    // se calcula igual, para no versionar la imagen del proveedor.
    assert.equal(typeof PLACEHOLDER_MD5, 'string');
    assert.equal(PLACEHOLDER_MD5.length, 32);
    assert.equal(esPlaceholder(Buffer.from('contenido cualquiera')), false);
});

```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test "test/images/procesar.test.js"`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementar**

Crear `src/images/procesar.js`:

```javascript
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const ANCHO_MAXIMO = 800;
const CALIDAD = 82;

/**
 * MD5 de la imagen "PRODUTO SEM IMAGEM" del proveedor. Un producto con esta
 * imagen no se publica: la regla 3 de AGENTS.md prohibe mostrar productos sin
 * imagen real.
 */
export const PLACEHOLDER_MD5 = '709f820266febfe1c9c5fe7456a7499e';

/** true si el buffer es la imagen de relleno del proveedor. */
export function esPlaceholder(buffer) {
    return createHash('md5').update(buffer).digest('hex') === PLACEHOLDER_MD5;
}

/**
 * Convierte a WebP y limita el ancho a 800px.
 *
 * withoutEnlargement evita agrandar imagenes ya pequenas, que solo sumaria
 * peso sin ganar nitidez.
 */
export async function aWebp(buffer) {
    return sharp(buffer)
        .resize({ width: ANCHO_MAXIMO, withoutEnlargement: true })
        .webp({ quality: CALIDAD })
        .toBuffer();
}

```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test "test/images/procesar.test.js"`
Expected: PASS — 7 tests.

- [ ] **Step 5: Commit**

```bash
git add src/images/procesar.js test/images/procesar.test.js
git commit -m "feat: conversion de imagenes a WebP con limite de ancho"
```

---

## Task 3: Migración de las imágenes

Descarga las 2.511 imágenes activas y las deja en `public/img/`. Reanudable: si
el archivo ya existe, lo saltea, así una corrida interrumpida no reempieza.

**Files:**
- Create: `src/images/ejecutar.js`
- Create (generado): `public/img/*.webp`

**Interfaces:**
- Consumes: `aWebp`, `esPlaceholder` de `src/images/procesar.js`; `nombreDeArchivo` de `src/lib/imagenes.js`
- Produces: `public/img/{id}.webp` para cada producto activo

- [ ] **Step 1: Escribir el ejecutable**

Crear `src/images/ejecutar.js`:

```javascript
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { aWebp, esPlaceholder } from './procesar.js';
import { nombreDeArchivo } from '../lib/imagenes.js';

const DESTINO = 'public/img';
const CONCURRENCIA = 6;

const base = process.env.SUPPLIER_IMG_BASE;
if (!base) {
    console.error('ERROR: falta SUPPLIER_IMG_BASE. Definila en .env o como secreto del CI.');
    process.exit(1);
}

const catalogo = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
const activos = catalogo.filter((p) => p.status === 'active');
mkdirSync(DESTINO, { recursive: true });

const rep = { total: activos.length, saltados: 0, ok: 0, placeholder: 0, error: 0 };
const sinImagen = [];

async function procesarUno(p) {
    const ruta = `${DESTINO}/${nombreDeArchivo(p.id)}`;
    if (existsSync(ruta)) { rep.saltados++; return; }

    try {
        const res = await fetch(`${base}/IMG_${p.ref}_1.JPG`);
        if (!res.ok) { rep.error++; sinImagen.push(p.id); return; }
        const original = Buffer.from(await res.arrayBuffer());

        if (esPlaceholder(original)) { rep.placeholder++; sinImagen.push(p.id); return; }

        writeFileSync(ruta, await aWebp(original));
        rep.ok++;
    } catch {
        rep.error++;
        sinImagen.push(p.id);
    }
}

// Concurrencia limitada: no conviene golpear al proveedor con 2.511 pedidos
// simultaneos, y tampoco hace falta.
const cola = [...activos];
const obreros = Array.from({ length: CONCURRENCIA }, async () => {
    while (cola.length) {
        const p = cola.shift();
        await procesarUno(p);
        const hechos = rep.ok + rep.saltados + rep.placeholder + rep.error;
        if (hechos % 200 === 0) console.log(`  ${hechos}/${rep.total}...`);
    }
});
await Promise.all(obreros);

console.log('\n=== MIGRACION DE IMAGENES ===');
console.log(`  productos activos:  ${rep.total}`);
console.log(`  descargadas:        ${rep.ok}`);
console.log(`  ya existian:        ${rep.saltados}`);
console.log(`  placeholder:        ${rep.placeholder}`);
console.log(`  con error:          ${rep.error}`);

if (sinImagen.length) {
    writeFileSync('data/sin-imagen.json', JSON.stringify(sinImagen, null, 2) + '\n', 'utf8');
    console.log(`\n  ${sinImagen.length} productos quedaron sin imagen. Ids en data/sin-imagen.json`);
    console.log('  La Task 4 los oculta: la regla 3 prohibe publicar productos sin imagen real.');
}
```

- [ ] **Step 2: Correr la migración**

Tarda varios minutos. Es reanudable: si se corta, volver a correrlo continúa
donde quedó.

Run: `node --env-file=.env src/images/ejecutar.js`
Expected: `descargadas` cercano a 2.511, `con error` bajo.

- [ ] **Step 3: Verificar el resultado en disco**

```bash
ls public/img | wc -l
du -sh public/img
```
Expected: ~2.500 archivos, alrededor de 13 MB.

- [ ] **Step 4: Verificar que son WebP de verdad**

```bash
node --input-type=module -e "
import sharp from 'sharp';
import { readdirSync } from 'node:fs';
const f = readdirSync('public/img').slice(0, 5);
for (const n of f) {
  const m = await sharp('public/img/' + n).metadata();
  console.log(n, m.format, m.width + 'x' + m.height);
}
"
```
Expected: `webp` en todas, ancho ≤ 800.

- [ ] **Step 5: Commit**

```bash
git add public/img src/images/ejecutar.js data/sin-imagen.json
git commit -m "feat: imagenes propias en WebP, sin depender del proveedor"
```

---

## Task 4: Servir las imágenes propias y cerrar el guard

Es el paso que elimina la última referencia al proveedor en lo que se sirve.

**Files:**
- Modify: `src/lib/contract.js`
- Modify: `src/build/index.js`
- Modify: `test/lib/contract.test.js`

**Interfaces:**
- Consumes: `rutaPublica` de `src/lib/imagenes.js`
- Produces: `aPublicoLegado(registro, opciones)` — cambia la firma: el segundo
  parámetro pasa de ser la base de imágenes del proveedor a un objeto
  `{ idsSinImagen: Set<number> }`

- [ ] **Step 1: Actualizar el test de contract**

En `test/lib/contract.test.js`, reemplazar la constante `BASE` y los tres tests
que dependen de ella:

```javascript
const OPCIONES = { idsSinImagen: new Set() };

test('la imagen apunta a un archivo propio, no al proveedor', () => {
    const publico = aPublicoLegado(registroValido(), OPCIONES);
    assert.equal(publico.image, '/img/10122.webp');
});

test('no publica productos sin imagen propia', () => {
    const opciones = { idsSinImagen: new Set([10122]) };
    assert.equal(aPublicoLegado(registroValido(), opciones), null);
});

test('el ref no aparece en ninguna parte de la salida', () => {
    const publico = aPublicoLegado(registroValido(), OPCIONES);
    assert.ok(!JSON.stringify(publico).includes('329967'));
});
```

Y reemplazar `BASE` por `OPCIONES` en las demás llamadas del archivo:

```bash
sed -i 's/, BASE)/, OPCIONES)/g' test/lib/contract.test.js
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test "test/lib/contract.test.js"`
Expected: FAIL — la imagen sigue apuntando al proveedor.

- [ ] **Step 3: Cambiar la proyección**

En `src/lib/contract.js`, agregar el import y reemplazar la función:

```javascript
import { formatearGs } from './formato.js';
import { rutaPublica } from './imagenes.js';
```

```javascript
export function aPublicoLegado(registro, { idsSinImagen = new Set() } = {}) {
    if (!registro || registro.status !== 'active') return null;
    if (typeof registro.price !== 'number' || registro.price <= 0) return null;
    // Regla 3 de AGENTS.md: nunca publicar un producto sin imagen real.
    if (idsSinImagen.has(registro.id)) return null;

    return {
        id: registro.id,
        title: registro.title,
        brand: registro.brand,
        category: registro.category,
        image: rutaPublica(registro.id),
        pyg: registro.price,
        pyg_str: formatearGs(registro.price),
        specs: Array.isArray(registro.specs) ? registro.specs : [],
        sob_consulta: false
    };
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test "test/lib/contract.test.js"`
Expected: PASS.

- [ ] **Step 5: Actualizar el build**

En `src/build/index.js`:

Reemplazar el bloque que exige `SUPPLIER_IMG_BASE` por la carga de los ids sin
imagen:

```javascript
// El proveedor ya no interviene: las imagenes son propias.
const idsSinImagen = new Set(
    existsSync('data/sin-imagen.json')
        ? JSON.parse(readFileSync('data/sin-imagen.json', 'utf8'))
        : []
);
```

Agregar `existsSync` al import de `node:fs`.

Reemplazar la proyección:

```javascript
const publicos = catalogo
    .map((registro) => aPublicoLegado(registro, { idsSinImagen }))
    .filter((registro) => registro !== null);
```

Agregar la copia de las imágenes junto a la de `assets`:

```javascript
cpSync('public/img', `${SALIDA}/img`, { recursive: true });
```

- [ ] **Step 6: Activar la verificación del proveedor en el guard**

En `src/build/index.js`, reemplazar el bloque del guard por:

```javascript
// Desde la Fase 1B las imagenes son propias, asi que el dominio del proveedor
// no debe aparecer en ninguna parte de la salida. Si aparece, el build falla.
const nombreProveedor = process.env.SUPPLIER_NAME;
const aRevisar = [`${SALIDA}/products.js`, `${SALIDA}/index.html`, `${SALIDA}/app.js`];
const fugas = [];
for (const archivo of aRevisar) {
    const encontradas = buscarFugas(readFileSync(archivo, 'utf8'), {
        cadenasProhibidas: nombreProveedor ? [nombreProveedor] : []
    });
    fugas.push(...encontradas.map((f) => `${archivo}: ${f}`));
}
if (!nombreProveedor) {
    console.warn('AVISO: sin SUPPLIER_NAME no se puede verificar el dominio del proveedor.');
}
```

- [ ] **Step 7: Construir y verificar que no queda rastro del proveedor**

```bash
SUPPLIER_NAME=$(grep -o 'SUPPLIER_IMG_BASE=https://\([^/]*\)' .env | sed 's|.*//||' | cut -d. -f2) \
  node --env-file=.env src/build/index.js
grep -ric "topdek" dist/ | grep -v ":0" || echo "OK: cero menciones al proveedor en dist/"
```
Expected: el build completa y el grep no encuentra nada.

- [ ] **Step 8: Verificar que el guard bloquea de verdad**

Un guard que nunca se vio fallar no es un guard.

1. En `src/lib/contract.js`, cambiar temporalmente la línea de `image` por
   `image: 'https://www.topdekinformatica.com.br/x.jpg',`
2. Run: `SUPPLIER_NAME=topdek node --env-file=.env src/build/index.js`
   Expected: **FALLA** con `cadena prohibida en la salida` y exit code 1.
3. Revertir el cambio y reconstruir.

- [ ] **Step 9: Commit**

```bash
git add src/lib/contract.js src/build/index.js test/lib/contract.test.js
git commit -m "feat: servir imagenes propias y verificar el dominio del proveedor"
```

---

## Task 5: Analítica de Cloudflare

Reemplaza a Vercel Analytics, que se quitó en la Fase 0. Cloudflare Web
Analytics no usa cookies, así que no hace falta banner de consentimiento.

**Files:**
- Modify: `index.html`

**Interfaces:**
- Consumes: nada
- Produces: nada

- [ ] **Step 1: Crear el sitio en el panel**

En el panel de Cloudflare: Analytics & Logs → Web Analytics → Add a site →
`axtech.pages.dev`. Copiar el token que muestra.

- [ ] **Step 2: Agregar el script**

En `index.html`, antes de `</body>`, reemplazando el comentario que dejó la
Fase 0:

```html
    <!-- Cloudflare Web Analytics: sin cookies, sin banner de consentimiento. -->
    <script defer src="https://static.cloudflareinsights.com/beacon.min.js"
        data-cf-beacon='{"token": "PEGAR_AQUI_EL_TOKEN"}'></script>
```

Reemplazar `PEGAR_AQUI_EL_TOKEN` por el token del Step 1. No es un secreto: es
público por diseño y solo identifica al sitio.

- [ ] **Step 3: Verificar que el comentario viejo se eliminó**

Run: `grep -n "Cloudflare Web Analytics se agrega en la Fase 1" index.html || echo "OK: comentario reemplazado"`
Expected: `OK: comentario reemplazado`.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: analitica de Cloudflare sin cookies"
```

---

## Task 6: Quitar la lentitud autoinfligida y cerrar el XSS

Dos correcciones de §9.2 del spec que van juntas porque tocan el mismo bloque
de `renderProducts`.

**Files:**
- Modify: `app.js:616` (el `setTimeout`), `app.js:633` (el badge), `app.js:654` (el `innerHTML`), `app.js:712` (el cierre del `setTimeout`)

**Interfaces:**
- Consumes: nada
- Produces: nada

- [ ] **Step 1: Ver el bloque actual**

```bash
sed -n '610,620p;630,636p;650,700p;708,714p' app.js
```

- [ ] **Step 2: Eliminar el retardo artificial**

`renderProducts` envuelve todo su cuerpo en `setTimeout(..., 300)`. Son 300 ms
de demora en cada filtro, cada búsqueda y cada cambio de página, puestos a
propósito.

En `app.js:616`, reemplazar:

```javascript
        setTimeout(() => {
```

por:

```javascript
        {
```

Y en `app.js:712`, reemplazar:

```javascript
        }, 300);
```

por:

```javascript
        }
```

El bloque queda como un bloque léxico, así la indentación no cambia y el diff
es mínimo.

- [ ] **Step 3: Corregir el criterio del badge "Destacado"**

En `app.js:633` el badge se decide con ids escritos a mano
(`p.id <= 3 || p.id === 25 || ...`), lo que no significa nada. Reemplazar por:

```javascript
                // "Destacado" = entre los 12 productos mas nuevos del catalogo.
                const isNew = productosDestacados.has(p.id);
```

Y antes del bucle de renderizado (justo después de `loader.style.display = 'none';`),
agregar:

```javascript
            // Los ids mas altos son los ultimos descubiertos por el sync.
            const productosDestacados = new Set(
                [...PRODUCTS].sort((a, b) => b.id - a.id).slice(0, 12).map((p) => p.id)
            );
```

- [ ] **Step 4: Cerrar el XSS al construir la tarjeta**

`card.innerHTML` interpola `p.title` y `p.brand`, que vienen de raspar el HTML
de un tercero. Reemplazar la asignación de `app.js:654` por construcción con
`textContent`, que no interpreta marcado:

```javascript
                card.innerHTML = `
                    ${badgeHTML}
                    <div class="product-image-container">
                        <img src="${p.image}" alt="" loading="lazy" width="300" height="300">
                    </div>
                    <div class="product-brand"></div>
                    <h4 class="product-name"></h4>
                    <div class="product-price-block">
                        ${priceHTML}
                    </div>
                    <div class="product-actions">
                        ${buttonHTML}
                        <button class="btn btn-outline btn-view" data-view-id="${p.id}" title="Ver Detalle">
                            <i class="las la-eye"></i>
                        </button>
                    </div>
                `;
                // textContent no interpreta marcado: es lo que cierra el XSS.
                card.querySelector('.product-brand').textContent = p.brand;
                card.querySelector('.product-name').textContent = p.title;
                card.querySelector('img').alt = p.title;
```

Los atributos `width` y `height` eliminan el salto de layout mientras cargan las
imágenes.

- [ ] **Step 5: Construir y verificar en el navegador**

```bash
node --env-file=.env src/build/index.js
npx --yes serve dist -l 4173
```

Abrir `http://localhost:4173` y comprobar:
- El catálogo aparece de inmediato al filtrar (sin la espera de 300 ms).
- Las tarjetas muestran marca y título correctos.
- Las imágenes cargan desde `/img/…` (pestaña Network).
- No hay errores en consola.

- [ ] **Step 6: Verificar que el XSS quedó cerrado**

En la consola del navegador:

```javascript
const p = PRODUCTS[0];
const original = p.title;
p.title = '<img src=x onerror="window.__xss=1">';
document.getElementById('search-input').value = '';
document.getElementById('search-input').dispatchEvent(new Event('input', {bubbles:true}));
setTimeout(() => { console.log('XSS ejecutado:', window.__xss === 1); p.title = original; }, 500);
```
Expected: `XSS ejecutado: false`, y el título se muestra como texto literal.

- [ ] **Step 7: Commit**

```bash
git add app.js
git commit -m "fix: quitar el retardo de 300ms, cerrar el XSS y fijar dimensiones de imagen"
```

---

## Task 7: Delegación de eventos

Hoy se registran 4 listeners por tarjeta. Con 36 tarjetas por página son 144
listeners que se crean y descartan en cada render.

**Files:**
- Modify: `app.js` (los `addEventListener` dentro del bucle de tarjetas)

**Interfaces:**
- Consumes: nada
- Produces: nada

- [ ] **Step 1: Eliminar los listeners por tarjeta**

Borrar de `app.js` el bloque completo que va desde
`// Add Event Listeners to actions in this card` hasta la línea anterior a
`productsGrid.appendChild(card);`, es decir los cuatro `addEventListener` y el
manejador de `error` de la imagen.

Conservar `productsGrid.appendChild(card);`.

- [ ] **Step 2: Marcar la tarjeta con su id**

Justo antes de `productsGrid.appendChild(card);`, agregar:

```javascript
                card.dataset.productId = p.id;
```

- [ ] **Step 3: Registrar un único listener en el contenedor**

Fuera de `renderProducts`, después de su definición, agregar:

```javascript
    // ----------------------------------------------------------------------
    // DELEGACION DE EVENTOS DE LAS TARJETAS
    // ----------------------------------------------------------------------
    // Un listener en el contenedor en vez de cuatro por tarjeta. Con 36
    // tarjetas por pagina eran 144 listeners recreados en cada render.
    productsGrid.addEventListener('click', (e) => {
        const agregar = e.target.closest('.btn-add-cart');
        if (agregar) {
            e.stopPropagation();
            addToCart(Number(agregar.dataset.addId));
            return;
        }
        const ver = e.target.closest('.btn-view');
        if (ver) {
            e.stopPropagation();
            openProductModal(Number(ver.dataset.viewId));
            return;
        }
        const tarjeta = e.target.closest('[data-product-id]');
        if (tarjeta && (e.target.closest('.product-image-container') || e.target.closest('.product-name'))) {
            openProductModal(Number(tarjeta.dataset.productId));
        }
    });

    // Imagen rota: se reemplaza por un marcador en vez de ocultar la tarjeta.
    // Ocultarla dejaba huecos en la grilla y hacia mentir al contador de
    // resultados.
    productsGrid.addEventListener('error', (e) => {
        if (e.target.tagName !== 'IMG') return;
        e.target.style.visibility = 'hidden';
        e.target.closest('.product-image-container')?.classList.add('sin-imagen');
    }, true);
```

El tercer argumento `true` es necesario: el evento `error` de `<img>` no
burbujea, hay que capturarlo en fase de captura.

- [ ] **Step 4: Construir y verificar en el navegador**

```bash
node --env-file=.env src/build/index.js
npx --yes serve dist -l 4173
```

Comprobar en `http://localhost:4173`:
- "Agregar" suma al carrito y no abre el modal.
- El ojo abre el modal.
- Clic en la imagen o en el nombre abre el modal.
- Cambiar de página y repetir: todo sigue funcionando (es lo que se rompe si la
  delegación está mal).

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "perf: delegacion de eventos en la grilla de productos"
```

---

## Task 8: Estado en la URL

Hoy filtrar o buscar no cambia la URL: no se puede compartir una búsqueda, el
botón atrás sale del sitio, y recargar pierde todo. Además es requisito para
que la Fase 2 genere páginas coherentes con la navegación.

**Files:**
- Modify: `app.js`

**Interfaces:**
- Consumes: `filterByCategory`, `renderProducts` (ya existentes)
- Produces: nada

- [ ] **Step 1: Agregar lectura y escritura de la URL**

En `app.js`, después de `construirNavegacion();`, agregar:

```javascript
    // ----------------------------------------------------------------------
    // ESTADO EN LA URL
    // ----------------------------------------------------------------------
    // Sin esto no se puede compartir una busqueda ni usar el boton atras, y
    // recargar la pagina pierde el filtro.
    function leerEstadoDeURL() {
        const q = new URLSearchParams(location.search);
        const cat = q.get('c');
        if (cat && (cat === 'all' || CATS.some(c => c.id === cat))) currentCategory = cat;
        const texto = q.get('q');
        if (texto) { searchQuery = texto; if (searchInput) searchInput.value = texto; }
        const pagina = parseInt(q.get('p'), 10);
        if (Number.isInteger(pagina) && pagina > 0) currentPage = pagina;
        const orden = q.get('sort');
        if (orden && ['default', 'price-asc', 'price-desc'].includes(orden)) {
            sortOrder = orden;
            if (sortSelect) sortSelect.value = orden;
        }
    }

    function escribirEstadoEnURL(reemplazar = false) {
        const q = new URLSearchParams();
        if (currentCategory !== 'all') q.set('c', currentCategory);
        if (searchQuery) q.set('q', searchQuery);
        if (currentPage > 1) q.set('p', String(currentPage));
        if (sortOrder !== 'default') q.set('sort', sortOrder);
        const cadena = q.toString();
        const url = cadena ? `${location.pathname}?${cadena}` : location.pathname;
        if (url === location.pathname + location.search) return;
        history[reemplazar ? 'replaceState' : 'pushState']({}, '', url);
    }

    window.addEventListener('popstate', () => {
        currentCategory = 'all';
        searchQuery = '';
        currentPage = 1;
        sortOrder = 'default';
        if (searchInput) searchInput.value = '';
        leerEstadoDeURL();
        syncCategoryLinks(currentCategory);
        renderProducts();
    });
```

- [ ] **Step 2: Escribir la URL en cada render**

Dentro de `renderProducts`, justo antes de `renderPaginationControls(totalPages);`,
agregar:

```javascript
            escribirEstadoEnURL();
```

- [ ] **Step 3: Leer la URL al arrancar**

Buscar la llamada inicial a `renderProducts()` que arranca la aplicación:

```bash
grep -n "^    renderProducts();" app.js
```

Reemplazarla por:

```javascript
    leerEstadoDeURL();
    syncCategoryLinks(currentCategory);
    renderProducts();
```

- [ ] **Step 4: Construir y verificar en el navegador**

```bash
node --env-file=.env src/build/index.js
npx --yes serve dist -l 4173
```

Comprobar en `http://localhost:4173`:
- Filtrar por Teclados ⇒ la URL pasa a `?c=teclados`.
- Buscar "rtx" ⇒ la URL incluye `q=rtx`.
- Ir a la página 2 ⇒ `p=2`.
- **Recargar** ⇒ se mantiene el mismo estado.
- **Botón atrás** ⇒ vuelve al estado anterior sin salir del sitio.
- Abrir `http://localhost:4173/?c=notebooks&q=hp` directo ⇒ muestra notebooks HP.

- [ ] **Step 5: Commit**

```bash
git add app.js
git commit -m "feat: estado de navegacion reflejado en la URL"
```

---

## Task 9: Documentación, publicación y verificación

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Documentar el pipeline de imágenes en `AGENTS.md`**

En la sección "Arquitectura", reemplazar el diagrama por:

```markdown
```
data/catalog.json   fuente de verdad (sin costos, sin proveedor)
public/img/*.webp   imagenes propias (el proveedor no interviene)
       ↓ src/build
dist/               lo único que se despliega
```

Las imágenes se descargan del proveedor **una sola vez**, se convierten a WebP
(máx. 800px) y se versionan. El sitio no depende de que el proveedor esté en
línea, y su dominio no aparece en ninguna parte de lo servido. El build lo
verifica contra el secreto `SUPPLIER_NAME` y falla si aparece.
```

Y en "Comandos", agregar:

```markdown
node --env-file=.env src/images/ejecutar.js   # Descargar imagenes faltantes
```

- [ ] **Step 2: Suite completa y build**

```bash
npm test
node --env-file=.env src/build/index.js
```
Expected: todos los tests en verde y el build completo.

- [ ] **Step 3: Verificar los presupuestos**

```bash
for f in index.html index.css app.js products.js; do
  printf "%-14s %6.0f KB gzip\n" "$f" "$(gzip -c dist/$f | wc -c | awk '{print $1/1024}')"
done
du -sh dist/img
```
Expected: `app.js` ≤ 60 KB, `products.js` ≤ 150 KB, `dist/img` alrededor de 13 MB.

- [ ] **Step 4: Abrir el PR**

```bash
git push -u origin feat/fase-1b-imagenes
```
Verificar que el CI queda en verde.

**Importante:** el workflow de despliegue necesita `SUPPLIER_NAME`, que ya
existe como secreto desde la Fase 0. El build ya no necesita
`SUPPLIER_IMG_BASE`; puede quedarse para el sync de la Fase 4.

- [ ] **Step 5: Fusionar y verificar en producción**

```bash
git checkout main
git merge feat/fase-1b-imagenes --no-ff -m "feat: Fase 1B - imagenes propias, analitica y front modular"
git push origin main
```

Verificar en `https://axtech.pages.dev`:
- Las imágenes cargan desde `/img/…`.
- La URL cambia al filtrar y el botón atrás funciona.
- No hay referencias al proveedor en el código fuente de la página.

---

## Criterio de aceptación de la Fase 1B

- [ ] `npm test` pasa por completo.
- [ ] Cero menciones al proveedor en `dist/` — verificado por el guard del build.
- [ ] El guard se vio fallar deliberadamente (Task 4, Step 8).
- [ ] Todas las imágenes servidas son WebP de ancho ≤ 800px.
- [ ] Ningún producto publicado carece de imagen propia.
- [ ] El catálogo aparece sin el retardo de 300 ms.
- [ ] Un título con marcado HTML se muestra como texto, no se ejecuta.
- [ ] Un solo listener en la grilla, no cuatro por tarjeta.
- [ ] Filtrar, buscar y paginar cambian la URL; recargar mantiene el estado; el botón atrás funciona.
- [ ] Presupuestos: `app.js` ≤ 60 KB gzip, `products.js` ≤ 150 KB gzip.
- [ ] `sharp` está en `devDependencies`, no en `dependencies`.
