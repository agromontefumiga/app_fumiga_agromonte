import { _supabase, mostrarModalExito } from './config.js';

export async function guardarNuevoProducto() {
    const productoInput = document.getElementById('np-producto');
    const producto = productoInput ? productoInput.value.trim() : '';

    if (!producto) {
        alert("El nombre del producto es obligatorio.");
        return;
    }

    if (!confirm(`¿Deseas guardar el producto ${producto.toUpperCase()} en la base de datos?`)) {
        return; 
    }

    // Helper para parsear valores numéricos o dejarlos en null
    const parsearNumero = (id) => {
        const el = document.getElementById(id);
        const val = el ? el.value.trim() : '';
        return (val !== '' && !isNaN(val)) ? Number(val) : null;
    };

    // Helper para leer texto plano
    const leerTexto = (id) => {
        const el = document.getElementById(id);
        return el ? el.value.trim() || null : null;
    };

    const nuevoProd = {
        producto: producto.toUpperCase(),
        registro_ica: leerTexto('np-ica'),
        ingrediente_activo: leerTexto('np-ia'),
        categoria_toxicologica: leerTexto('np-tox'),
        concentracion_ia: leerTexto('np-conc'),
        tiempo_reingreso: leerTexto('np-reingreso'),
        valor_cc_lts: parsearNumero('np-cclts'),
        valor_cc_gr: parsearNumero('np-ccgrs'),
        casa_comercial: leerTexto('np-casa'),
        blanco_biologico: leerTexto('np-blanco'),
        dosis: parsearNumero('np-dosis'),
        irac: parsearNumero('np-irac'),
        frac: parsearNumero('np-frac')
    };

    try {
        const { data, error } = await _supabase
            .from('productos_fumigacion')
            .insert([nuevoProd])
            .select();

        if (error) throw error;

        mostrarModalExito('¡PRODUCTO GUARDADO!', `El producto ${producto.toUpperCase()} ya está disponible en el sistema.`);
        
        // Limpiar inputs del formulario
        document.querySelectorAll('.np-input').forEach(inp => inp.value = '');
        
    } catch (error) {
        console.error("Error guardando producto:", error);
        alert("Ocurrió un error al guardar: " + (error.message || JSON.stringify(error)));
    }
}