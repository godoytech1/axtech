import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clasificar, detectarMarca } from '../src/lib/taxonomy.js';
import { extraerSpecs } from '../src/lib/specs.js';
import { nombrarCatalogo } from '../src/lib/nombre.js';
import { aPublicoLegado } from '../src/lib/contract.js';
import { excluido } from '../src/lib/exclusiones.js';

/**
 * Salud del catalogo REAL, no de ejemplos sueltos.
 *
 * El 2026-09-29 dylan encontro, mirando la tienda, servidores NAS y
 * ventiladores publicados en "PCs de Escritorio", una PC sin el procesador en
 * la ficha y un Mini PC llamandose "Intel 12TH W11 Pro/eu". Los 355 tests de
 * ese dia pasaban: prueban que cada funcion haga lo suyo con los casos que
 * alguien penso, no que los 5.718 productos publicados esten sanos.
 *
 * Esto mide el catalogo entero y falla si la calidad EMPEORA. Los topes son
 * el estado del dia que se escribio, con aire: no exigen perfeccion --hay
 * defectos que dependen de lo que mande el proveedor-- pero no dejan que el
 * numero crezca sin que nadie se entere.
 *
 * Si un cambio los baja, hay que bajar el tope: es la unica forma de que el
 * piso suba en vez de aflojarse.
 */

const ACTIVOS = JSON.parse(readFileSync('data/catalog.json', 'utf8'))
    .filter((p) => p.status === 'active')
    // Se reclasifica con las reglas de hoy: es lo que el proximo sync escribe.
    .map((p) => ({ ...p, category: clasificar({ titulo: p.title }) || p.category }));

const NOMBRES = nombrarCatalogo(ACTIVOS);
const PUBLICADOS = ACTIVOS
    .map((p) => aPublicoLegado(p, { idsSinImagen: new Set(), nombre: NOMBRES.get(p) }))
    .filter(Boolean);

// En estos rubros la marca del componente ES la marca del producto.
const COMPONENTE = new Set(['procesadores', 'tarjetas-de-video', 'placas-madre', 'memorias-ram']);

const informar = (nombre, malos, tope) => {
    if (malos.length > tope) {
        console.log(`  ${nombre}: ${malos.length} (tope ${tope})`);
        malos.slice(0, 10).forEach((m) => console.log(`      ${m}`));
    }
    assert.ok(malos.length <= tope,
        `${nombre}: ${malos.length}, tope ${tope}. Si el cambio es a proposito, bajar el tope.`);
};

test('ningun producto publicado lleva la marca de otra empresa', () => {
    // El sync congelaba la marca del dia que el producto entro: 186 productos
    // publicaban el nombre de otro fabricante.
    const malos = ACTIVOS
        .filter((p) => {
            const hoy = detectarMarca(p.title);
            return hoy && hoy !== p.brand;
        })
        .map((p) => `${p.brand} deberia ser ${detectarMarca(p.title)}: ${p.title.slice(0, 44)}`);
    informar('marcas equivocadas', malos, 0);
});

test('ningun nombre abre con la marca del procesador que trae adentro', () => {
    const malos = PUBLICADOS
        .filter((p) => !COMPONENTE.has(p.category))
        .filter((p) => /^(intel|amd|nvidia)\b/i.test(p.title))
        .filter((p) => !/\bNUC\d/i.test(p.title))
        .map((p) => `${p.category}: ${p.title.slice(0, 50)}`);
    informar('nombres con marca de componente', malos, 0);
});

test('ninguna ficha publica la marca o la categoria como si fuera una spec', () => {
    // Eran 1.142 lineas que decian "GENERIC" o "Perifericos".
    const malos = PUBLICADOS
        .filter((p) => (p.specs || []).some((s) => /^(GENERIC|Perif[eé]ricos?|Componentes|Accesorios)$/i.test(String(s).trim())))
        .map((p) => p.title.slice(0, 50));
    informar('fichas con la marca o la categoria como spec', malos, 0);
});

test('el nombre no arrastra la lista de caracteristicas del proveedor', () => {
    const malos = PUBLICADOS
        .filter((p) => /\w+\/\w+\/\w+/.test(p.title))
        .map((p) => p.title.slice(0, 50));
    informar('nombres con tres campos pegados por barra', malos, 12);
});

test('ningun nombre publicado queda en portugues', () => {
    const malos = PUBLICADOS
        .filter((p) => /\b(unidade|dados|pe[cç]a|bivolt|dinheiro|gaveta|faixa|tampa)\b/i.test(p.title))
        .map((p) => p.title.slice(0, 50));
    informar('nombres en portugues', malos, 20);
});

test('los equipos dicen que procesador traen', () => {
    // Es lo primero que mira quien compra una computadora y faltaba en el 45%.
    const equipos = ACTIVOS.filter((p) => ['pcs-de-escritorio', 'notebooks'].includes(p.category));
    const malos = equipos
        .filter((p) => !extraerSpecs(p.title, p.category).some((s) => s.etiqueta === 'Procesador'))
        .map((p) => p.title.slice(0, 54));
    informar('equipos sin procesador en la ficha', malos, 40);
});

test('ninguna categoria se llena de productos de otro rubro', () => {
    // Se agrupa por el TIPO que el proveedor declara al abrir el titulo, que
    // es la evidencia de que es el producto. Un tipo que aparece en una sola
    // categoria y no encaja con ella es un intruso.
    const INTRUSOS = [
        ['pcs-de-escritorio', /^(servidor|hub|switch|ventilador|nvr)\b/i],
        ['procesadores', /\bde alimentos\b/i],
        ['notebooks', /^(bolsa|capa|estojo|mochila)\b|\bbolsa\b/i],
        ['almacenamiento-ssd', /^(nvr|dissipador)\b/i],
        ['monitores', /\bmonitor de temperatura\b/i],
        ['fuentes-de-poder', /^router\b/i],
        ['microfonos', /^camera\b/i],
        ['gabinetes', /^plataforma\b/i],
        ['ups-y-energia', /\b(motosserra|parafusadeira|esmerilhadeira)\b/i]
    ];
    // Los que ya estan marcados para excluir no cuentan: el sync los oculta en
    // su proxima corrida y hasta entonces siguen figurando como activos.
    const malos = [];
    for (const [cat, patron] of INTRUSOS) {
        for (const p of ACTIVOS.filter((x) => x.category === cat && patron.test(x.title))) {
            if (excluido(p.title)) continue;
            malos.push(`${cat}: ${p.title.slice(0, 50)}`);
        }
    }
    informar('productos en el rubro equivocado', malos, 0);
});

test('todo producto publicado tiene lo minimo para venderse', () => {
    const malos = PUBLICADOS
        .filter((p) => !p.title || p.title.split(/\s+/).length < 2 || !p.pyg || p.pyg <= 0 || !p.image)
        .map((p) => `${p.id}: "${p.title}" ${p.pyg}`);
    informar('publicados sin nombre, precio o imagen', malos, 0);
});
