const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

app.post('/guardar', async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      nombre_pastor,
      telefono_pastor,
      correo_pastor,
      nombre_iglesia,
      direccion,
      num_cajas,
      nombre_lider,
      telefono_lider,
      correo_lider,
      maestro_nombre,
      maestro_telefono,
      maestro_correo
    } = req.body;

    await client.query('BEGIN');

    // 1. Guardar la iglesia en la tabla 'registros' y obtener su ID
    const resRegistro = await client.query(
      `INSERT INTO registros 
       (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, num_cajas, nombre_lider, telefono_lider, correo_lider) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id`,
      [
        nombre_pastor || null,
        telefono_pastor || null,
        correo_pastor || null,
        nombre_iglesia || null,
        direccion || null,
        parseInt(num_cajas, 10) || 50,
        nombre_lider || null,
        telefono_lider || null,
        correo_lider || null
      ]
    );

    const registroId = resRegistro.rows[0].id;

    // 2. Normalizar datos de maestros (convierte a Array si llega solo un elemento o múltiples)
    let nombres = Array.isArray(maestro_nombre) ? maestro_nombre : (maestro_nombre ? [maestro_nombre] : []);
    let telefonos = Array.isArray(maestro_telefono) ? maestro_telefono : (maestro_telefono ? [maestro_telefono] : []);
    let correos = Array.isArray(maestro_correo) ? maestro_correo : (maestro_correo ? [maestro_correo] : []);

    // 3. Guardar cada maestro vinculado al 'registro_id'
    for (let i = 0; i < nombres.length; i++) {
      if (nombres[i] && nombres[i].trim() !== '') {
        await client.query(
          `INSERT INTO maestros (registro_id, nombre, telefono, correo)
           VALUES ($1, $2, $3, $4)`,
          [
            registroId,
            nombres[i] || null,
            telefonos[i] || null,
            correos[i] || null
          ]
        );
      }
    }

    await client.query('COMMIT');
    res.render('index', { mensajeExito: '¡Registro y maestros guardados con éxito!', mensajeError: null });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error SQL al guardar:", error);
    res.render('index', { mensajeExito: null, mensajeError: `Error en BD: ${error.message}` });
  } finally {
    client.release();
  }
});

app.get('/admin', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM registros ORDER BY id ASC');
    res.render('admin', { registros: result.rows });
  } catch (error) {
    console.error("Error al cargar admin:", error);
    res.render('admin', { registros: [] });
  }
});

app.post('/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM registros WHERE id = $1', [id]);
    res.redirect('/admin');
  } catch (err) {
    console.error("Error al eliminar:", err);
    res.redirect('/admin');
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor activo en el puerto ${PORT}`);
});
