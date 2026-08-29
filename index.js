app.post('/guardar-registro', async (req, res) => {
    try {
        const { 
            zona, // san andres tuxtla, cd aleman, veracruz centro, xalapa
            nombre_pastor, 
            telefono_pastor, 
            correo_pastor, 
            nombre_iglesia, 
            direccion, 
            num_maestros, 
            nombre_lider, 
            telefono_lider, 
            correo_lider, 
            num_cajas 
        } = req.body;

        // Insertar en la tabla principal unificada
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
                    num_cajas 
                }
            ])
            .select();

        if (error) throw error;

        res.redirect('/exito'); // O la ruta de redirección que uses
    } catch (err) {
        console.error('Error al guardar el registro:', err.message);
        res.status(500).send('Error interno del servidor');
    }
});
