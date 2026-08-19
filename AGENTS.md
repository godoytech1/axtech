# AXTECH — Reglas del Proyecto

Fuente de verdad única. Si algo de este documento contradice al código, **el
código gana** y este documento se corrige.

## Principio rector

Las reglas numéricas no viven en prosa. Viven en código, con tests:

| Regla | Dónde vive | Tests |
|---|---|---|
| Campos públicos permitidos | `src/lib/contract.js` | `test/lib/contract.test.js` |
| Detección de fugas | `src/build/guard.js` | `test/build/guard.test.js` |
| Formato de precios | `src/lib/formato.js` | `test/lib/formato.test.js` |
| Slugs de URL | `src/lib/slug.js` | `test/lib/slug.test.js` |
| Precios y márgenes | `src/lib/pricing.js` + `config/pricing.config.json` | `test/lib/pricing.test.js` |
| Categorías y marcas | `src/lib/taxonomy.js` | `test/lib/taxonomy.test.js` |
| Traducciones PT→ES y mojibake | `src/lib/normalize.js` | `test/lib/normalize.test.js` |

Este documento explica el *porqué*. Nunca duplica los valores.

Esta regla nació de un problema real: antes existían tres documentos
(`CLAUDE.md`, `REGLAS_PROYECTO_AXTECH.md` y `.agents/AGENTS.md`) que se
contradecían entre sí sobre el margen, la cantidad de productos y las
categorías. Lo que no se puede duplicar no se puede desincronizar.

## Reglas que no se negocian

1. **Ningún dato de costo, margen o proveedor sale al repositorio ni a `dist/`.**
   Verificado por `src/build/guard.js`; el build falla si aparece alguno.
   Los campos prohibidos están en `CAMPOS_PROHIBIDOS` (`src/lib/contract.js`).
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
   Las imágenes se descargan **una sola vez**, se convierten a WebP (máx.
   800 px) y se versionan en `public/img/`. El sitio no depende de que el
   proveedor esté en línea. El build lo verifica contra el secreto
   `SUPPLIER_NAME` y **falla si aparece en la salida**.
7. **Los secretos no se pegan en chats, issues ni logs.** Van en `.env` local
   (ignorado por git) y en GitHub Secrets.
8. **Los porcentajes de margen son secretos.** `config/pricing.config.json` no
   se versiona: la fórmula de precios es invertible, así que publicar los
   porcentajes equivale a publicar los costos.
9. **No existe categoría de descarte.** Un producto que no se puede clasificar
   se marca `hidden` y se reporta. Nunca se lo mete en un cajón de sastre: así
   fue como el 41,3% del catálogo terminó en "Periféricos".
10. **Los precios se calibran contra el mercado, no a ojo.** El objetivo es
    quedar 15-17% por debajo del minorista de Asunción. Referencias usadas:
    Master Tech, Nissei, Compras Paraguai.
11. **Una opción de filtro solo reclama un producto si hay evidencia en el
    título.** Sin evidencia, la función devuelve `null` y el producto queda
    visible en la categoría pero fuera de todas las casillas. Ninguna función
    de `app.js` puede terminar en un `return` fijo que adivine
    (`return 'PC'`, `return 'NVIDIA'`, `return 'INTEL'`): una función que
    adivina no falla nunca, la consola queda limpia y lo único que pasa es
    que el filtro miente. Protegido por `test/front/filtros.test.js`.
    La única excepción documentada es `getNotebookType`, porque "gamer" y
    "ofimática" son un segmento de venta, no un dato físico.
12. **Una característica del producto nunca le gana a lo que el producto es.**
    `C/Cable`, `S/Fuente`, `Con Fuente`, `C/CONTROLE` y `FOR XBOX` describen
    lo que el aparato trae o con qué es compatible. Es el error más repetido
    de la taxonomía: ya se llevó cables, fuentes, ventiladores de techo,
    tiras de LED y hasta un collar para perros a la categoría equivocada.
    Cada caso resuelto tiene su par de tests en `test/lib/taxonomy.test.js`:
    uno que verifica que el intruso se fue y otro que el producto legítimo
    sigue donde estaba.

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
La fuente de precios es la LISTA OFICIAL del proveedor, que se descarga desde
su web y se guarda en `.local-legacy/listas-proveedor/` (ignorado por git:
contiene costos y su nombre). Es mejor fuente que raspar: completa (5.994
productos contra los 2.511 que alcanzaba el scraper), autoritativa, y no se
rompe cuando cambia su plantilla HTML. Figurar en la lista es lo que define si
un producto se publica.

```
data/catalog.json   fuente de verdad (sin costos, sin proveedor)
public/img/*.webp   imagenes propias (el proveedor no interviene)
       ↓ src/build
dist/               lo único que se despliega
```

- **Stack**: HTML5, CSS3 vanilla, JavaScript ES6+ vanilla. Sin frameworks.
- **Sin dependencias de producción.** Tests con `node:test`.
- **Hosting**: Cloudflare Pages. Imágenes en Cloudflare R2 (desde la Fase 1).
- **Node**: ≥ 20.

## Comandos

```bash
npm test                                          # Tests
node --env-file=.env src/build/index.js           # Build a dist/
node --env-file=.env src/sync/ejecutar.js         # Sync: simula, no escribe
node --env-file=.env src/sync/ejecutar.js --aplicar
node --env-file=.env src/images/ejecutar.js       # Descargar imagenes faltantes
npm run migrate                                   # Migración única del catálogo legado
```

Banderas del sync: `--aplicar` escribe; `--archivo RUTA` usa un `.txt` local en
vez de descargar; `--sin-purga` no borra nada; `--forzar` ignora los frenos.

## Flujo de trabajo

- Se trabaja en ramas, nunca directo en `main`.
- Cada PR debe pasar CI: tests + build + guard de fugas.
- El **sync nocturno** corre solo (`.github/workflows/sync.yml`) y commitea
  sobre `main`. El scraper legado quedó fuera de este repositorio a propósito:
  su nombre y su contenido identifican al distribuidor, y este repositorio es
  público. Fue reemplazado por `src/sync/`, que lee la lista oficial desde el
  secreto `SUPPLIER_LIST_URL`.

### Skills del proyecto

En `.claude/skills/`. Describen **procedimientos**; las reglas viven acá y no
se duplican.

| Skill | Para qué |
|---|---|
| `axtech-sync` | el sync falló, forzar una corrida, cambió el formato de la lista |
| `axtech-catalog` | taxonomía, marcas, productos mal clasificados |
| `axtech-pricing` | márgenes, tipo de cambio, un precio que se ve raro |
| `axtech-release` | publicar, el guard bloqueó el build, CI en rojo |

## Documentos de diseño

- Diseño general: `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md`
- Plan de la Fase 0: `docs/superpowers/plans/2026-08-15-axtech-fase-0.md`

## Estructura de URLs

```
/                     home (SPA)
/c/{categoria}/       29 categorias
/c/{categoria}/{n}/   paginacion
/p/{slug}/            una por producto
/sitemap.xml          indice de sitemaps
```

Las páginas de producto son **autónomas**: no descargan el catálogo completo.

**Compuerta de calidad**: una página se indexa solo si tiene precio, título de
25 caracteres o más, y marca conocida o al menos una especificación. Las demás
se generan con `noindex` y quedan fuera del sitemap. Publicar miles de páginas
finas perjudica al dominio entero.

Las especificaciones se extraen del título (`src/lib/specs.js`): el proveedor
no las entrega estructuradas, pero sus títulos son densos.

## Sincronización del catálogo

**El sync corre solo todas las noches** (`.github/workflows/sync.yml`, 23:00 de
Paraguay). Descarga la lista oficial, recalcula precios, publica lo nuevo,
oculta lo que desapareció y purga lo que lleva 30 días ausente. Si algo no
cierra, **aborta sin escribir**: el catálogo queda como estaba y el workflow
sale en rojo.

No hace falta hacer nada a mano. Para forzar una corrida:

```bash
node --env-file=.env src/sync/ejecutar.js              # simula: muestra qué cambiaría
node --env-file=.env src/sync/ejecutar.js --aplicar    # aplica
node --env-file=.env src/images/ejecutar.js            # baja imágenes de lo nuevo
git add -A && git commit -m "chore: actualizar catalogo" && git push
```

El push dispara el despliegue solo.

**Es seguro repetirlo.** El precio sale del dólar de la lista, no del precio
anterior, así que correrlo dos veces da el mismo resultado. No confundir con
`refinar-catalogo.js`, que **no** es idempotente y por eso aborta si detecta
que ya se aplicó.

**La hora importa.** El proveedor regenera su lista **durante el día hábil**.
Con el cron a las 04:00 el sync bajaba la lista del día anterior y la tienda
quedaba siempre un día hábil atrasada: medido el lunes 17/08, a las 04:00 traía
la lista del sábado (5.949 productos) y esa misma tarde la lista en vivo ya
tenía 5.971. A las 23:00 el proveedor ya cerró y publicó los precios del día.

### Los frenos

Viven en `src/sync/verificar.js` y se verifican **dos veces**: la lista
descargada antes de tocar el catálogo, y los cambios ya calculados antes de
escribirlos. Abortan si la lista trae menos de 4.000 productos, si cae más del
15% contra la corrida anterior, si el tipo de cambio está fuera de 3.000–15.000,
si se ocultaría más del 10% de los activos, si saltaría de precio más del 5%, o
si la purga borraría más del 5% del catálogo.

Existen por un escenario concreto: el proveedor devuelve un 503, el parser lee
cero productos, ningún producto figura en la lista, y los 5.286 activos se
ocultan. Sin frenos, el sitio amanece vacío.

Si un freno salta y el resultado igual es correcto, se repite con `--forzar`
**a mano**. Nunca en CI.

### Si el proveedor cambia el formato de la lista

Los tests del parser corren contra fixtures sintéticas
(`test/fixtures/lista-*.txt`, se regeneran con `node test/fixtures/generar.js`).
Si el formato real cambia, el parser deja de reconocer líneas, la lista queda
por debajo del mínimo y el sync aborta **antes** de tocar nada. Ahí hay que
ajustar `LINEA` en `src/lib/lista-precios.js` y la fixtura.

## Estado del proyecto

| Fase | Estado |
|---|---|
| F0 — Seguridad de datos, hosting y limpieza | ✅ |
| F1A — Taxonomía, normalización y precios | ✅ |
| F1B — Imágenes propias y correcciones del front | ✅ |
| F1C — Catálogo completo desde la lista | ✅ |
| F2 — SEO: página por producto y categoría | ✅ |
| F3 — Accesibilidad, movimiento y táctil | ✅ |
| F4 — Sync automático, frenos, tests y CI | ✅ |

El proyecto ya no depende de que nadie haga nada: el catálogo se actualiza
solo todas las noches y se despliega solo.

### Qué queda abierto

- **Chunking del catálogo.** `dist/products.js` supera el presupuesto de
  150 KB gzip, y `app.js` sigue en un solo archivo de ~2.000 líneas. Las dos
  cosas se resuelven juntas: partir `app.js` en módulos ES obliga a cambiar la
  entrega de datos, porque los módulos no ven las globales `PRODUCTS` y
  `CATEGORIES`.
- **721 productos de la lista sin publicar.** Son líneas de negocio distintas
  (electrodomésticos, movilidad eléctrica, cuidado personal, muebles,
  proyectores, drones). Incorporarlas es una decisión comercial, no técnica.
- **243 productos activos sin imagen real.** El proveedor sirve un placeholder
  para ellos. No se publican: regla 3.

### Pendientes fuera del código

- **Google Search Console**: dar de alta `https://axtech.pages.dev` y enviar
  `sitemap.xml`. Sin esto, las URLs pueden tardar meses en indexarse. El
  archivo de verificación va en `public/static/`.
- **Token de GitHub**: revocar cualquier token viejo que haya quedado activo.
- **Vigilar la primera purga.** Ningún producto se purgó todavía: la migración
  dejó a todo el catálogo con `lastSeen` del 2026-08-15, así que los primeros
  borrados caen alrededor del 2026-09-14 y serán muchos (unos 9.700 registros
  heredados del scraper viejo). El freno del 5% va a saltar y hay que
  revisarlos antes de forzar.

### Dato de negocio a tener presente

El costo está ~4,3 % **por encima** del precio minorista de Ciudad del Este
para los mismos modelos: no hay descuento mayorista. Es lo que define lo
angosto del margen y por qué los precios se calibran midiendo, no a ojo.
