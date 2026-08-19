/**
 * Lo que el proveedor vende y AXTECH no.
 *
 * AXTECH es una tienda de tecnologia. El proveedor no: en su lista aparecen
 * cosas que no tienen nada que ver, y como el clasificador busca palabras en
 * el titulo, esas cosas terminan en alguna categoria. El caso que abrio este
 * archivo fue un collar de adiestramiento para perros publicado en "Consolas
 * y Videojuegos", porque su titulo dice "C/CONTROLE" (con control remoto).
 *
 * Arreglar la regla de Consolas lo saco de ahi, pero no de la tienda: al no
 * clasificar en ningun lado, el sync le conservaba la categoria que ya tenia
 * (`categoriaHeredada` en aplicar.js). Esa herencia existe a proposito -- que
 * el proveedor recorte un titulo no puede borrar un producto -- asi que la
 * decision de NO vender algo tiene que decirse en otro lado. Es este archivo.
 *
 * Esto no es un filtro de calidad ni una lista negra de marcas: es la frontera
 * del rubro. Antes de agregar un patron, la pregunta es "¿esto es un producto
 * de tecnologia?", no "¿esto se vende poco?".
 *
 * Un producto excluido:
 *   - no entra al catalogo si es nuevo;
 *   - se marca `hidden` si ya estaba publicado;
 *   - lo borra la purga a los 30 dias, como a cualquier otro oculto.
 *
 * Se cuenta aparte de los ocultados normales: el freno de `verificar.js` mide
 * cuanto stock dio de baja el proveedor, y mezclarlo con una decision nuestra
 * lo haria saltar por el motivo equivocado.
 */

/**
 * Los dos errores posibles NO cuestan lo mismo.
 *
 * Excluir de mas saca de la tienda algo que se podia vender. Excluir de menos
 * deja un producto raro en una categoria, que se ve feo y se arregla despues.
 * Por eso las palabras son especificas y no genericas.
 *
 * Ejemplo real, encontrado corriendo la regla contra la lista del proveedor
 * antes de publicarla: "gato" parecia inofensivo hasta que aparecio
 * "PAINEL LED EL GATO NEO KEY LIGHTS", que es un panel de luz de la marca
 * ELGATO, escrita con espacio. Tecnologia pura, y la regla la sacaba de la
 * tienda. "gato" y "perro" salieron de la lista: no atrapaban nada que las
 * otras palabras no atraparan, y si un producto que si se vende.
 *
 * Antes de agregar un patron, correrlo contra la lista real y mirar QUE saca.
 */
const REGLAS = [
    // Articulos para mascotas: collares, comederos y dispensadores.
    //
    // Hoy saca ocho productos de la lista del proveedor: un collar de
    // adiestramiento, dos perros robot de juguete y cinco dispensadores de
    // alimento SATE. Los dispensadores se consultaron aparte porque son
    // dispositivos conectados ("SMART") de una marca que la tienda ya vende:
    // la decision del dueño fue que no se venden. No reponerlos sin preguntar.
    /\b(colar de treinamento|coleira|cachorros?|mascotas?|comedero|bebedero|arranhador|racao)\b/i
];

/**
 * @param {string} titulo
 * @returns {boolean} true si el producto no pertenece al rubro de la tienda.
 */
export function excluido(titulo) {
    if (typeof titulo !== 'string' || !titulo.trim()) return false;
    // Se comparan sin tildes, igual que en taxonomy.js: el proveedor las
    // escribe de forma inconsistente.
    const t = titulo.normalize('NFD').replace(/\p{M}/gu, '');
    return REGLAS.some((patron) => patron.test(t));
}
