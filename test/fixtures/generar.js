/**
 * Genera las fixtures del parser de la lista de precios.
 *
 * Los datos son INVENTADOS. La lista real trae costos y el nombre del
 * proveedor, y este repositorio es publico: no puede entrar ni una linea de
 * ella. Lo que si se reproduce con exactitud es el FORMATO, que es lo unico
 * que el parser tiene que entender.
 *
 * No se pueden tipear a mano: el archivo real esta en latin1, asi que los
 * acentos ocupan un byte y no dos. Leerlo como UTF-8 da mojibake.
 *
 *   node test/fixtures/generar.js
 */
import { writeFileSync } from 'node:fs';

const ANCHO = 94;
const COLUMNA_TITULO = 12;

// Fuente ASCII pura: los acentos van escapados para que el archivo .js no
// dependa de como lo lea el editor de turno.
const O_ACENTO = String.fromCharCode(0xD3); // O mayuscula con tilde
const A_TILDE = String.fromCharCode(0xC1); // A mayuscula con tilde

function linea(ref, titulo, precio) {
    const izquierda = ref + '.'.repeat(Math.max(1, COLUMNA_TITULO - ref.length));
    const derecha = 'U$' + precio;
    const relleno = '.'.repeat(Math.max(1, ANCHO - izquierda.length - titulo.length - derecha.length));
    return izquierda + titulo + relleno + derecha;
}

const OK = [
    'Distribuidora Ejemplo - lista de demostracion',
    'Para melhor visualizacao use a fonte Lucida Console.',
    '='.repeat(ANCHO),
    '',
    'Lista de precos 01/01/2026 - 09:00:00 ',
    '='.repeat(ANCHO),
    linea('100001', 'CABLE DE PRUEBA ACME 1M NEGRO', '1,50'),
    linea('100002', `MEM${O_ACENTO}RIA DDR5 16GB 6000MHZ ACME`, '48,90'),
    linea('99999', `MOUSE ACME M100 ${O_ACENTO}PTICO`, '9,00'),
    linea('100003', 'PLACA DE VIDEO ACME 8GB', '5.220,00'),
    linea('100004', 'PRODUCTO SIN PRECIO ACME', '0,00'),
    linea('100002', `MEM${O_ACENTO}RIA DDR5 16GB 6000MHZ ACME REV2`, '49,90'),
    `linea de basura que no matchea ${A_TILDE}`,
    '='.repeat(ANCHO),
    '* Todos os precos estao sujeitos a alteracao sem aviso previo.',
    ''
].join('\r\n');

writeFileSync('test/fixtures/lista-ok.txt', Buffer.from(OK, 'latin1'));

// Lo que el servidor devuelve cuando algo sale mal: una pagina, no una lista.
// El parser tiene que producir CERO productos, no fallar: es el freno de la
// Tarea 3 el que decide que cero productos significa abortar.
const ROTA = '<!DOCTYPE html><html><body><h1>503 Service Unavailable</h1></body></html>\r\n';
writeFileSync('test/fixtures/lista-rota.txt', Buffer.from(ROTA, 'latin1'));

console.log('OK: fixtures generadas en test/fixtures/');
