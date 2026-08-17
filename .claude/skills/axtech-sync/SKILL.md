---
name: axtech-sync
description: Usar cuando el sync nocturno del catalogo falla, cuando hay que forzar una sincronizacion a mano, cuando el proveedor cambia el formato de la lista de precios, o cuando alguien pregunta por que un producto no aparece / aparece con precio viejo. Cubre src/sync/, los frenos y el workflow sync.yml.
---

# Sincronizacion del catalogo

El sync corre solo a las 23:00 de Paraguay (`.github/workflows/sync.yml`).
Nadie tiene que hacer nada. Esta skill es para cuando algo se sale de eso.

## Como esta armado

```
descargar.js   unica pieza con red. fetch inyectable, reintentos, latin1
verificar.js   los frenos. puro: recibe numeros, devuelve problemas
aplicar.js     fusion y purga. puro: no lee, no escribe, no imprime
ejecutar.js    orquestador. unico con disco, red y consola
```

El orden **no se altera**:

```
descargar -> parsear -> VERIFICAR LA LISTA -> aplicar -> purgar ->
VERIFICAR LOS CAMBIOS -> recien ahi escribir
```

Verificar despues de calcular y antes de escribir es lo que permite abortar
con el catalogo intacto.

## El sync fallo. Que hago

1. Abrir el run en Actions y leer el paso que fallo.
2. Si fallo **"Sincronizar"**, el mensaje dice cual freno salto y por que. No
   tocar nada del catalogo: el sync no escribio.
3. Reproducirlo local para ver el detalle completo:

```bash
cd C:\Page
node --env-file=.env src/sync/ejecutar.js      # simula, no escribe
```

4. Decidir segun el freno:

| Freno | Qué significa casi siempre | Qué hacer |
|---|---|---|
| lista por debajo del minimo | la descarga se corto, o el proveedor devolvio una pagina de error | esperar y reintentar; si persiste, revisar el formato |
| caida del N% | el proveedor recorto su catalogo de verdad, o cambio el formato | comparar con la lista de ayer antes de forzar |
| tipo de cambio fuera de rango | `PRICING_CONFIG` mal cargado | corregir el secreto |
| se ocultaria mas del 10% | consecuencia de una lista incompleta | no forzar sin entender |
| saltaria de precio mas del 5% | **casi siempre es el tipo de cambio**, no el proveedor | verificar `tipoDeCambio` antes que nada |
| la purga borraria mas del 5% | acumulacion normal tras la migracion, o un error anterior | revisar que sean productos viejos de verdad |

5. Si el resultado es correcto pese al freno, forzarlo **a mano**, nunca en CI:

```bash
node --env-file=.env src/sync/ejecutar.js --aplicar --forzar
node --env-file=.env src/images/ejecutar.js
git add -A && git commit -m "chore: sync forzado" && git push
```

## Sincronizar a mano

```bash
node --env-file=.env src/sync/ejecutar.js              # simula
node --env-file=.env src/sync/ejecutar.js --aplicar    # aplica
node --env-file=.env src/images/ejecutar.js            # imagenes de lo nuevo
git add -A && git commit -m "chore: actualizar catalogo" && git push
```

Es seguro repetirlo: el precio sale del dolar de la lista, no del precio
anterior.

Banderas: `--archivo RUTA` usa un `.txt` local en vez de descargar,
`--sin-purga` no borra nada, `--forzar` ignora los frenos.

## El proveedor cambio el formato de la lista

Se nota porque el parser deja de reconocer lineas y el freno del minimo salta.
El catalogo **no** se toca.

1. Bajar la lista y mirar una linea real.
2. Ajustar `LINEA` en `src/lib/lista-precios.js`.
3. Regenerar la fixtura con el formato nuevo: editar `test/fixtures/generar.js`
   (datos inventados, nunca los reales) y correr `node test/fixtures/generar.js`.
4. `npm test` y despues una simulacion antes de aplicar.

## "Este producto no aparece en la web"

En orden, es una de estas cuatro:

1. **No figura en la lista.** Figurar es lo que define si se publica. Esta
   `hidden` y sin precio.
2. **No tiene imagen.** Su id esta en `data/sin-imagen.json`. La regla 3
   prohibe publicarlo.
3. **No clasifica.** Su titulo no matchea ninguna regla de `taxonomy.js` y
   nunca tuvo categoria. Cuenta en `sin clasificar` del informe.
4. **Esta activo pero con `noindex`.** Existe y se ve en el sitio; solo esta
   fuera de Google por la compuerta de calidad (`src/lib/seo.js`).

## Cosas que ya se rompieron aca

- **El precio congelado en silencio.** Si el titulo de un producto ya
  catalogado deja de clasificar, no se puede descartar: sigue publicado y
  sigue en la lista, asi que tampoco se oculta, y su precio queda viejo para
  siempre. `aplicar.js` hereda la categoria que tenia. Le pasaba a 6 activos.
- **La reutilizacion de ids.** `ultimoId` vive en `data/meta.json` y nunca
  retrocede. Si se dedujera del catalogo con `Math.max`, tras purgar los ids
  altos un producto nuevo heredaria la imagen del producto borrado.
- **`lastSeen` al ocultar.** No se toca. Es la fecha que cuenta los 30 dias de
  gracia de la purga; pisarla hace que nada se purgue nunca.
