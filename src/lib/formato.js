/**
 * Formatea un monto en guaraníes con punto como separador de miles.
 * Implementación determinista: no depende de los datos de ICU del entorno,
 * así los tests no cambian de resultado entre máquinas.
 */
export function formatearGs(monto) {
    if (typeof monto !== 'number' || !Number.isFinite(monto)) return null;
    const entero = Math.round(monto);
    const conPuntos = String(Math.abs(entero)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `Gs. ${entero < 0 ? '-' : ''}${conPuntos}`;
}
