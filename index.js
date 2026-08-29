app.post('/guardar-registro', async (req, res) => {
    try {
        const { 
            zona, 
            nombre_pastor, 
            telefono_pastor, 
            correo_pastor, 
            nombre_iglesia, 
            direccion, 
            nombre_lider, 
            telefono_lider, 
            correo_lider, 
            num_cajas,
            maestro_nombre,
            maestro_telefono,
            maestro_correo 
        } = req.body;

        // ERROR CORREGIDO: Mapeo y estructuración de los arreglos de maestros dinámicos
        let maestrosArray = [];
        if (maestro_nombre) {
            // Si solo se envía un maestro, Express lo recibe como string; si son varios, como array
            const nombres = Array.isArray(maestro_nombre) ? maestro_nombre : [maestro_nombre];
            const telefonos = Array.isArray(maestro_telefono) ? maestro_telefono : [maestro_telefono];
            const correos = Array.isArray(maestro_correo) ? maestro_correo : [maestro_correo];

            for (let i = 0; i < nombres.length; i++) {
                maestrosArray.push({
                    nombre: nombres[i],
                    telefono: telefonos[i],
                    correo: correos[i] || ''
                });
            }
        }

        const num_maestros = maestrosArray.length;

        // Inserción en la base de datos Supabase manteniendo la estructura
        const { data, error } = await supabase
            .from('registros_iglesias')
            .insert([
                { 
                    zona, 
                    nombre_pastor, 
                    telefono_pastor, 
                    correo_pastor, 
                    nombre_iglesia, 
                    direccion, 
                    num_maestros, 
                    nombre_lider, 
                    telefono_lider, 
                    correo_lider, 
                    num_cajas: parseInt(num_cajas),
                    maestros: maestrosArray // Guardado como formato JSON/Array compatible con Supabase
                }
            ])
            .select();

        if (error) throw error;

        res.render('index', { mensajeExito: '¡Registro guardado correctamente!', mensajeError: null });
    } catch (err) {
        console.error('Error al guardar el registro:', err.message);
        res.render('index', { mensajeError: 'Error interno al guardar el registro. Verifique los datos.', mensajeExito: null });
    }
});
