import test from 'node:test';
import assert from 'node:assert/strict';
import { descargarLista, nombreDesdeCabecera } from '../../src/sync/descargar.js';

const cabeceras = (valor) => ({ get: (k) => (k.toLowerCase() === 'content-disposition' ? valor : null) });

const respuestaOk = (cuerpo, disposicion = 'attachment; filename="01_01_2026_Ejemplo.txt"') => ({
    ok: true,
    status: 200,
    headers: cabeceras(disposicion),
    arrayBuffer: async () => Buffer.from(cuerpo, 'latin1')
});

test('extrae el nombre de la cabecera con y sin comillas', () => {
    assert.equal(nombreDesdeCabecera('attachment; filename="01_01_2026_Ejemplo.txt"'), '01_01_2026_Ejemplo.txt');
    assert.equal(nombreDesdeCabecera('attachment; filename=01_01_2026_Ejemplo.txt'), '01_01_2026_Ejemplo.txt');
});

test('sin cabecera util devuelve null en vez de romper', () => {
    assert.equal(nombreDesdeCabecera(null), null);
    assert.equal(nombreDesdeCabecera(''), null);
    assert.equal(nombreDesdeCabecera('attachment'), null);
});

test('descarta un nombre con separadores de ruta', () => {
    // El nombre viene del servidor del proveedor: se usa para guardar un
    // archivo, asi que no puede traer ../ ni barras.
    assert.equal(nombreDesdeCabecera('attachment; filename="../../etc/passwd"'), null);
    assert.equal(nombreDesdeCabecera('attachment; filename="sub/dir/x.txt"'), null);
});

test('decodifica latin1, no utf8', async () => {
    // La lista real esta en latin1: leerla como utf8 da mojibake que
    // normalize.js no espera y termina en los titulos publicados.
    const acentuado = `MEM${String.fromCharCode(0xD3)}RIA`;
    const r = await descargarLista({ url: 'x', buscar: async () => respuestaOk(acentuado) });
    assert.equal(r.texto, acentuado);
    assert.equal(r.nombreArchivo, '01_01_2026_Ejemplo.txt');
    assert.equal(r.bytes, 7);
});

test('reintenta ante un fallo transitorio', async () => {
    let n = 0;
    const buscar = async () => {
        n++;
        if (n < 3) throw new Error('ECONNRESET');
        return respuestaOk('ok');
    };
    const r = await descargarLista({ url: 'x', buscar, esperaMs: 0 });
    assert.equal(n, 3);
    assert.equal(r.texto, 'ok');
});

test('se rinde tras agotar los intentos y dice por que', async () => {
    let n = 0;
    const buscar = async () => { n++; throw new Error('servidor caido'); };
    await assert.rejects(
        descargarLista({ url: 'x', intentos: 2, esperaMs: 0, buscar }),
        /servidor caido/
    );
    assert.equal(n, 2);
});

test('un 500 no se toma como exito', async () => {
    const buscar = async () => ({
        ok: false, status: 500, headers: cabeceras(null), arrayBuffer: async () => Buffer.from('')
    });
    await assert.rejects(descargarLista({ url: 'x', intentos: 1, esperaMs: 0, buscar }), /500/);
});

test('una respuesta vacia se rechaza', async () => {
    await assert.rejects(
        descargarLista({ url: 'x', intentos: 1, esperaMs: 0, buscar: async () => respuestaOk('') }),
        /vacia/i
    );
});

test('sin url no intenta nada', async () => {
    await assert.rejects(descargarLista({ url: '', buscar: async () => respuestaOk('x') }), /url/i);
});
