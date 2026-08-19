import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { paginaDeError } from '../../src/build/plantillas.js';
import { generarPaginas } from '../../src/build/paginas.js';
import { CATEGORIAS } from '../../src/lib/taxonomy.js';

/**
 * Cloudflare Pages responde a toda URL inexistente con un 200 y el contenido
 * de la portada, salvo que exista /404.html. Para Google eso es un soft 404:
 * cree que la pagina existe, la conserva en el indice y le gasta presupuesto
 * de rastreo al resto del sitio.
 *
 * En una tienda pasa todos los dias. El proveedor da de baja productos, el
 * sync los purga a los 30 dias y cada uno deja su URL atras, ya rastreada.
 *
 * Verificado en produccion antes de arreglarlo:
 *   /p/esta-pagina-no-existe-999999/  ->  200  <title>AXTECH | Tu Tienda...
 */

const HTML = paginaDeError({ categorias: CATEGORIAS, urlBase: 'https://axtech.pages.dev' });

test('el build escribe 404.html en la raiz de la salida', () => {
    // Se genera en un directorio temporal en vez de mirar dist/: en CI los
    // tests corren ANTES del build, asi que dist/ todavia no existe. Lo que
    // hay que probar es que generarPaginas lo escriba, no que alguien haya
    // construido antes.
    const salida = mkdtempSync(join(tmpdir(), 'axtech-404-'));
    try {
        generarPaginas({
            publicos: [{
                id: 1, slug: 'mouse-logitech-g203-1', title: 'MOUSE LOGITECH G203',
                brand: 'LOGITECH', category: 'mouses-y-mousepads', price: 150000,
                image: '/img/1.webp'
            }],
            salida,
            urlBase: 'https://axtech.pages.dev'
        });
        assert.ok(
            existsSync(join(salida, '404.html')),
            'sin 404.html, Cloudflare Pages responde 200 a toda URL inexistente'
        );
    } finally {
        rmSync(salida, { recursive: true, force: true });
    }
});

test('la pagina de error solo ofrece categorias con productos', () => {
    // Mandar a alguien desde un error a una categoria vacia son dos callejones
    // sin salida seguidos.
    const salida = mkdtempSync(join(tmpdir(), 'axtech-404-'));
    try {
        generarPaginas({
            publicos: [{
                id: 1, slug: 'mouse-logitech-g203-1', title: 'MOUSE LOGITECH G203',
                brand: 'LOGITECH', category: 'mouses-y-mousepads', price: 150000,
                image: '/img/1.webp'
            }],
            salida,
            urlBase: 'https://axtech.pages.dev'
        });
        const html = readFileSync(join(salida, '404.html'), 'utf8');
        assert.match(html, /href="\/c\/mouses-y-mousepads\/"/);
        assert.doesNotMatch(html, /href="\/c\/notebooks\/"/, 'ofrece una categoria sin productos');
    } finally {
        rmSync(salida, { recursive: true, force: true });
    }
});

test('la pagina de error no se indexa', () => {
    assert.match(HTML, /<meta name="robots" content="noindex,follow">/);
});

test('la pagina de error no lleva canonical', () => {
    // Un canonical hacia si misma le dice a Google que la pagina existe; uno
    // hacia la portada, que ES la portada. Las dos cosas son el soft 404 que
    // esta pagina viene a evitar.
    assert.doesNotMatch(HTML, /rel="canonical"/);
    assert.doesNotMatch(HTML, /og:url/);
});

test('la pagina de error no entra al sitemap', () => {
    if (!existsSync('dist/sitemap.xml')) return;
    assert.doesNotMatch(readFileSync('dist/sitemap.xml', 'utf8'), /404/);
});

test('la pagina de error ofrece una salida, no solo una disculpa', () => {
    // Es un callejon sin salida: el visitante llego por un enlace viejo. Sin
    // buscador ni categorias, la unica opcion que le queda es cerrar.
    assert.match(HTML, /<form[^>]+action="\/"[^>]*>/, 'sin buscador');
    assert.match(HTML, /name="q"/, 'el buscador tiene que usar el parametro que lee app.js');
    assert.ok((HTML.match(/href="\/c\//g) || []).length >= 5, 'pocas categorias de salida');
    assert.match(HTML, /href="\/"/, 'sin vuelta a la portada');
});

test('el buscador de la pagina de error tiene etiqueta accesible', () => {
    const id = /<input[^>]+id="([^"]+)"[^>]+name="q"/.exec(HTML)?.[1];
    assert.ok(id, 'el campo de busqueda no tiene id');
    assert.match(HTML, new RegExp(`<label[^>]+for="${id}"`), 'el campo no tiene label asociado');
});

test('las paginas normales conservan su canonical', () => {
    // El canonical se volvio opcional para la pagina de error. Esa flexibilidad
    // no puede haber apagado el canonical del resto del sitio.
    const html = readFileSync('src/build/plantillas.js', 'utf8');
    assert.match(html, /canonical \? `<link rel="canonical"/, 'el canonical dejo de emitirse');
    if (existsSync('dist/sitemap.xml')) {
        const alguna = 'dist/c/notebooks/index.html';
        if (existsSync(alguna)) {
            assert.match(readFileSync(alguna, 'utf8'), /<link rel="canonical" href="https?:\/\//);
        }
    }
});
