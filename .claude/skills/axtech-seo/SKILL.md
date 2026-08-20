---
name: axtech-seo
description: Usar al tocar src/lib/seo.js, src/build/sitemap.js o robots.txt, al cambiar canonicals, noindex, datos estructurados o meta descriptions, cuando Google no indexa paginas o reporta errores de cobertura, al revisar Search Console, o cuando alguien pregunta por que la tienda no aparece en las busquedas. Cubre tambien la trampa del soft 404 de Cloudflare Pages.
---

# SEO e indexacion

El sitio son ~5.300 paginas estaticas generadas en cada build. Lo tecnico esta
resuelto; lo que falta no se arregla con codigo.

## Lo que ya esta bien (no romperlo)

| Pieza | Estado |
|---|---|
| `robots.txt` | permite todo y declara el sitemap |
| `sitemap.xml` | indice que apunta a `sitemap-N.xml`, 4.295 URLs |
| `/404.html` | devuelve **404 de verdad**, con `noindex` y sin canonical |
| canonical | en cada producto y categoria; ausente a proposito en el error |
| JSON-LD | `Product`, `ItemList`, `BreadcrumbList`, `Store` |

## La trampa del soft 404

Cloudflare Pages, si no existe `dist/404.html`, responde **200 con la home**
para cualquier URL inexistente. Google lo llama soft 404 y lo trata como
contenido duplicado en escala: cada URL rota es una copia mas de la portada.

Estuvo asi hasta que se detecto. La verificacion es una linea y hay que
correrla despues de cada cambio en el build:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://axtech.pages.dev/p/no-existe-999999/
# tiene que decir 404, no 200
```

Por eso `dist/404.html` es requisito del build (regla 4 de `AGENTS.md`) y tiene
test propio en `test/build/pagina-error.test.js`.

**La pagina de error no lleva canonical.** Un canonical hacia si misma le dice
a Google que la pagina existe; uno hacia la home le dice que son la misma cosa.
Las dos opciones son peores que ninguna.

## No todas las paginas van al sitemap

`esIndexable()` en `src/lib/seo.js` decide. Exige precio valido, titulo de 25
caracteres o mas, y marca real o al menos una especificacion detectada.

Las que no califican **se generan igual** — el enlazado interno tiene que
funcionar y el usuario tiene que poder llegar — pero llevan `noindex,follow` y
quedan fuera del sitemap.

El criterio es deliberado: **es mejor tener 4.000 paginas buenas que 5.300
mediocres.** Google penaliza el dominio entero cuando se le sirven miles de
paginas finas. Aflojar este filtro para "indexar mas" es exactamente el error
que evita.

De las categorias, **solo la primera pagina** entra al sitemap. Las paginadas
existen, se enlazan y llevan su canonical, pero no se le ofrecen a Google.

## GENERIC nunca sale al HTML

`GENERIC` es la etiqueta interna de "marca no detectada". Publicarla en el
JSON-LD le declaraba a Google un fabricante llamado GENERIC en 1.193 productos.
En los datos estructurados se reemplaza por `AXTECH`.

Misma logica en cualquier campo derivado: lo que es un marcador interno no se
publica.

## El problema real esta afuera del codigo

Search Console dice **"No se ha detectado ningun sitemap de referencia"** y el
sitio no tiene **ni un solo backlink**. Eso no lo arregla ningun cambio en el
repositorio: sin enlaces entrantes, Google no tiene motivo para gastar
rastreo en un dominio nuevo.

Lo que mueve la aguja, en orden:

1. Poner el link del sitio en las biografias de Instagram (`@axtech_py`) y
   Facebook. Es gratis y es el primer backlink.
2. Directorios y listados locales de comercios paraguayos.
3. Un dominio propio (`axtech.com.py`) en vez de `pages.dev`.

**"Solicitar indexacion" tiene cuota diaria** y se agota rapido. Ya fallo dos
veces por eso. No sirve para 4.295 URLs: es para forzar una pagina puntual.
Insistir con eso en lugar de conseguir enlaces es perder el tiempo.

## Verificar en vivo

```bash
curl -s -o /dev/null -w "sitemap %{http_code}\n" https://axtech.pages.dev/sitemap.xml
curl -s -o /dev/null -w "404     %{http_code}\n" https://axtech.pages.dev/p/no-existe-999999/
curl -s -o /dev/null -w "home    %{http_code}\n" https://axtech.pages.dev/
```

El build ya reporta paginas generadas, cuantas llevan noindex y cuantas URLs
quedaron en el sitemap. Si ese numero cae de golpe entre dos corridas, el
problema es `esIndexable` o el catalogo, no Google.

## Antes de tocar nada de esto

- Un canonical mal puesto saca paginas del indice de forma silenciosa. Cambiar
  canonicals o `noindex` **siempre** con test.
- Nada de lo que se publique puede traer datos de costo o del proveedor. El
  guard de `src/build/guard.js` bloquea el build si aparecen; ver `axtech-release`.
- `robots.txt` se copia tal cual desde la raiz (`ESTATICOS` en
  `src/build/index.js`). No se genera.
