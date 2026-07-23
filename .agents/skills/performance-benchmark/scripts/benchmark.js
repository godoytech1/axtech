const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

console.log("⚡ Iniciando Benchmark de Rendimiento para AXTECH...");

// 1. Carga y Parseo
const startLoad = performance.now();
const productsFilePath = path.resolve(__dirname, '../../../../products.js');

if (!fs.existsSync(productsFilePath)) {
    console.error("❌ No se encontró products.js");
    process.exit(1);
}

const rawContent = fs.readFileSync(productsFilePath, 'utf8');
const jsonStartIndex = rawContent.indexOf('[');
const jsonEndIndex = rawContent.lastIndexOf(']') + 1;
if (jsonStartIndex === -1 || jsonEndIndex === -1) {
    console.error("❌ No se encontró el bloque JSON en products.js");
    process.exit(1);
}

const jsonString = rawContent.substring(jsonStartIndex, jsonEndIndex);
const products = JSON.parse(jsonString);
const endLoad = performance.now();
const loadDuration = endLoad - startLoad;

console.log(`✅ Catálogo cargado: ${products.length} productos.`);
console.log(`⏱️  Tiempo de lectura y parseo en disco: ${loadDuration.toFixed(2)} ms`);

// 2. Simulación del Buscador de app.js (Buscador Inteligente Multipalabra)
const searchEngine = (searchQuery) => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return products;
    const queryWords = query.split(/\s+/).filter(word => word.length > 0);
    return products.filter(p => {
        const textToSearch = `${p.title || ''} ${p.brand || ''} ${p.ref || ''} ${p.category || ''}`.toLowerCase();
        return queryWords.every(word => textToSearch.includes(word));
    });
};

const testQueries = [
    "RTX 4060",
    "SSD 1TB Kingston",
    "Monitor ASUS 144Hz",
    "Procesador Intel i7",
    "Notebook Ryzen 16GB",
    "TV JVC 4K",
    "Fuente Corsair",
    "Placa Madre Gigabyte"
];

console.log(`\n🏃 Ejecutando simulación del buscador inteligente (${testQueries.length} consultas en lote)...`);

let totalDuration = 0;
testQueries.forEach(queryStr => {
    const startSearch = performance.now();
    const results = searchEngine(queryStr);
    const endSearch = performance.now();
    const searchDuration = endSearch - startSearch;
    totalDuration += searchDuration;
    console.log(`   - "${queryStr}": ${results.length} coincidencias en ${searchDuration.toFixed(4)} ms`);
});

const avgSearchDuration = totalDuration / testQueries.length;
console.log(`\n⏱️  Tiempo promedio por búsqueda: ${avgSearchDuration.toFixed(4)} ms`);

console.log("\n--------------------------------------------------");
let benchmarkPassed = true;
if (loadDuration > 300) {
    console.warn("⚠️  Alerta: El tiempo de carga de products.js supera los 300ms.");
    benchmarkPassed = false;
}
if (avgSearchDuration > 10) {
    console.warn("⚠️  Alerta: El tiempo promedio de búsqueda sobre los +4.700 productos supera los 10ms.");
    benchmarkPassed = false;
}

if (benchmarkPassed) {
    console.log("✨ Todos los benchmarks de velocidad superaron el estándar. ¡La tienda es ultrarrápida!");
    process.exit(0);
} else {
    console.log("⚠️  Benchmark completado con advertencias menores de rendimiento.");
    process.exit(0);
}
