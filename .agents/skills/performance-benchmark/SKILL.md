---
name: performance-benchmark
description: Mide la velocidad de carga y parseo del catálogo, y el rendimiento de las consultas de búsqueda de productos de AXTECH.
---

# AXTECH Performance Benchmark Skill

Esta skill permite medir objetivamente la velocidad de la base de datos de productos de AXTECH y del motor de búsqueda multipalabra, para garantizar que la experiencia de usuario permanezca ultra fluida y rápida (< 10ms por búsqueda).

## Uso

Para ejecutar las pruebas de velocidad y rendimiento, corre:

```powershell
node .agents/skills/performance-benchmark/scripts/benchmark.js
```

## Pruebas que realiza:
1. **Velocidad de Carga y Parseo**: Mide cuánto tarda Node.js en leer e interpretar los +4.700 productos de `products.js`.
2. **Prueba de Búsqueda del Motor de app.js**: Ejecuta varias consultas de búsqueda complejas (como `"RTX 4060 Asus"`, `"SSD 1TB Kingston"`, `"Monitor Gamer Curved"`) simulando el algoritmo de `app.js` sobre todo el catálogo, y calcula el tiempo de respuesta promedio.
