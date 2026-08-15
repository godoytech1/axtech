# AXTECH — Diseño de la Refactorización Integral

- **Fecha**: 2026-08-14
- **Rama**: `feat/axtech-overhaul`
- **Worktree**: `C:\Page\.claude\worktrees\axtech-overhaul`
- **Estado**: Aprobado para planificar

---

## 1. Contexto

AXTECH es una tienda de tecnología online (Paraguay) que revende el catálogo del
distribuidor el distribuidor. Es un sitio estático de una sola página: HTML +
CSS vanilla + un `app.js` de 2.006 líneas, con un catálogo servido como un
`products.js` de 10,4 MB. Un scraper en Node (`sync-legacy.cjs`) corre cada noche
por GitHub Actions y commitea el catálogo actualizado a `main`, que Vercel
despliega automáticamente.

Este documento define la refactorización completa. Todo lo que sigue está
medido sobre el catálogo real del 2026-08-14, no estimado.

### 1.1 Diagnóstico medido

| # | Hallazgo | Medición | Origen |
|---|---|---|---|
| 1 | Costos y proveedor expuestos públicamente | `pyg_orig`, `usd`, `brl`, `orig_url` en cada registro, servidos al navegador y presentes en el repo público de GitHub | `products.js`, verificado vía `raw.githubusercontent.com` (HTTP 200 sin auth) |
| 2 | Bundle de datos desproporcionado | 10,4 MB en disco, **997 KB gzip**, ~1 s de descarga bloqueante | `curl` a producción |
| 3 | Catálogo mayoritariamente sin precio | **10.474 de 12.998** productos (80,6 %) en `sob_consulta` | análisis del catálogo |
| 4 | Causa raíz de (3) | `if (!html \|\| html.length < 3000) break` corta la categoría entera ante un fallo de red; luego el bloque de stock marca todo lo no visto como Bajo Consulta | `sync-legacy.cjs:270` |
| 5 | Sin purga | Ningún producto se elimina jamás; los zombis se acumulan indefinidamente | `sync-legacy.cjs:391-404` |
| 6 | Clasificación por categoría rota | **5.783 productos (44,5 %)** caen en `Periféricos`, que es el valor de retorno por defecto | `sync-legacy.cjs:126` |
| 7 | Señal de categoría descartada | El loop conoce el slug de la categoría que raspa, pero pasa `slugName` (derivado de la URL del producto) a `detectCategory` | `sync-legacy.cjs:311` |
| 8 | Detección de marca rota | **5.058 productos (38,9 %)** con marca `GENERIC` | análisis del catálogo |
| 9 | Corrupción de caracteres (mojibake) | 971 títulos con portugués sin traducir; ejemplos con `RECARREG\uFFFD`. Causa: `data += chunk` concatena Buffers sin `setEncoding`, partiendo caracteres UTF-8 multibyte en el borde del chunk | `sync-legacy.cjs:147` |
| 10 | Duplicados | 203 títulos repetidos, 417 filas afectadas | análisis del catálogo |
| 11 | `specs` inútiles | 10.888 productos con `specs = [marca, categoría]`; 832 sin `specs` | análisis del catálogo |
| 12 | Modelo de precios incoherente | Margen real: mediana 28,5 %, p25 11,7 %, mínimo 0,5 %, máximo 1622 % | análisis del catálogo |
| 13 | SEO inexistente | 1 sola URL; sin páginas de producto ni categoría, sin Open Graph, sin JSON-LD, sitemap con 1 entrada | `index.html`, `sitemap.xml` |
| 14 | Lentitud autoinfligida | `setTimeout(..., 300)` en cada render del catálogo | `app.js:686` |
| 15 | Riesgo de XSS | `card.innerHTML` interpola títulos scrapeados de un tercero sin escapar | `app.js:613` |
| 16 | Documentación contradictoria | `AGENTS.md` (+100.000 fijo, 1.940 productos, "Relojes Mi Band") vs `CLAUDE.md`/`REGLAS` (3 reglas de margen, 18 categorías) | los 3 archivos |
| 17 | Peso muerto versionado | 5,3 MB de assets de los que `index.html` usa 2; `historia_de_conversacion.md` de 267 KB | `assets/`, raíz |
| 18 | Categorías huérfanas | La navegación expone 13 categorías; el catálogo tiene 18 | `index.html` vs catálogo |
| 19 | Funciones monolíticas | `renderSidebarFilters` 538 líneas, `renderProducts` 396 líneas | `app.js:925-1463`, `app.js:293-688` |
| 20 | Cero tests | No existe ningún test en el repositorio | — |
| 21 | Hosting fuera de términos | Vercel Hobby prohíbe explícitamente el uso comercial ("Advertising the sale of a product or service"); AXTECH es una tienda | docs de Vercel, Fair Use Guidelines |

### 1.2 Distribución actual del catálogo

```
TOTAL 12.998  |  ACTIVOS 2.524  |  BAJO CONSULTA 10.474

Periféricos            5.783 (1.043 activos)   <- categoría de descarte
Tarjetas de Video      1.014 (  126)
Placas Madre           1.001 (  258)
Memorias RAM             913 (  162)
Monitores                904 (   93)
Gabinetes                794 (  179)
Almacenamiento (SSD)     757 (  121)
Fuentes de Poder         496 (  154)
Televisores              440 (   81)
Notebooks                290 (   93)
Procesadores             240 (   90)
Consolas y Videojuegos   168 (   30)
Relojes Mi Band           99 (   70)   <- duplicada con "Relojes Smart"
Teléfonos / Celulares     48 (    0)
Smart Home / Domótica     23 (   20)
Tablets                   20 (    3)
Relojes Smart              6 (    0)   <- duplicada con "Relojes Mi Band"
Adaptadores y Cables       2 (    1)
```

---

## 2. Decisiones tomadas

Estas decisiones fueron acordadas con el responsable del proyecto y no se
reabren durante la implementación:

| # | Decisión | Elección |
|---|---|---|
| D1 | Arquitectura del front | Vanilla + generador estático propio (sin framework) |
| D2 | Modelo de precios | Híbrido: `costo + max(mínimo, costo × pct_categoría)` |
| D3 | Productos sin precio | Ocultar del sitio público; purgar tras 30 días sin verse |
| D4 | Alcance | Fases 0 a 4 (técnico + SEO + UX). Growth queda fuera. |
| D5 | Privacidad de datos | Los datos sensibles **salen del repositorio**. El repo sigue público. |
| D6 | Hosting | Migrar a Cloudflare Pages + R2 + Web Analytics |
| D7 | Aislamiento del trabajo | Worktree `feat/axtech-overhaul`, con el cron nocturno pausado |

### 2.1 Justificación de D5 (por qué el repo sigue público)

Hacer el repositorio privado rompería el despliegue: en proyectos privados del
plan Hobby, Vercel valida el autor de cada commit y solo despliega los del dueño
de la cuenta — el bot de sync commitea como `AXTECH Sync Bot`, así que el sync
nocturno dejaría de publicar. Cloudflare Pages no tiene esa restricción, pero
igual la privacidad del repo es la defensa equivocada: protege el dato solo
mientras nadie obtenga acceso.

La defensa correcta es que **el dato sensible no exista en el repositorio**.
Análisis de qué es sensible y qué necesita persistir entre corridas:

| Dato | Sensible | ¿Persistir? | Dónde vive |
|---|---|---|---|
| Costo (`pyg_orig`) | Sí | **No** — se raspa fresco cada noche | Solo en memoria durante la corrida |
| Dominio del proveedor | Sí | Sí | GitHub Secret / variable de entorno |
| `usd`, `brl` | Sí (derivan del costo) | No | Solo en memoria |
| Porcentajes de margen | Sí (permiten derivar el costo desde el precio) | Sí | GitHub Secret `PRICING_CONFIG` |
| `id`, `ref`, `lastSeen` | No (un número de 6 dígitos sin saber el proveedor es inútil) | Sí | `data/catalog.json`, versionado |
| Precio de venta | No (es público en el sitio) | Sí | `data/catalog.json`, versionado |

**Riesgo residual aceptado**: si un tercero descubre por otro medio quién es el
proveedor, el campo `ref` le permite localizar cada producto en el catálogo de
origen. Se acepta porque `ref` es necesario para depurar y para reconciliar
productos entre corridas, y porque la identidad del proveedor es el secreto real.

**Historial de git**: el historial actual contiene meses de costos. Reescribirlo
con `git-filter-repo` no es confiable (GitHub cachea objetos, los forks
conservan copias). Como el historial son ~30 commits automáticos sin valor, se
recrea el repositorio desde cero con un commit inicial limpio.

---

## 3. Arquitectura objetivo

### 3.1 Estructura de directorios

```
axtech/
├── AGENTS.md                    Fuente de verdad única de reglas (prosa)
├── CLAUDE.md                    Stub de 3 líneas que apunta a AGENTS.md
├── data/
│   ├── catalog.json             Catálogo persistente (SIN costo, SIN proveedor)
│   └── catalog.schema.json      Contrato validable del catálogo
├── config/
│   ├── pricing.config.example.json   Plantilla con valores de ejemplo (versionada)
│   └── pricing.config.json           Real, gitignored; en CI viene de un Secret
├── src/
│   ├── lib/
│   │   ├── pricing.js           Motor de precios — única fuente de verdad
│   │   ├── taxonomy.js          Categorías, mapa de slugs, marcas
│   │   ├── normalize.js         Traducción PT→ES, limpieza de títulos, specs
│   │   ├── slug.js              Generación de slugs de URL
│   │   └── contract.js          Proyección privado → público
│   ├── sync/
│   │   ├── index.js             Orquestador
│   │   ├── fetch.js             HTTP con reintentos y encoding correcto
│   │   ├── parse.js             Parseo de HTML → productos crudos
│   │   ├── images.js            Descarga, conversión a WebP, subida a R2
│   │   └── report.js            Diff y alertas de la corrida
│   └── build/
│       ├── index.js             Orquestador del build
│       ├── pages.js             Generación de HTML estático
│       ├── data.js              Generación de índice y chunks JSON
│       ├── seo.js               JSON-LD, sitemaps, robots
│       └── budget.js            Verificación de presupuestos de tamaño
├── public/
│   ├── index.html               Plantilla base
│   ├── css/                     Estilos (ex index.css, modularizado)
│   ├── js/                      Módulos ES del front
│   └── assets/                  Solo lo que se usa realmente
├── test/                        Tests con node:test
│   └── fixtures/                HTML del proveedor guardado, para tests offline
├── dist/                        Salida del build (gitignored) — lo único desplegado
└── .github/workflows/
    ├── daily_sync.yml           Sync nocturno
    └── ci.yml                   Validación en cada PR
```

### 3.2 Separación fuente / entrega

El defecto de raíz del proyecto actual es que `products.js` es a la vez la fuente
de verdad y el archivo que se entrega al navegador. Mientras eso siga así, no
existe forma de tener datos privados.

```
  el proveedor (scraping)
        │
        ▼
  ┌─────────────┐   costo, usd, brl, orig_url   ← existen SOLO acá, en memoria
  │  src/sync   │
  └─────────────┘
        │  aplica pricing.js  →  descarta el costo
        ▼
  data/catalog.json        ← versionado. Sin costo. Sin proveedor.
        │
        ▼
  ┌─────────────┐
  │  src/build  │  aplica contract.js (whitelist de campos)
  └─────────────┘
        │
        ▼
  dist/                    ← lo único que se despliega
```

---

## 4. Contratos de datos

### 4.1 Registro persistente (`data/catalog.json`)

```json
{
  "id": 10122,
  "ref": "329967",
  "slug": "tv-100-jvc-lt-100km958-4k-smart-10122",
  "title": "TV 100 JVC LT-100KM958 4K/Smart QDMini/Atmos 2.1",
  "titleOrig": "TV 100 JVC LT-100KM958 4K/SMART QDMINI/ATMOS 2.1",
  "brand": "JVC",
  "category": "televisores",
  "specs": ["100\"", "4K", "Smart TV"],
  "price": 8050000,
  "status": "active",
  "firstSeen": "2026-03-02",
  "lastSeen": "2026-08-14"
}
```

- **No hay campo de imagen.** La URL se *deriva* en tiempo de build a partir de
  una variable de entorno, nunca se almacena. Esto mantiene al proveedor fuera
  del repositorio desde la Fase 0, antes de que exista el pipeline de R2:
  - Fase 0 (transitorio): `${SUPPLIER_IMG_BASE}/IMG_${ref}_1.JPG`
  - Fase 1 en adelante: `${R2_PUBLIC_BASE}/p/${id}.webp`
- `status`: `"active"` (visto en la última corrida y con precio) u `"hidden"`
  (no visto o sin precio).
- Un registro con `status: "hidden"` y `lastSeen` de más de 30 días se elimina.
- **Campos prohibidos en este archivo**: `pyg_orig`, `pyg_orig_str`, `usd`,
  `brl`, `orig_url`, y cualquier cadena que contenga el dominio del proveedor.

### 4.2 Registro público (`dist/api/*.json`)

Proyección estricta por whitelist, generada por `src/lib/contract.js`:

```json
{ "i": 10122, "s": "tv-100-jvc-...-10122", "t": "TV 100 JVC ...",
  "b": "JVC", "c": "televisores", "p": 8050000, "m": "/p/10122.webp" }
```

Claves cortas para reducir el peso del índice. Los `specs` solo viajan en el
chunk de la categoría, no en el índice de búsqueda.

### 4.3 Regla de verificación (rompe el build)

`src/build/budget.js` falla el build si en cualquier archivo de `dist/` aparece:
- alguno de los campos prohibidos de 4.1, o
- la cadena del dominio del proveedor (leída de la variable de entorno), o
- un valor numérico que coincida con un costo conocido de la corrida.

Esto convierte la fuga de datos en algo imposible de reintroducir por descuido.

---

## 5. Motor de precios

### 5.1 Fórmula

```js
// src/lib/pricing.js
function precioFinal(costo, categoria, config) {
  if (!Number.isFinite(costo) || costo <= 0) return null;   // → status hidden
  const pct    = config.pct[categoria] ?? config.pct.default;
  const minimo = costo < config.umbralBarato ? config.minimoBarato : config.minimoBase;
  const bruto  = costo + Math.max(minimo, costo * pct);
  return Math.ceil(bruto / 1000) * 1000;                     // redondeo al millar
}
```

El redondeo al millar superior existe porque `Gs. 1.067.683` en una tarjeta de
producto se lee como un error del sistema, no como un precio.

### 5.2 Configuración (`config/pricing.config.json`)

Este archivo **no se versiona** (los porcentajes permiten derivar el costo a
partir del precio publicado). Se versiona `pricing.config.example.json` con
valores de ejemplo. En CI, el archivo real se materializa desde el GitHub Secret
`PRICING_CONFIG`.

```json
{
  "umbralBarato": 200000,
  "minimoBarato": 50000,
  "minimoBase": 100000,
  "pct": {
    "notebooks": 0.10, "pcs-de-escritorio": 0.10,
    "tarjetas-de-video": 0.12, "procesadores": 0.12,
    "placas-madre": 0.15, "memorias-ram": 0.15,
    "almacenamiento-ssd": 0.15, "monitores": 0.15,
    "televisores": 0.12, "consolas-y-videojuegos": 0.10,
    "telefonos-y-celulares": 0.10, "tablets": 0.12,
    "fuentes-de-poder": 0.18, "ups-y-energia": 0.18,
    "gabinetes": 0.20, "relojes-smart": 0.20,
    "refrigeracion": 0.22, "redes-y-conectividad": 0.22,
    "smart-home": 0.22,
    "teclados": 0.25, "mouses-y-mousepads": 0.25,
    "auriculares-y-headsets": 0.25, "microfonos": 0.25,
    "adaptadores-y-cables": 0.30,
    "default": 0.15
  }
}
```

Criterio: cuanto más caro y más comparable el producto (una RTX se cotiza en
cinco tiendas), menor el porcentaje; cuanto más accesorio y de menor ticket,
mayor. Los valores son un punto de partida razonable y el responsable del
negocio puede ajustarlos editando un solo archivo.

### 5.3 Invariantes verificadas por tests

1. `precioFinal(costo, cat) > costo` para todo costo válido.
2. `precioFinal(costo, cat) - costo >= minimoAplicable`.
3. El resultado es siempre múltiplo de 1.000.
4. Costo ≤ 0, `NaN` o ausente ⇒ `null` (el producto pasa a `hidden`, nunca se
   publica con precio 0).
5. `precioFinal` es monótona creciente respecto al costo.
6. Ningún precio final supera 2× el costo (detecta errores de configuración).

---

## 6. Taxonomía

### 6.1 Problema

`detectCategory` decide por subcadenas del título y devuelve `Periféricos` por
defecto — de ahí el 44,5 % de descarte. Además, el scraper **ya sabe** de qué
categoría del proveedor viene cada producto (el slug del loop) pero descarta esa
señal.

### 6.2 Solución

La categoría del proveedor pasa a ser la señal **primaria**, mediante un mapa
explícito. El título solo se usa para desambiguar los slugs que agrupan varias
categorías.

```js
// src/lib/taxonomy.js — SLUG_A_CATEGORIA
'notebook-e-pc-notebook'            → 'notebooks'
'notebook-e-pc-desktop'             → 'pcs-de-escritorio'
'placa-de-video-nvidia'             → 'tarjetas-de-video'
'placa-de-video-amd'                → 'tarjetas-de-video'
'memoria-ram-desktop'               → 'memorias-ram'
'memoria-ram-notebook'              → 'memorias-ram'
'fonte-de-energia'                  → 'fuentes-de-poder'
'processador-intel'                 → 'procesadores'
'processador-amd'                   → 'procesadores'
'placa-mae-intel'                   → 'placas-madre'
'placa-mae-amd'                     → 'placas-madre'
'armazenamento-ssd-2-5'             → 'almacenamiento-ssd'
'armazenamento-ssd-nvme'            → 'almacenamiento-ssd'
'monitores'                         → 'monitores'
'perifericos-fone-e-headset'        → 'auriculares-y-headsets'
'perifericos-teclado'               → 'teclados'
'perifericos-mouse'                 → 'mouses-y-mousepads'
'perifericos-mouse-pad'             → 'mouses-y-mousepads'
'perifericos-microfone'             → 'microfonos'
'perifericos-gabinete'              → 'gabinetes'
'perifericos-cooler-e-fans'         → 'refrigeracion'
'perifericos-cabos-e-adaptadores'   → 'adaptadores-y-cables'
'eletronicos-games-e-consoles'      → 'consolas-y-videojuegos'
'eletronicos-tv'                    → 'televisores'
'eletronicos-automacao-inteligente' → 'smart-home'
'eletronicos-relogio-e-smartwatch'  → 'relojes-smart'
'eletronicos-tablet'                → 'tablets'
'telefonia-smartphone'              → 'telefonos-y-celulares'
'energia-ups'                       → 'ups-y-energia'
'energia-nobreak'                   → 'ups-y-energia'
'rede-e-internet-*'  (4 slugs)      → 'redes-y-conectividad'
'apple-iphone'                      → 'telefonos-y-celulares'
'apple'                             → POR TÍTULO (agrupa varias categorías)
```

Resultado: 24 categorías reales en vez de 18 con una bolsa de gatos de 5.783
productos. `Periféricos` desaparece como categoría; se disuelve en teclados,
mouses, auriculares, micrófonos y refrigeración. Esto también beneficia al SEO:
cada categoría pasa a ser una página que apunta a una intención de búsqueda
concreta ("teclado mecánico Paraguay") en vez de una genérica.

`Relojes Mi Band` y `Relojes Smart` se fusionan en `relojes-smart`.

### 6.3 Reglas de calidad

- Un producto cuyo slug no esté en el mapa y cuyo título no resuelva se marca
  `status: "hidden"` y se reporta. **No existe una categoría de descarte
  silencioso.**
- El validador falla si más del 5 % de los productos activos queda sin
  clasificar, o si más del 10 % queda con marca `GENERIC`.

### 6.4 Marcas

Se mantiene la lista de marcas conocidas, ampliada con las que hoy caen en
`GENERIC`. Se agrega detección por alias (p. ej. `LOGI` → `LOGITECH`) y un
reporte de los títulos no reconocidos, para ir completando la lista corrida a
corrida en vez de dejar el 38,9 % en `GENERIC`.

---

## 7. Motor de sincronización

### 7.1 Correcciones

| Defecto actual | Corrección |
|---|---|
| Mojibake por concatenar Buffers | `res.setEncoding('utf8')` antes de acumular |
| `if (!html) break` mata la categoría | Reintentos con backoff exponencial (3 intentos); si tras los reintentos falla, se aborta **esa categoría** sin tocar su stock, y se registra la advertencia |
| Safeguard global insuficiente | Safeguard por categoría: si una categoría devuelve menos del 50 % de los productos que tenía la corrida anterior, se conserva su stock previo y se alerta |
| Zombis eternos | `lastSeen`; `hidden` si no se ve; eliminado a los 30 días |
| ~10 min secuenciales | Concurrencia limitada a 6 peticiones simultáneas |
| `eval()` sobre 10 MB | `JSON.parse` |
| Categoría por título | Slug del loop como señal primaria (§6.2) |
| Imposible de testear | Fixtures de HTML del proveedor en `test/fixtures/`; el parser se testea sin red |
| Cambios de precio invisibles | Reporte de diff: nuevos, desaparecidos, y **alerta si algún precio varía más de 20 %** respecto a la corrida anterior |
| Recálculo por tipo de cambio promedio | Se elimina. Recalcular `pyg_orig` como `usd × tasa_promedio` sobrescribe el precio real raspado con una aproximación, e introduce error en todos los productos. Se usa el precio en guaraníes tal como lo publica el proveedor. |

### 7.2 Pipeline de imágenes

Hoy cada `<img>` apunta al dominio del proveedor: lo expone, le manda tráfico
que no le corresponde, y deja el sitio a merced de su disponibilidad.

Nuevo flujo, implementado en `src/sync/images.js`. Se ejecuta como script
independiente sobre todo el catálogo en la Fase 1 (migración inicial) y queda
integrado al sync en la Fase 4, procesando solo lo nuevo:

```
ref → descarga desde SUPPLIER_IMG_BASE (secret)
    → descarta si MD5 == placeholder conocido
    → convierte a WebP (ancho máx. 800 px, calidad 82)
    → sube a Cloudflare R2 como p/{id}.webp
    → el catálogo guarda solo la URL pública de R2
```

- Solo se procesan imágenes nuevas o cambiadas (comparación por hash).
- R2: 10 GB gratis, **sin costo de egreso**. Estimación: 2.524 imágenes × ~25 KB
  ≈ 63 MB.
- Efecto colateral valioso: el sitio deja de depender de que el proveedor esté
  en línea.

### 7.3 Contrato de salida del sync

El sync **no escribe HTML ni toca `dist/`**. Su única salida es
`data/catalog.json` más los objetos en R2. Esto lo hace testeable y desacopla el
scraping de la generación del sitio.

---

## 8. Generador estático y SEO

### 8.1 Salida

```
dist/
├── index.html                          Home con productos reales en el HTML
├── c/{categoria}/index.html            24 páginas de categoría
├── c/{categoria}/{n}/index.html        Paginación (36 por página)
├── p/{slug}/index.html                 ~2.500 páginas de producto
├── api/
│   ├── index.json                      Índice de búsqueda (≤150 KB gzip)
│   └── c/{categoria}.json              Chunk por categoría
├── sitemap.xml                         Índice de sitemaps
├── sitemap-pages.xml
├── sitemap-products.xml
└── robots.txt
```

### 8.2 Datos estructurados

- Página de producto: JSON-LD `Product` + `Offer` (`priceCurrency: "PYG"`,
  `availability`, `seller`), Open Graph con la imagen del producto,
  `BreadcrumbList`, `<link rel="canonical">`.
- Página de categoría: `ItemList` + `BreadcrumbList`.
- Home: `Store` con WhatsApp, horarios y `areaServed: PY`.

### 8.3 Control de calidad del SEO programático

Generar 2.500 páginas es SEO programático, y Google penaliza páginas finas y
duplicadas. Por lo tanto:

- Una página de producto solo entra al sitemap si tiene **specs reales**
  (no el `[marca, categoría]` heredado), imagen propia y precio.
- Las que no cumplen se generan igual (para que el enlace interno no rompa) pero
  llevan `<meta name="robots" content="noindex,follow">` y quedan fuera del
  sitemap.
- El build reporta cuántas páginas quedaron indexables. **Es preferible tener
  800 páginas buenas que 2.500 finas.**

### 8.4 Coherencia con la navegación cliente

Las páginas generadas y la navegación por JavaScript deben producir la misma
URL para el mismo estado. El estado (`categoría`, `búsqueda`, `página`, `orden`)
se refleja en la URL vía History API. Hoy filtrar no cambia la URL, así que no
se puede compartir una búsqueda ni usar el botón "atrás".

---

## 9. Front-end

### 9.1 Modularización

`app.js` (2.006 líneas, con funciones de 538 y 396 líneas) se divide en módulos
ES con una responsabilidad cada uno:

```
public/js/
├── main.js            Arranque y cableado
├── state.js           Estado + sincronización con la URL
├── catalog.js         Carga y caché de chunks
├── search.js          Búsqueda con índice invertido
├── cart.js            Carrito y persistencia
├── modal.js           Detalle de producto
├── filters/           Un módulo por familia (gpu, ram, monitor, tv, psu, ...)
├── render/card.js     Construcción de tarjetas
└── ui/toast.js        Notificaciones
```

### 9.2 Correcciones concretas

| Problema | Corrección |
|---|---|
| `setTimeout(..., 300)` en cada render | Eliminado |
| `innerHTML` con datos de terceros | `<template>` + `cloneNode` + `textContent` |
| 4 listeners × 36 tarjetas por render | Delegación: 1 listener en el contenedor |
| Búsqueda escanea 13.000 strings por tecla | Índice invertido construido una vez |
| El estado no está en la URL | History API (`?c=&q=&p=&sort=`) |
| Imágenes sin dimensiones ⇒ salto de layout | `width`/`height` explícitos |
| Imagen rota ⇒ `card.style.display='none'` | Imagen de reemplazo; el conteo de resultados deja de mentir |
| Badge "Destacado" por IDs hardcodeados (`id<=3 \|\| id===25 \|\| ...`) | Criterio real: productos nuevos de los últimos 14 días según `firstSeen` |

### 9.3 Presupuestos de rendimiento (rompen el build)

| Recurso | Presupuesto |
|---|---|
| HTML inicial | ≤ 25 KB gzip |
| CSS | ≤ 25 KB gzip |
| JS inicial | ≤ 60 KB gzip |
| Índice de búsqueda | ≤ 150 KB gzip |
| LCP (móvil, 4G simulado) | < 2,0 s |
| CLS | < 0,05 |
| INP | < 200 ms |

Sin presupuestos verificados automáticamente, el proyecto vuelve a los 10 MB en
pocos meses. Ese es exactamente el mecanismo por el que llegó hasta acá.

---

## 10. UX, interfaz y accesibilidad

El sistema de tokens CSS existente (`--bg-main`, `--color-primary`, etc.) es
correcto y se conserva y consolida; no se reescribe el diseño desde cero.

Correcciones:

- El modal carece de `role="dialog"`, `aria-modal` y atrapado de foco: hoy se
  puede tabular "por detrás" del diálogo abierto.
- `--transition: all 0.3s` anima todas las propiedades, incluidas las que
  provocan reflow. Se reemplaza por transiciones por propiedad.
- No hay soporte de `prefers-reduced-motion`.
- Falta `aria-live` en el contador de resultados: un lector de pantalla no se
  entera de que la búsqueda cambió.
- Estados de foco visibles en todos los controles interactivos.
- Skeletons reales durante la carga, en lugar de spinner con demora artificial.
- Solo 6 media queries para 3.070 líneas de CSS: se refuerza el diseño móvil,
  que es donde está el tráfico de una tienda en Paraguay.

Se auditará con la skill `web-design-guidelines` y se verificará en un navegador
real con `claude-in-chrome`, no a ojo.

---

## 11. Infraestructura y despliegue

### 11.1 Migración de hosting

| | Vercel Hobby (actual) | Cloudflare Pages (destino) |
|---|---|---|
| Uso comercial | Prohibido por los términos | Permitido |
| Transferencia | 100 GB/mes | Ilimitada |
| Límite de archivos | — | 20.000 (se usarán ~2.600) |
| Previews por rama | Sí | Sí |
| Costo | $0 (con riesgo de suspensión) | $0 |

Componentes: **Pages** (sitio estático), **R2** (imágenes), **Web Analytics**
(reemplaza a Vercel Analytics y Speed Insights; sin cookies, sin banner de
consentimiento).

### 11.2 Secretos

| Secreto | Uso |
|---|---|
| `SUPPLIER_BASE_URL` | URL base del catálogo del proveedor |
| `SUPPLIER_IMG_BASE` | URL base de las imágenes del proveedor |
| `PRICING_CONFIG` | JSON con umbrales y porcentajes de margen |
| `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET` | Subida de imágenes |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | Despliegue |

Ninguna de estas cadenas aparece en el código versionado.

### 11.3 Cron

El workflow nocturno se pausa durante la refactorización (se comenta el
`schedule`, se conserva `workflow_dispatch`) y se reactiva en la Fase 4 con el
formato nuevo. Sin esto, los commits diarios del bot a `main` colisionan con la
migración del formato de datos.

---

## 12. Reglas y forma de trabajo

### 12.1 Problema

Tres documentos en prosa que se contradicen entre sí (hallazgo 16). `AGENTS.md`
afirma "+100.000 fijo para todo, 1.940 productos, categoría Relojes Mi Band";
`CLAUDE.md` afirma tres reglas de margen y 18 categorías. Las reglas escritas en
prosa se desincronizan siempre: es cuestión de tiempo, no de disciplina.

### 12.2 Cambios

1. **Un solo documento**: `AGENTS.md` en la raíz es la fuente de verdad.
   `CLAUDE.md` queda como stub que apunta a él. Se eliminan
   `REGLAS_PROYECTO_AXTECH.md` y `.agents/AGENTS.md` (fusionados, no perdidos).
2. **Las reglas numéricas salen de la prosa y viven en código**: márgenes en
   `pricing.js` + `pricing.config.json`; categorías y marcas en `taxonomy.js`;
   traducciones en `normalize.js`. La documentación **cita** el código, nunca lo
   duplica. Lo que no se puede duplicar no se puede desincronizar.
3. **Cada regla de negocio tiene un test**. Romper una regla deja de ser posible
   en silencio.
4. **CI en cada PR**: validación del catálogo + tests + presupuestos de tamaño +
   verificación de campos prohibidos + auditoría SEO.
5. **Flujo de trabajo**: ramas + previews de Cloudflare; nada entra a `main` sin
   pasar CI.
6. `historia_de_conversacion.md` (267 KB) sale del repositorio. Los assets sin
   usar (5,3 MB) también.

### 12.3 Skills del proyecto

Las tres skills actuales viven en `.agents/skills/`, que no es un formato
invocable por Claude Code — son scripts sueltos con un README, y describen
reglas ya obsoletas (el margen de +100.000 fijo). Se reconstruyen como skills
reales en `.claude/skills/`:

| Skill | Responsabilidad |
|---|---|
| `axtech-catalog` | Valida integridad, precios, clasificación, duplicados y cobertura de campos. Genera el reporte de salud del catálogo. |
| `axtech-sync` | Cómo correr y depurar el scraper, con fixtures offline y diff de cambios. |
| `axtech-release` | Checklist ejecutable: validar → tests → build → presupuestos → SEO → preview → verificar → promover. |
| `axtech-pricing` | El motor de precios y cómo ajustar márgenes sin romper invariantes. |

---

## 13. Estrategia de testing

Hoy hay cero tests. Se usa `node:test` (incluido en Node, sin dependencias), lo
que es coherente con la filosofía sin-frameworks del proyecto.

| Módulo | Enfoque |
|---|---|
| `pricing.js` | TDD. Las 6 invariantes de §5.3. |
| `taxonomy.js` | TDD. Mapa de slugs; ningún descarte silencioso. |
| `normalize.js` | TDD. Traducción, mojibake, limpieza de títulos. |
| `contract.js` | TDD. Ningún campo prohibido sobrevive a la proyección. |
| `sync/parse.js` | Fixtures de HTML real guardado; sin red. |
| `sync/index.js` | Safeguards: categoría vacía, red caída, purga a 30 días. |
| `build/*` | Snapshot de la salida generada; validez del JSON-LD. |
| Front | Verificación en navegador real con `claude-in-chrome`. |

---

## 14. Fases y criterios de aceptación

### Fase 0 — Seguridad de datos, hosting y limpieza

**Por qué primero**: hay una fuga activa de información comercial y el hosting
actual está fuera de los términos del proveedor. Ambas cosas se resuelven juntas
porque recrear el repositorio rompe la conexión con el hosting: conviene cortar
una sola vez.

- Pausar el cron nocturno (comentar `schedule`, conservar `workflow_dispatch`).
- Migrar `products.js` → `data/catalog.json` con el contrato de §4.1.
- Mover proveedor y configuración de precios a Secrets / variables de entorno.
- Purgar zombis, fusionar `Relojes Mi Band` / `Relojes Smart`, eliminar
  duplicados, borrar assets sin usar y `historia_de_conversacion.md`.
- Recrear el repositorio de GitHub limpio (sin el historial con costos).
- Conectar Cloudflare Pages al repositorio nuevo y apuntar el sitio ahí.

**Aceptación**: ningún campo prohibido ni el dominio del proveedor aparece en el
repositorio ni en lo servido; el sitio funciona igual que antes, ahora sobre
Cloudflare Pages.

### Fase 1 — Precios, datos y front modular

- `pricing.js`, `taxonomy.js`, `normalize.js`, `contract.js` con sus tests.
- Recalcular todos los precios con el modelo híbrido, con reporte de diff previo
  a publicar.
- Chunking de datos e índice de búsqueda.
- Modularizar `public/js/`; correcciones de §9.2.
- **Migración inicial de imágenes a R2** (§7.2), como script único que procesa
  el catálogo completo. Cierra por completo la exposición del proveedor y activa
  la verificación de §4.3. En la Fase 4 este mismo módulo se integra al sync
  para procesar solo las imágenes nuevas.
- Cloudflare Web Analytics en reemplazo de Vercel Analytics y Speed Insights.

**Aceptación**: JS inicial ≤ 60 KB gzip; índice ≤ 150 KB gzip; ninguna
referencia al proveedor en lo servido; el sitio funciona igual que antes con
todos los presupuestos en verde.

### Fase 2 — SEO real

- Generador estático: home, 25 categorías, páginas de producto.
- JSON-LD, Open Graph, canonical, breadcrumbs.
- Sitemaps segmentados; `robots.txt` actualizado.
- Umbral de calidad: sin specs reales ⇒ `noindex` y fuera del sitemap.

**Aceptación**: cada producto indexable tiene URL propia con datos
estructurados válidos; el sitemap solo contiene páginas que superan el umbral.

### Fase 3 — Interfaz, accesibilidad y movimiento

- Auditoría con `web-design-guidelines`; consolidación del sistema de tokens.
- Accesibilidad del modal, foco, `aria-live`, `prefers-reduced-motion`.
- Refuerzo del diseño móvil; skeletons; movimiento revisado.

**Aceptación**: sin violaciones críticas de accesibilidad; LCP < 2,0 s y
CLS < 0,05 medidos en un navegador real con red móvil simulada.

### Fase 4 — Sync robusto, tests y CI

- Reescritura del sync según §7, con fixtures y tests.
- Pipeline de imágenes a R2.
- `ci.yml`: validación, tests, presupuestos, campos prohibidos, SEO.
- Las 4 skills del proyecto.
- Reactivar el cron con el formato nuevo.

**Aceptación**: una corrida completa con el proveedor caído no degrada el
catálogo; CI en verde; el cron vuelve a publicar solo.

---

## 15. Riesgos

| Riesgo | Mitigación |
|---|---|
| El proveedor cambia su HTML y el parser se rompe | Fixtures + safeguards por categoría + alertas en el reporte; el catálogo previo se conserva intacto |
| Google tarda meses en indexar 2.500 páginas nuevas | Sitemaps segmentados, enlazado interno desde las categorías, y umbral de calidad para no diluir el presupuesto de rastreo |
| El scraping puede ser bloqueado por el proveedor | Concurrencia limitada, `User-Agent` honesto, backoff. Es el mismo riesgo que hoy, no uno nuevo |
| Recrear el repositorio rompe la conexión con el hosting | Se hace junto con la migración a Cloudflare en la Fase 0, no como paso aislado |
| Durante la Fase 0 el dominio del proveedor sigue visible en el HTML servido (imágenes enlazadas directamente) | Es el estado actual, no una regresión: lo urgente —costos y márgenes— queda cerrado en la Fase 0. La exposición del proveedor se cierra en la Fase 1 con la migración a R2, momento en que se activa la verificación de §4.3 |
| Los nuevos porcentajes de margen dejan precios fuera de mercado | El cambio es un solo archivo, reversible; conviene revisar una muestra de categorías antes de publicar |
| El ajuste de precios cambia el precio de 2.524 productos de golpe | El reporte de diff lista todos los cambios antes de publicar, para revisión |

---

## 16. Fuera de alcance

Explícitamente **no** forma parte de este trabajo:

- Growth y marketing (CRO, copywriting de conversión, AI SEO, analítica de
  atribución, alta en directorios, contenido editorial). Corresponde a una
  eventual Fase 5.
- Carrito con pago en línea. El cierre sigue siendo por WhatsApp.
- Panel de administración.
- Multi-idioma o multi-moneda.
- Migración a un framework (React, Astro u otro): descartada en D1.
