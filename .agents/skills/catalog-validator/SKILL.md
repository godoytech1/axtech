---
name: catalog-validator
description: Valida el formato, integridad, duplicados, margen de ganancia de 100.000 Gs. e imágenes reales del catálogo de productos de AXTECH.
---

# AXTECH Catalog Validator Skill

Esta skill permite verificar que la base de datos local `products.js` cumple rigurosamente con las reglas de negocio y consistencia técnica definidas en el proyecto.

## Uso

Para ejecutar las validaciones del catálogo, corre:

```powershell
node .agents/skills/catalog-validator/scripts/validate.js
```

## Reglas que verifica:
1. **Sintaxis de JavaScript**: Asegura que el archivo sea ejecutable y exporte/defina el array global `PRODUCTS`.
2. **Sin Duplicados**: Valida que no existan códigos de referencia (`ref`) duplicados ni identificadores de base de datos (`id`) repetidos.
3. **Margen de Ganancia**: Comprueba que la regla `pyg = pyg_orig + 100.000 Gs.` se aplique exactamente a todos los productos activos (los que no están bajo consulta).
4. **Validación de Imagen**: Confirma que ningún producto tenga asignada la imagen vacía por defecto de TopDek (`PRODUTO SEM IMAGEM` con hash MD5 o tamaño conocido).
5. **Nombres de Marcas**: Asegura que las marcas detectadas estén normalizadas y en mayúsculas de acuerdo a la lista aprobada.
