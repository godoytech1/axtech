import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CATEGORIAS } from '../../src/lib/taxonomy.js';

/**
 * Estos tests existen por un error que estuvo publicado y no se notaba.
 *
 * La Fase 1A renombro las categorias: de nombres visibles ("Almacenamiento
 * (SSD)", "Tarjetas de Video") a ids ("almacenamiento-ssd",
 * "tarjetas-de-video"). Los datos se migraron; `app.js` no.
 *
 * Como el front compara con `===` y una comparacion falsa no lanza ningun
 * error, todo siguio "funcionando": la pagina cargaba, los productos se veian
 * y nada aparecia en la consola. Lo unico que pasaba es que 41 comparaciones
 * eran permanentemente falsas, y con ellas se cayeron en silencio la barra de
 * filtros entera (pulgadas, socket, generacion de RAM, vatios, capacidad,
 * chip de GPU, tipo de consola, tipo de notebook), el orden por relevancia de
 * la busqueda y la mezcla de categorias de la portada.
 *
 * Un `===` contra un valor que no existe es indistinguible de uno correcto
 * hasta que alguien lo compara con la lista real. Eso es lo que hace este
 * archivo.
 */

const APP = readFileSync('app.js', 'utf8');
const INDEX = readFileSync('index.html', 'utf8');
const IDS = new Set(CATEGORIAS.map((c) => c.id));

test('ninguna comparacion de categoria en app.js apunta a un id inexistente', () => {
    const patron = /(?:\.category|currentCategory|\bcategory)\s*(?:===|!==)\s*'([^']+)'/g;
    const muertas = [];
    for (const [, valor] of APP.matchAll(patron)) {
        if (valor !== 'all' && !IDS.has(valor)) muertas.push(valor);
    }
    assert.deepEqual(
        [...new Set(muertas)],
        [],
        'app.js compara contra categorias que no existen en la taxonomia'
    );
});

test('los data-category del HTML existen en la taxonomia', () => {
    const patron = /data-(?:category|go-category)="([^"]+)"/g;
    const muertas = [];
    for (const [, valor] of INDEX.matchAll(patron)) {
        if (valor !== 'all' && !IDS.has(valor)) muertas.push(valor);
    }
    assert.deepEqual([...new Set(muertas)], [], 'el HTML apunta a categorias inexistentes');
});

test('los ids de categoria son unicos', () => {
    assert.equal(new Set(CATEGORIAS.map((c) => c.id)).size, CATEGORIAS.length);
});

test('los nombres visibles llevan las tildes del espaniol', () => {
    // Se veian en el menu de todas las paginas: "Refrigeracion", "Microfonos",
    // "Telefonos", "Energia", "Peliculas". En una tienda paraguaya eso se lee
    // como descuido, no como una decision tecnica.
    const sinTilde = {
        Refrigeracion: 'Refrigeración',
        Microfonos: 'Micrófonos',
        'Telefonos y Celulares': 'Teléfonos y Celulares',
        'UPS y Energia': 'UPS y Energía',
        'Peliculas y Fundas': 'Películas y Fundas',
        Perifericos: 'Periféricos',
        Almacenamiento: 'Almacenamiento'
    };
    const malos = CATEGORIAS
        .filter((c) => sinTilde[c.nombre] && sinTilde[c.nombre] !== c.nombre)
        .map((c) => `${c.nombre} -> ${sinTilde[c.nombre]}`);
    assert.deepEqual(malos, []);
});

test('cada categoria tiene nombre e icono', () => {
    for (const c of CATEGORIAS) {
        assert.ok(c.nombre && c.nombre.trim(), `${c.id} sin nombre`);
        assert.ok(c.icono && c.icono.startsWith('la-'), `${c.id} sin icono valido`);
    }
});
