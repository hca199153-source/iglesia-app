// Ejemplo de ruta POST para guardar el registro y sus maestros
app.post('/guardar', async (req, res) => {
  try {
    const {
      nombre_pastor,
      telefono_pastor,
      correo_pastor,
      nombre_iglesia,
      direccion,
      nombre_lider,
      telefono_lider,
      correo_lider,
      num_cajas,
      maestro_nombre, // Esto llega como un Array (ej: ['Juan', 'Ana'])
      maestro_telefono, // Esto llega como un Array
      maestro_correo    // Esto llega como un Array
    } = req.body;

    // 1. Aquí guardas los datos de la iglesia, pastor y líder principal 
    // y obtienes el ID de la iglesia registrada (ejemplo con SQL simulado):
    /*
    const queryIglesia = `INSERT INTO iglesias (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas) VALUES (...) RETURNING id;`;
    const resultadoIglesia = await db.query(queryIglesia, [...]);
    const iglesiaId = resultadoIglesia.rows[0].id;
    */

    // 2. Iterar y guardar cada maestro asociado a esa iglesia
    if (maestro_nombre && Array.isArray(maestro_nombre)) {
      for (let i = 0; i < maestro_nombre.length; i++) {
        const nombre = maestro_nombre[i];
        const telefono = maestro_telefono[i];
        const correo = maestro_correo[i] || null;

        // Guardar en tu tabla de maestros vinculada al ID de la iglesia
        /*
        const queryMaestro = `INSERT INTO maestros (iglesia_id, nombre, telefono, correo) VALUES ($1, $2, $3, $4);`;
        await db.query(queryMaestro, [iglesiaId, nombre, telefono, correo]);
        */
      }
    }

    // Renderizar o redirigir con éxito
    res.render('index', { 
      mensajeExito: '¡Registro y maestros guardados correctamente!', 
      mensajeError: null 
    });

  } catch (error) {
    console.error("Error al guardar:", error);
    res.render('index', { 
      mensajeExito: null, 
      mensajeError: 'Ocurrió un error al procesar el registro. Inténtalo de nuevo.' 
    });
  }
});
