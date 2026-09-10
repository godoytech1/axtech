import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { nombreDeProducto, nombrarCatalogo } from '../../src/lib/nombre.js';

test('el nombre dice marca, modelo y lo que define la compra', () => {
    assert.equal(
        nombreDeProducto('VGA RX7600 8GB XFX SPEEDSTER SWFT210 RX-76PSWF RX-76PSWFTFY SWFT210', 'tarjetas-de-video'),
        'XFX Radeon RX 7600 8GB Speedster SWFT210'
    );
    assert.equal(
        nombreDeProducto('CPU AMD AM4 RYZEN R5 5500 BOX 4.2GHZ S/VIDEO 100-100000457BO X', 'procesadores'),
        'AMD Ryzen 5 5500 4.2GHz AM4 BOX'
    );
});

test('el modelo de una notebook se conserva aunque parezca un codigo', () => {
    // "82XB00C2US" es lo unico que distingue esta Lenovo de otra igual.
    const n = nombreDeProducto('NB LENOVO 82XB00C2US I3-N305/8GB/128/15.6/GREY/W11 INGLES', 'notebooks');
    assert.ok(n.includes('82XB00C2US'), n);
    assert.ok(n.includes('Core i3-N305'), n);
});

test('no repite el mismo concepto en dos idiomas', () => {
    // El proveedor escribe "SEM FIO" y "WIRELESS" en el mismo titulo, y cada
    // capa traducia el suyo: salio publicado "Gamepad Sin Cable Inalambrico".
    const n = nombreDeProducto(
        'CONTROLE LOGITECH F710 GAMEPAD Inalámbrico 940-00011 940-000117 WIRELESS',
        'consolas-y-videojuegos'
    );
    assert.equal(n.toLowerCase().split(/\s+/).filter((w) => /inal[aá]mbrico/.test(w)).length, 1, n);
    assert.ok(!/sin cable/i.test(n), n);
});

test('dos productos distintos no pueden quedar con el mismo nombre', () => {
    // Un ventilador suelto y el pack de tres, a precios distintos.
    const productos = [
        { title: 'COOLER FAN LIAN LI UNI FAN TL WIRELESS 120 BLK UND 12TL1W1B X1', category: 'refrigeracion' },
        { title: 'COOLER FAN LIAN LI UNI FAN TL WIRELESS 120 X3 BLK 12TL1W3B BLACK', category: 'refrigeracion' }
    ];
    const nombres = nombrarCatalogo(productos);
    assert.notEqual(nombres.get(productos[0]), nombres.get(productos[1]));
});

test('nunca devuelve un nombre vacio', () => {
    assert.equal(nombreDeProducto('', 'teclados'), '');
    assert.ok(nombreDeProducto('PRODUCTO RARO SIN FORMATO', 'teclados').length > 0);
});

test('el nombre nunca abre diciendo lo que el producto NO es', () => {
    // Cuando el titulo no trae marca reconocible, el respaldo agarraba la
    // primera palabra util --que era el accesorio al que sirve-- y publicaba
    // un teclado llamado "Tablet BT Universao".
    const n = nombreDeProducto('TEC P/ TABLET BT UNIVERSAO WHITE', 'teclados');
    assert.ok(/^Teclado\b/.test(n), n);
    const f = nombreDeProducto('Fuente P/ NUC 19V Alámbrico', 'fuentes-de-poder');
    assert.ok(/^Fuente\b/.test(f), f);
    assert.ok(!/^Fuente P$/.test(f), 'una letra suelta no es un nombre');
});

test('un modelo de una sola letra no se pierde', () => {
    // El "X" de "Logitech G502 X" es parte del nombre: sin el, se confunde con
    // el G502 normal, que es otro producto a otro precio.
    assert.ok(
        nombreDeProducto('MOUSE LOGITECH G502 X OPTICO USB WHITE 910-006145', 'mouses-y-mousepads')
            .includes('G502 X')
    );
});

test('ningun nombre publicado abre nombrando otro producto', () => {
    // Recorre el catalogo entero: los ejemplos sueltos no alcanzan para una
    // regla que depende de que trae cada titulo.
    const AJENA = /^(?:Tablet|Notebook|Celular|Smartphone|Universal|Universao|Para|Con|Sin)\b/i;
    const cat = JSON.parse(readFileSync('data/catalog.json', 'utf8'));
    const activos = cat.filter((p) => p.status === 'active');
    const nombres = nombrarCatalogo(activos);
    const rotos = activos
        .filter((p) => !['tablets', 'notebooks', 'telefonos-y-celulares'].includes(p.category))
        .filter((p) => AJENA.test(nombres.get(p)))
        .map((p) => `${p.category}: ${nombres.get(p)}`);
    assert.deepEqual(rotos, []);
});
