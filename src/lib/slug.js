const LARGO_MAXIMO = 60;

/**
 * Convierte texto libre en un slug apto para URL: minusculas, sin acentos,
 * separado por guiones simples.
 *
 * NFD descompone las letras acentuadas en letra base + marca combinante,
 * y \p{M} elimina esas marcas. Se usa la propiedad Unicode en vez de un
 * rango literal para que el codigo fuente sea ASCII puro: un rango escrito
 * con caracteres combinantes se rompe si un editor normaliza el archivo.
 */
export function slugificar(texto) {
    if (typeof texto !== 'string') return '';
    return texto
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, LARGO_MAXIMO)
        .replace(/-+$/g, '');
}

/**
 * Slug de un producto. El id como sufijo garantiza unicidad aunque dos
 * productos compartan titulo.
 */
export function slugDeProducto(titulo, id) {
    const base = slugificar(titulo);
    return base ? `${base}-${id}` : `producto-${id}`;
}
