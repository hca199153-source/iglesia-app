// ==========================================
// RUTA POST /guardar (CORREGIDA)
// ==========================================
app.post('/guardar', async (req, res) => {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Añadimos 'zona' a la extracción de req.body
        const {
            zona,
            nombre_pastor, telefono_pastor, correo_pastor,
            nombre_iglesia, direccion,
            nombre_lider, telefono_lider, correo_lider,
            num_cajas,
            maestro_nombre, maestro_telefono, maestro_correo
        } = req.body;

        // 2. Incluimos 'zona' en la consulta SQL de inserción de la iglesia
        const queryIglesia = `
            INSERT INTO registros_iglesias 
            (zona, nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING id;
        `;
        const valuesIglesia = [
            zona, // <-- Nuevo valor agregado
            nombre_pastor, telefono_pastor, correo_pastor,
            nombre_iglesia, direccion,
            nombre_lider, telefono_lider, correo_lider,
            num_cajas
        ];

        const iglesiaResult = await client.query(queryIglesia, valuesIglesia);
        const iglesiaId = iglesiaResult.rows[0].id;

        // Inserción de maestros (esto se mantiene exactamente igual)
        if (maestro_nombre) {
            const nombres = Array.isArray(maestro_nombre) ? maestro_nombre : [maestro_nombre];
            const telefonos = Array.isArray(maestro_telefono) ? maestro_telefono : [maestro_telefono];
            const correos = Array.isArray(maestro_correo) ? maestro_correo : [maestro_correo];

            for (let i = 0; i < nombres.length; i++) {
                if (nombres[i].trim() !== '') {
                    const queryMaestro = `
                        INSERT INTO maestros (iglesia_id, nombre, telefono, correo)
                        VALUES ($1, $2, $3, $4);
                    `;
                    await client.query(queryMaestro, [iglesiaId, nombres[i], telefonos[i], correos[i]]);
                }
            }
        }

        await client.query('COMMIT');
        res.render('index', { mensaje: '¡Registro guardado exitosamente!' });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Error al guardar:', err);
        res.status(500).render('index', { mensaje: 'Error al procesar el registro.' });
    } finally {
        client.release();
    }
});


// ==========================================
// RUTA POST /admin-login (NUEVA / CORREGIDA)
// Agrega esto donde tengas tus rutas GET/POST para que funcione el login.ejs
// ==========================================
app.post('/admin-login', (req, res) => {
    const { password } = req.body;
    // Contraseña de acceso al panel (cámbiala o liganla a variables de entorno)
    const PASSWORD_ADMIN = process.env.ADMIN_PASS || 'secreto123';

    if (password === PASSWORD_ADMIN) {
        // Redirige al panel de administración si coincide
        res.redirect('/admin');
    } else {
        // Si falla, vuelve a renderizar el login con un mensaje de error
        res.render('login', { error: 'Contraseña incorrecta. Inténtalo de nuevo.' });
    }
});
