const express = require('express');
const path = require('path');
const { Pool } = require('pg');

const app = express();

// Conexión a PostgreSQL en Supabase usando DATABASE_URL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Configuración de EJS y middlewares
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// 1. RUTA PRINCIPAL (Formulario)
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// 2. GUARDAR REGISTRO DEL FORMULARIO
app.post('/guardar', async (req, res) => {
  try {
    // Se obtienen los datos enviados desde el formulario HTML
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

    // Inserción en la tabla de la base de datos
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
        num_maestros || 0,
        nombre_lider || null,
        telefono_lider || null,
        correo_lider || null
      ]
    );

    res.render('index', { mensajeExito: '¡Registro guardado con éxito!', mensajeError: null });
  } catch (error) {
    console.error("Error al guardar en BD:", error);
    res.render('index', { mensajeExito: null, mensajeError: 'Error al guardar los datos.' });
  }
});

// 3. PANEL DE ADMINISTRACIÓN
app.get('/admin', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM registros ORDER BY id ASC');
    res.render('admin', { registros: result.rows });
  } catch (error) {
    console.error("Error al cargar admin:", error);
    res.render('admin', { registros: [] });
  }
});

// 4. ELIMINAR REGISTRO (Soluciona Cannot POST /eliminar/:id)
app.post('/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM registros WHERE id = $1', [id]);
    res.redirect('/admin');
  } catch (err) {
    console.error("Error al eliminar registro:", err);
    res.redirect('/admin');
  }
});

// Puerto de ejecución
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Servidor iniciado correctamente en puerto ${PORT}`);
});
