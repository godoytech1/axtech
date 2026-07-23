---
name: seo-auditor
description: Analiza la estructura de index.html, sitemap.xml y robots.txt de AXTECH para asegurar el cumplimiento de las directrices de SEO y restricciones de marca.
---

# AXTECH SEO Auditor Skill

Esta skill permite auditar de forma automatizada las mejores prácticas de SEO e indexación técnica, además de comprobar que no se violen las prohibiciones de marca (como evitar el uso no autorizado de "Paraguay" en títulos).

## Uso

Para ejecutar la auditoría de SEO, corre:

```powershell
node .agents/skills/seo-auditor/scripts/audit.js
```

## Reglas que verifica:
1. **Título Principal (Meta Title)**: Debe ser exactamente `AXTECH | Tu Tienda de Tecnología y Hardware`.
2. **Meta Description**: Comprueba que exista la etiqueta y que sea atractiva para los buscadores sin usar palabras clave prohibidas.
3. **Encabezado Único (H1)**: Valida que haya exactamente una etiqueta `<h1>` en el documento HTML.
4. **Accesibilidad en Imágenes (Alt text)**: Verifica que todas las etiquetas `<img>` tengan configurado el atributo descriptivo `alt` (importante para el rastreo e indexación).
5. **Configuración de Rastreo (Robots y Sitemap)**: Asegura que el archivo `robots.txt` sea válido y referencie adecuadamente la ruta del mapa del sitio (`sitemap.xml`).
