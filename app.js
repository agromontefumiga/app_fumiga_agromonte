import { _supabase, datosCargados, CATEGORIAS_PEDIDO, pedidoActual, formatoNum } from './config.js';
import { guardarNuevoProducto } from './crearProducto.js';
import { cambiarPestanaPedido, limpiarYRegresarInicio, descargarHistorialPDF, initPedidoQuimicos } from './pedidoQuimicos.js';
import { initProgramasFumigacion } from './programasFumigacion.js';
import { initModuloDescargas } from './descargasReporte.js';

// ==========================================
// ENRUTADOR GLOBAL DE MÓDULOS
// ==========================================
window.mostrarModulo = function(modulo) {
    const menuPrincipal = document.getElementById('menu-principal');
    const seccionFumigacion = document.getElementById('seccion-fumigacion');
    const seccionPedidoQuimicos = document.getElementById('seccion-pedido-quimicos');
    const seccionCrearProducto = document.getElementById('seccion-crear-producto');
    const seccionEtiquetas = document.getElementById('seccion-etiquetas');
    const seccionDescargas = document.getElementById('seccion-descargas-reportes');

    // Ocultar todas las secciones
    if (menuPrincipal) menuPrincipal.classList.add('hidden');
    if (seccionFumigacion) seccionFumigacion.classList.add('hidden');
    if (seccionPedidoQuimicos) seccionPedidoQuimicos.classList.add('hidden');
    if (seccionCrearProducto) seccionCrearProducto.classList.add('hidden');
    if (seccionEtiquetas) seccionEtiquetas.classList.add('hidden');
    if (seccionDescargas) seccionDescargas.classList.add('hidden');

    if (!modulo || modulo === 'menu-principal') {
        if (menuPrincipal) menuPrincipal.classList.remove('hidden');
        return;
    }

    // Mostrar y cargar el módulo correspondiente
    if (modulo === 'fumigacion') {
        if (seccionFumigacion) seccionFumigacion.classList.remove('hidden');
        if (typeof initProgramasFumigacion === 'function') initProgramasFumigacion();
    } else if (modulo === 'pedido-quimicos') {
        if (seccionPedidoQuimicos) seccionPedidoQuimicos.classList.remove('hidden');
        if (typeof initPedidoQuimicos === 'function') initPedidoQuimicos();
    } else if (modulo === 'crear-producto') {
        if (seccionCrearProducto) seccionCrearProducto.classList.remove('hidden');
    } else if (modulo === 'etiquetas') {
        if (seccionEtiquetas) seccionEtiquetas.classList.remove('hidden');
    } else if (modulo === 'descargas-reportes') {
        if (seccionDescargas) seccionDescargas.classList.remove('hidden');
        if (typeof initModuloDescargas === 'function') initModuloDescargas();
    }
};

// Exponer funciones globales necesarias para el HTML
window.cambiarPestanaPedido = cambiarPestanaPedido;
window.limpiarYRegresarInicio = limpiarYRegresarInicio;
window.descargarHistorialPDF = descargarHistorialPDF;
window.guardarNuevoProducto = guardarNuevoProducto;

document.addEventListener('DOMContentLoaded', () => {
    window.mostrarModulo('menu-principal');
});