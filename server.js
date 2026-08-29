const express = require('express');
const app = express();
const path = require('path');

// Configuración de middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configuración de EJS como motor de vistas
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Importa tu conexión a la base de datos (ajusta la ruta según tu proyecto, ej: './db' o similar)
// const pool = require('./db'); 

// Ruta principal (Muestra el formulario)
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// Ruta POST para procesar el formulario de registro y maestros
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
      maestro_nombre,    // Llega como un arreglo []
      maestro_telefono,  // Llega como un arreglo []
      maestro_correo     // Llega como un arreglo []
    } = req.body;

    /* 
      1. INSERTAR LOS DATOS DE LA IGLESIA
      Descomenta y adapta esto según cómo manejes tu conexión (ej: pool.query o supabase)
    */
    /*
    const queryIglesia = `
      INSERT INTO iglesias 
      (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
      RETURNING id;
    `;
    const valuesIglesia = [
      nombre_pastor, telefono_pastor, correo_pastor || null, 
      nombre_iglesia, direccion || null, nombre_lider, 
      telefono_lider, correo_lider || null, num_cajas
    ];
    
    const resultadoIglesia = await pool.query(queryIglesia, valuesIglesia);
    const iglesiaId = resultadoIglesia.rows[0].id;

    // 2. INSERTAR LOS MAESTROS DINÁMICOS ASOCIADOS A ESA IGLESIA
    if (maestro_nombre && Array.isArray(maestro_nombre)) {
      for (let i = 0; i < maestro_nombre.length; i++) {
        const nombreM = maestro_nombre[i];
        const telefonoM = maestro_telefono[i];
        const correoM = maestro_correo[i] || null;

        const queryMaestro = `
          INSERT INTO maestros (iglesia_id, nombre, telefono, correo) 
          VALUES ($1, $2, $3, $4);
        `;
        await pool.query(queryMaestro, [iglesiaId, nombreM, telefonoM, correoM]);
      }
    }
    */

    // Respuesta exitosa al cliente
    res.render('index', { 
      mensajeExito: '¡Registro y maestros guardados correctamente en la base de datos!', 
      mensajeError: null 
    });

  } catch (error) {
    console.error("Error al procesar el registro:", error);
    res.render('index', { 
      mensajeExito: null, 
      mensajeError: 'Ocurrió un error al guardar el registro. Por favor intente de nuevo.' 
    });
  }
});

// Puerto de escucha para Render / Local
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor corriendo exitosamente en el puerto ${PORT}`);
});
