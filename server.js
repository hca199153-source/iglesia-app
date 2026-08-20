const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configuración de conexión a PostgreSQL / Supabase
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Requerido para conexiones a Supabase desde Render u otros hosts
  }
});

// Ruta POST para procesar el formulario
app.post('/api/registrar', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      nombre_pastor,
      telefono_pastor,
      correo_pastor,
      nombre_iglesia,
      direccion,
      num_maestros,
      nombre_lider,
      telefono_lider,
      correo_lider,
      num_cajas,
      maestros // Espera un arreglo de objetos: [{ nombre, telefono, correo }, ...]
    } = req.body;

    // Iniciar Transacción SQL
    await client.query('BEGIN');

    // 1. Insertar en la tabla 'registros'
    const insertRegistroQuery = `
      INSERT INTO registros (
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
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id;
    `;

    const registroValues = [
      nombre_pastor || null,
      telefono_pastor || null,
      correo_pastor || null,
      nombre_iglesia || null,
      direccion || null,
      num_maestros ? parseInt(num_maestros, 10) : 0,
      nombre_lider || null,
      telefono_lider || null,
      correo_lider || null,
      num_cajas ? parseInt(num_cajas, 10) : 0
    ];

    const result = await client.query(insertRegistroQuery, registroValues);
    const nuevoRegistroId = result.rows[0].id;

    // 2. Insertar en la tabla 'maestros' si existen datos en el arreglo
    if (Array.isArray(maestros) && maestros.length > 0) {
      const insertMaestroQuery = `
        INSERT INTO maestros (registro_id, nombre, telefono, correo)
        VALUES ($1, $2, $3, $4);
      `;

      for (const maestro of maestros) {
        if (maestro.nombre) { // Solo inserta si al menos tiene nombre
          await client.query(insertMaestroQuery, [
            nuevoRegistroId,
            maestro.nombre,
            maestro.telefono || null,
            maestro.correo || null
          ]);
        }
      }
    }

    // Confirmar cambios
    await client.query('COMMIT');

    res.status(200).json({
      success: true,
      message: 'Registro y maestros guardados correctamente.',
      id: nuevoRegistroId
    });

  } catch (error) {
    // Si algo falla, revertir los cambios
    await client.query('ROLLBACK');
    console.error('Error al guardar el registro:', error);

    res.status(500).json({
      success: false,
      message: 'Error interno del servidor al procesar el registro.',
      error: error.message
    });

  } finally {
    client.release();
  }
});

// Inicializar el servidor
app.listen(port, () => {
  console.log(`Servidor corriendo en el puerto ${port}`);
});
