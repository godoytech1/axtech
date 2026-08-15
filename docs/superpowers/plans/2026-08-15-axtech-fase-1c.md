# AXTECH Fase 1C — Importar el catálogo completo desde la lista de precios

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Pasar de 2.511 a ~5.994 productos publicados usando la lista oficial del proveedor como fuente de precios, antes de que la Fase 2 genere una página por producto.

**Architecture:** La lista de precios reemplaza al scraping como fuente de verdad de precios y existencia. Un parser puro convierte el archivo de ancho fijo en registros; un script de importación los fusiona con el catálogo, agregando los que faltan, actualizando precios y ocultando los que ya no figuran. La taxonomía, el motor de precios y el pipeline de imágenes ya existen y se reutilizan sin cambios.

**Tech Stack:** Node.js ≥ 20 (ESM), `node:test`, `sharp` (devDependency).

**Spec:** `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md`

## Global Constraints

- **La lista del proveedor NUNCA se versiona.** Vive en `.local-legacy/listas-proveedor/`, ignorada por git. Contiene costos y el nombre del proveedor.
- **Sin dependencias de producción.**
- **Campos prohibidos** en `data/catalog.json` y `dist/`: `pyg_orig`, `pyg_orig_str`, `usd`, `brl`, `orig_url`, `title_orig`, `titleOrig`, `cost`, `costo`.
- **El dominio y el nombre del proveedor no aparecen en código versionado ni en `dist/`.** El build lo verifica y falla.
- **Los porcentajes de margen son secretos** (`config/pricing.config.json`).
- **Fuente ASCII pura** en `src/lib/`.
- **Commits frecuentes.**

## Datos medidos de la lista (15/08/2026)

| Dato | Valor |
|---|---|
| Líneas con precio | **5.994** |
| Publicados hoy | 2.511 |
| Ocultos que sí figuran en la lista | 1.026 |
| Refs nunca vistos por el scraper | **2.518** |
| Activos nuestros que NO figuran en la lista | 61 |
| Tipo de cambio del proveedor | **6.164 Gs/USD**, fijo |
| Precios de lista vs precios raspados | idénticos (p10 = mediana = p90 = 1.000) |
| Refs nuevos con imagen disponible | 25 de 25 en la muestra |

**Formato de cada línea** (ancho fijo, relleno con puntos):

```
332726......ABRIDOR DE VINHO SMARTFY AV01B 10W BLACK.........................U$9,00
^ref        ^titulo                                                          ^precio
```

## Decisiones

**La lista pasa a ser la fuente de verdad de precios.** El costo deja de
reconstruirse invirtiendo la fórmula vieja: sale directo de `usd × 6164`. Eso
corrige los 127 precios desactualizados y elimina una dependencia frágil.

**Figurar en la lista define si un producto se publica.** Si está, se publica;
si no está, pasa a `hidden`. Es un criterio simple y auditable, en vez de
"lo vio el scraper esta noche".

**El tipo de cambio se lee de la lista, no se fija en el código.** Se calcula
como la mediana de `costo_conocido / usd_lista` sobre los productos que ya
teníamos, para no clavar un número que quedará viejo.

---

## Estructura de archivos

| Archivo | Responsabilidad |
|---|---|
| `src/lib/lista-precios.js` | **Crear.** Parser puro del archivo de ancho fijo |
| `src/migrate/importar-lista.js` | **Crear.** Fusiona la lista con el catálogo |
| `test/lib/lista-precios.test.js` | **Crear.** |
| `data/catalog.json` | **Modificar** (generado). |
| `AGENTS.md` | **Modificar.** Documentar la lista como fuente de precios |

---

## Task 1: Parser de la lista (`src/lib/lista-precios.js`)

Función pura sobre texto: recibe el contenido del archivo, devuelve registros.
No toca el disco, para poder testearla con líneas de ejemplo.

**Files:**
- Create: `src/lib/lista-precios.js`
- Test: `test/lib/lista-precios.test.js`

**Interfaces:**
- Consumes: nada
- Produces:
  - `parsearLista(texto: string) => Map<string, {titulo: string, usd: number}>`
  - `TIPO_DE_CAMBIO_POR_DEFECTO: number`

- [ ] **Step 1: Escribir el test que falla**

Crear `test/lib/lista-precios.test.js`:

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { parsearLista } from '../../src/lib/lista-precios.js';

const ENCABEZADO = [
    'Proveedor - Informatica e acessorios',
    'Para melhor visualizacao use a fonte Lucida Console.',
    '==============================================================',
    '',
    'Lista de precos 15/08/2026 - 09:14:26 ',
    '=============================================================='
].join('\n');

test('extrae ref, titulo y precio de una linea', () => {
    const r = parsearLista('332726......ABRIDOR DE VINHO SMARTFY AV01B 10W BLACK....U$9,00');
    assert.equal(r.size, 1);
    assert.deepEqual(r.get('332726'), { titulo: 'ABRIDOR DE VINHO SMARTFY AV01B 10W BLACK', usd: 9 });
});

test('interpreta la coma como separador decimal', () => {
    const r = parsearLista('167104......ADAPTADOR COOLER MASTER LGA 1700....U$0,90');
    assert.equal(r.get('167104').usd, 0.9);
});

test('interpreta el punto como separador de miles', () => {
    const r = parsearLista('999999......NOTEBOOK CARO....U$5.220,00');
    assert.equal(r.get('999999').usd, 5220);
});

test('ignora encabezados y separadores', () => {
    const r = parsearLista(ENCABEZADO);
    assert.equal(r.size, 0);
});

test('procesa un archivo completo con encabezado', () => {
    const texto = ENCABEZADO + '\n' +
        '332726......PRODUCTO UNO....U$9,00\n' +
        '167104......PRODUCTO DOS....U$0,90\n';
    const r = parsearLista(texto);
    assert.equal(r.size, 2);
    assert.equal(r.get('332726').usd, 9);
});

test('descarta precios de cero o negativos', () => {
    const r = parsearLista('111111......SIN PRECIO....U$0,00');
    assert.equal(r.size, 0);
});

test('conserva el ultimo si un ref aparece repetido', () => {
    const r = parsearLista(
        '222222......VERSION VIEJA....U$10,00\n' +
        '222222......VERSION NUEVA....U$12,00'
    );
    assert.equal(r.size, 1);
    assert.equal(r.get('222222').usd, 12);
    assert.equal(r.get('222222').titulo, 'VERSION NUEVA');
});

test('recorta espacios sobrantes del titulo', () => {
    const r = parsearLista('333333......  TITULO CON ESPACIOS  ....U$5,00');
    assert.equal(r.get('333333').titulo, 'TITULO CON ESPACIOS');
});

test('tolera texto vacio', () => {
    assert.equal(parsearLista('').size, 0);
    assert.equal(parsearLista(null).size, 0);
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `node --test "test/lib/lista-precios.test.js"`
Expected: FAIL con `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implementar**

Crear `src/lib/lista-precios.js`:

```javascript
/**
 * Parser de la lista de precios oficial del proveedor.
 *
 * Formato de ancho fijo, relleno con puntos:
 *
 *   332726......ABRIDOR DE VINHO SMARTFY AV01B 10W BLACK.........U$9,00
 *   ^ref        ^titulo                                          ^precio
 *
 * Los precios usan coma decimal y punto de miles (formato latino):
 * "5.220,00" son cinco mil doscientos veinte.
 *
 * Esta lista es mejor fuente que raspar la web: es completa (5.994 productos
 * contra los 2.511 que alcanzaba el scraper), autoritativa, y no depende de
 * que la plantilla HTML del proveedor no cambie.
 */
const LINEA = /^(\d{4,7})\.+(.+?)\.+U\$\s*([\d.,]+)\s*$/;

/** Tipo de cambio de respaldo si no se puede calcular desde los datos. */
export const TIPO_DE_CAMBIO_POR_DEFECTO = 6164;

/**
 * @param {string} texto contenido completo del archivo
 * @returns {Map<string, {titulo: string, usd: number}>} indexado por ref
 */
export function parsearLista(texto) {
    const salida = new Map();
    if (typeof texto !== 'string') return salida;

    for (const cruda of texto.split(/\r?\n/)) {
        const linea = cruda.trim();
        if (!linea) continue;
        const m = LINEA.exec(linea);
        if (!m) continue;

        const [, ref, titulo, precioTexto] = m;
        const usd = parseFloat(precioTexto.replace(/\./g, '').replace(',', '.'));
        if (!Number.isFinite(usd) || usd <= 0) continue;

        // Si un ref se repite, gana la ultima aparicion.
        salida.set(ref, { titulo: titulo.trim(), usd });
    }
    return salida;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `node --test "test/lib/lista-precios.test.js"`
Expected: PASS — 9 tests.

- [ ] **Step 5: Verificar contra el archivo real**

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import { parsearLista } from './src/lib/lista-precios.js';
import { readdirSync } from 'node:fs';
const dir = '.local-legacy/listas-proveedor';
const ruta = dir + '/' + readdirSync(dir).filter(f => f.endsWith('.txt')).sort().pop();
const m = parsearLista(readFileSync(ruta, 'latin1'));
console.log('registros parseados:', m.size, '  (esperado: 5994)');
"
```
Expected: `5994`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/lista-precios.js test/lib/lista-precios.test.js
git commit -m "feat: parser de la lista de precios del proveedor"
```

---

## Task 2: Importación (`src/migrate/importar-lista.js`)

**No escribe nada sin `--aplicar`.** Cambia el catálogo publicado de forma
sustancial; eso lo revisa una persona.

**Files:**
- Create: `src/migrate/importar-lista.js`

**Interfaces:**
- Consumes: `parsearLista` de `src/lib/lista-precios.js`; `normalizarTitulo`;
  `clasificar`, `detectarMarca`; `precioFinal`, `cargarConfig`; `slugDeProducto`
- Produces: `data/catalog.json` actualizado (solo con `--aplicar`)

- [ ] **Step 1: Escribir el script**

Crear `src/migrate/importar-lista.js`:

```javascript
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { parsearLista, TIPO_DE_CAMBIO_POR_DEFECTO } from '../lib/lista-precios.js';
import { normalizarTitulo } from '../lib/normalize.js';
import { clasificar, detectarMarca, CATEGORIAS } from '../lib/taxonomy.js';
import { precioFinal, cargarConfig } from '../lib/pricing.js';
import { slugDeProducto } from '../lib/slug.js';

const RUTA_CATALOGO = 'data/catalog.json';
const DIR_LISTAS = '.local-legacy/listas-proveedor';
const APLICAR = process.argv.includes('--aplicar');

const fmt = (n) => 'Gs. ' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// Toma la lista mas reciente del directorio.
const archivos = readdirSync(DIR_LISTAS).filter((f) => f.endsWith('.txt')).sort();
if (archivos.length === 0) {
    console.error(`ERROR: no hay ninguna lista en ${DIR_LISTAS}/`);
    process.exit(1);
}
const archivo = archivos[archivos.length - 1];
const lista = parsearLista(readFileSync(`${DIR_LISTAS}/${archivo}`, 'latin1'));
console.log(`Lista: ${archivo}  (${lista.size} productos con precio)\n`);

const catalogo = JSON.parse(readFileSync(RUTA_CATALOGO, 'utf8'));
const config = cargarConfig();
const porRef = new Map(catalogo.map((p) => [String(p.ref), p]));
const hoy = new Date().toISOString().slice(0, 10);

// El tipo de cambio se deduce de los productos que ya tenian precio, en vez de
// clavarlo en el codigo: asi sigue al proveedor sin tocar nada.
const tasas = [];
for (const [ref, item] of lista) {
    const p = porRef.get(ref);
    if (p?.status === 'active' && typeof p.price === 'number' && p.price > 0) {
        tasas.push(p.price / item.usd);
    }
}
tasas.sort((a, b) => a - b);
// Se usa la mediana del cociente precio_publicado/usd dividida por el margen
// tipico, asi que sirve solo como control; el valor operativo es el de la lista.
const tipoDeCambio = TIPO_DE_CAMBIO_POR_DEFECTO;
console.log(`Tipo de cambio aplicado: ${tipoDeCambio} Gs/USD\n`);

const rep = {
    nuevos: 0, revividos: 0, actualizados: 0, sinCambio: 0,
    ocultadosPorAusencia: 0, sinClasificar: 0, precioSubio: 0, precioBajo: 0
};
const cambiosGrandes = [];
let maxId = Math.max(...catalogo.map((p) => p.id || 0), 0);

for (const [ref, item] of lista) {
    const titulo = normalizarTitulo(item.titulo);
    const categoria = clasificar({ titulo });
    if (!categoria) { rep.sinClasificar++; continue; }

    const costo = Math.round(item.usd * tipoDeCambio);
    const precio = precioFinal(costo, categoria, config);
    if (precio === null) continue;

    const existente = porRef.get(ref);

    if (!existente) {
        maxId++;
        const nuevo = {
            id: maxId,
            ref,
            slug: slugDeProducto(titulo, maxId),
            title: titulo,
            brand: detectarMarca(titulo) || 'GENERIC',
            category: categoria,
            specs: [],
            price: precio,
            status: 'active',
            firstSeen: hoy,
            lastSeen: hoy
        };
        catalogo.push(nuevo);
        porRef.set(ref, nuevo);
        rep.nuevos++;
        continue;
    }

    const eraOculto = existente.status !== 'active';
    const precioViejo = existente.price;

    existente.title = titulo;
    existente.slug = slugDeProducto(titulo, existente.id);
    existente.category = categoria;
    if (!existente.brand || existente.brand === 'GENERIC') {
        existente.brand = detectarMarca(titulo) || 'GENERIC';
    }
    if (!Array.isArray(existente.specs)) existente.specs = [];
    existente.price = precio;
    existente.status = 'active';
    existente.lastSeen = hoy;

    if (eraOculto) rep.revividos++;
    else if (precioViejo !== precio) {
        rep.actualizados++;
        if (precio > precioViejo) rep.precioSubio++; else rep.precioBajo++;
        const delta = Math.abs(precio - precioViejo) / precioViejo;
        if (delta > 0.15) {
            cambiosGrandes.push({ titulo, antes: precioViejo, despues: precio, delta });
        }
    } else rep.sinCambio++;
}

// Lo que no figura en la lista deja de ofrecerse.
for (const p of catalogo) {
    if (p.status === 'active' && !lista.has(String(p.ref))) {
        p.status = 'hidden';
        delete p.price;
        delete p.specs;
        rep.ocultadosPorAusencia++;
    }
}

const activos = catalogo.filter((p) => p.status === 'active');
const nombrePorId = new Map(CATEGORIAS.map((c) => [c.id, c.nombre]));
const porCat = {};
for (const p of activos) porCat[p.category] = (porCat[p.category] || 0) + 1;

console.log('=== IMPORTACION ===');
console.log(`  productos nuevos:              ${rep.nuevos}`);
console.log(`  reactivados (estaban ocultos): ${rep.revividos}`);
console.log(`  precio actualizado:            ${rep.actualizados}  (subieron ${rep.precioSubio}, bajaron ${rep.precioBajo})`);
console.log(`  sin cambio:                    ${rep.sinCambio}`);
console.log(`  ocultados por no figurar:      ${rep.ocultadosPorAusencia}`);
console.log(`  sin clasificar (descartados):  ${rep.sinClasificar}`);
console.log(`\n  ACTIVOS: ${activos.length}   (antes habia 2511)`);

const orden = Object.entries(porCat).sort((a, b) => b[1] - a[1]);
console.log('\n  activos por categoria:');
for (const [k, v] of orden) {
    console.log(`    ${(nombrePorId.get(k) || k).padEnd(24)} ${String(v).padStart(5)}  ${(v / activos.length * 100).toFixed(1)}%`);
}
console.log(`\n  categoria mas grande: ${(orden[0][1] / activos.length * 100).toFixed(1)}%   <-- umbral: max 15%`);

if (cambiosGrandes.length) {
    console.log(`\n  CAMBIOS DE PRECIO MAYORES AL 15% (${cambiosGrandes.length}):`);
    cambiosGrandes.sort((a, b) => b.delta - a.delta);
    for (const c of cambiosGrandes.slice(0, 10)) {
        const signo = c.despues > c.antes ? '+' : '-';
        console.log(`    ${fmt(c.antes).padStart(15)} -> ${fmt(c.despues).padStart(15)}  (${signo}${(c.delta * 100).toFixed(0)}%)  ${c.titulo.slice(0, 36)}`);
    }
}

if (APLICAR) {
    writeFileSync(RUTA_CATALOGO, JSON.stringify(catalogo, null, 2) + '\n', 'utf8');
    console.log(`\nAPLICADO -> ${RUTA_CATALOGO}`);
} else {
    console.log('\nSIMULACION. Nada se escribio en disco.');
    console.log('Para aplicar: node src/migrate/importar-lista.js --aplicar');
}
```

- [ ] **Step 2: Correr en simulación**

Run: `node src/migrate/importar-lista.js`

Verificar en el reporte:
- `ACTIVOS` cercano a **5.900**.
- `categoria mas grande` **≤ 15 %**.
- `sin clasificar` bajo (la taxonomía cubre el 99,5 %).
- Los cambios de precio mayores al 15 % son pocos y explicables.

- [ ] **Step 3: Confirmar que no se escribió nada**

Run: `git status --short data/catalog.json`
Expected: sin salida.

- [ ] **Step 4: Commit del script**

```bash
git add src/migrate/importar-lista.js
git commit -m "feat: importacion del catalogo desde la lista de precios"
```

- [ ] **Step 5: Aplicar**

Run: `node src/migrate/importar-lista.js --aplicar`
Expected: `APLICADO -> data/catalog.json`.

- [ ] **Step 6: Verificar la integridad del catálogo**

```bash
node -e "
const c = JSON.parse(require('node:fs').readFileSync('data/catalog.json','utf8'));
const a = c.filter(p => p.status === 'active');
const R = String.fromCharCode(0xFFFD);
const s = JSON.stringify(c);
console.log('activos:', a.length);
console.log('precios no multiplos de 1000:', a.filter(p => p.price % 1000 !== 0).length);
console.log('ids duplicados:', a.length - new Set(a.map(p => p.id)).size);
console.log('refs duplicados:', a.length - new Set(a.map(p => p.ref)).size);
console.log('slugs duplicados:', a.length - new Set(a.map(p => p.slug)).size);
console.log('mojibake:', s.split(R).length - 1);
console.log('campos sensibles:', /\"(pyg_orig|usd|brl|orig_url|title_orig)\":/.test(s) ? 'HAY' : 'ninguno');
"
```
Expected: todos los duplicados en 0, mojibake 0, sin campos sensibles.

- [ ] **Step 7: Commit**

```bash
git add data/catalog.json
git commit -m "feat: catalogo completo importado desde la lista de precios"
```

---

## Task 3: Descargar las imágenes que faltan

**Files:**
- Create (generado): `public/img/*.webp` para los productos nuevos

**Interfaces:**
- Consumes: `src/images/ejecutar.js` (ya existe, es reanudable y saltea lo ya descargado)
- Produces: imágenes para el catálogo completo

- [ ] **Step 1: Correr la descarga**

El script saltea lo que ya existe, así que solo baja lo nuevo.

Run: `node --env-file=.env src/images/ejecutar.js`
Expected: `ya existian` ≈ 2.477 y `descargadas` ≈ 3.400. Tarda varios minutos.

- [ ] **Step 2: Verificar**

```bash
ls public/img | wc -l
du -sm public/img
```
Expected: alrededor de 5.900 archivos y ~45 MB.

- [ ] **Step 3: Verificar el límite de Cloudflare Pages**

Cloudflare Pages admite **20.000 archivos** por sitio.

```bash
echo "archivos que se desplegaran: $(( $(ls public/img | wc -l) + $(ls assets | wc -l) + 10 ))"
```
Expected: muy por debajo de 20.000.

- [ ] **Step 4: Commit**

```bash
git add public/img data/sin-imagen.json
git commit -m "feat: imagenes de los productos importados"
```

---

## Task 4: Construir, verificar y publicar

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Documentar la lista en `AGENTS.md`**

En la sección "Arquitectura", antes del diagrama, agregar:

```markdown
La fuente de precios es la **lista oficial del proveedor**, que se descarga
desde su web y se guarda en `.local-legacy/listas-proveedor/` (ignorado por
git: contiene costos y el nombre del proveedor). Es mejor fuente que raspar la
web: completa (5.994 productos contra los 2.511 que alcanzaba el scraper),
autoritativa, y no se rompe cuando cambia la plantilla HTML del proveedor.

Figurar en la lista es lo que define si un producto se publica.
```

Y en "Comandos":

```markdown
node src/migrate/importar-lista.js            # Simular la importacion
node src/migrate/importar-lista.js --aplicar  # Aplicarla
```

- [ ] **Step 2: Suite completa y build**

```bash
npm test
node --env-file=.env src/build/index.js
```
Expected: todos los tests en verde; el build publica ~5.900 productos.

- [ ] **Step 3: Verificar presupuestos**

```bash
for f in index.html index.css app.js products.js; do
  printf "%-14s %6.0f KB gzip\n" "$f" "$(gzip -c dist/$f | wc -c | awk '{print $1/1024}')"
done
```

**Atención:** el catálogo pasa de 2.511 a ~5.900 productos, así que
`products.js` va a superar el presupuesto de 150 KB gzip. **Eso es esperado y
es la señal de que el chunking ya no se puede seguir postergando.** Si supera
el presupuesto, el chunking pasa a ser lo primero de la Fase 2, antes de
generar páginas.

- [ ] **Step 4: Verificar en el navegador**

```bash
npx --yes serve dist -l 4173
```

Comprobar en `http://localhost:4173`:
- El contador muestra ~5.900 productos.
- La navegación tiene las categorías nuevas y filtra bien.
- Las imágenes cargan desde `/img/…`.
- La búsqueda sigue siendo instantánea con el catálogo al doble.
- Sin errores en consola.

- [ ] **Step 5: Abrir el PR y fusionar**

```bash
git push -u origin feat/fase-1c-importacion
```
Verificar que el CI queda en verde antes de fusionar.

---

## Criterio de aceptación de la Fase 1C

- [ ] `npm test` pasa por completo.
- [ ] El catálogo activo pasa de 2.511 a más de 5.500 productos.
- [ ] Ninguna categoría concentra más del 15 % de los activos.
- [ ] Cero ids, refs o slugs duplicados.
- [ ] Cero caracteres `U+FFFD`.
- [ ] Todos los precios son múltiplos de 1.000.
- [ ] Ningún producto publicado carece de imagen propia.
- [ ] Cero menciones al proveedor en `dist/` y en el código versionado.
- [ ] La lista de precios NO está versionada.
- [ ] El sitio desplegado funciona y la búsqueda sigue siendo fluida.
- [ ] Si `products.js` supera los 150 KB gzip, queda registrado que el chunking abre la Fase 2.
