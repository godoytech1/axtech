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
npm test                                   # Tests
node --env-file=.env src/build/index.js     # Build a dist/
node --env-file=.env src/images/ejecutar.js # Descargar imagenes faltantes
node src/migrate/importar-lista.js          # Simular la importacion de la lista
node src/migrate/importar-lista.js --aplicar # Aplicarla
npm run migrate                            # Migración única del catálogo legado
```

## Flujo de trabajo

- Se trabaja en ramas, nunca directo en `main`.
- Cada PR debe pasar CI: tests + build + guard de fugas.
- El sync nocturno está **pausado** durante las Fases 0–3. El scraper legado
  quedó fuera de este repositorio a propósito: su nombre y su contenido
  identifican al distribuidor, y este repositorio es público. Está resguardado
  en el repositorio privado `axtech-legacy` y en `.local-legacy/` (ignorado por
  git). La Fase 4 lo reescribe desde cero, leyendo el origen desde un secreto.

## Documentos de diseño

- Diseño general: `docs/superpowers/specs/2026-08-14-axtech-overhaul-design.md`
- Plan de la Fase 0: `docs/superpowers/plans/2026-08-15-axtech-fase-0.md`
