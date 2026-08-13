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
      correo_lider
    } = req.body;

    await pool.query(
      `INSERT INTO registros 
       (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, num_maestros, nombre_lider, telefono_lider, correo_lider) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        nombre_pastor || null,
        telefono_pastor || null,
        correo_pastor || null,
        nombre_iglesia || null,
        direccion || null,
        parseInt(num_maestros, 10) || 0,
        nombre_lider || null,
        telefono_lider || null,
        correo_lider || null
      ]
    );

    res.render('index', { mensajeExito: '¡Registro guardado con éxito!', mensajeError: null });
  } catch (error) {
    console.error("Error SQL al guardar:", error);
    res.render('index', { mensajeExito: null, mensajeError: `Error en BD: ${error.message}` });
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
