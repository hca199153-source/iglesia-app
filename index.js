const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Configuración de la base de datos PostgreSQL[cite: 3]
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Middleware[cite: 3]
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Motor de plantillas EJS[cite: 3]
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ==========================================
// 1. RUTA PRINCIPAL (FORMULARIO DE REGISTRO)
// ==========================================
app.get('/', (req, res) => {
  res.render('index', { mensajeExito: null, mensajeError: null });
});

// ==========================================
// 2. RUTA PARA GUARDAR UN REGISTRO
// ==========================================
app.post('/guardar', async (req, res) => {
  const {
    nombre_pastor, telefono_pastor, correo_pastor,
    nombre_iglesia, direccion,
    nombre_lider, telefono_lider, correo_lider,
    num_cajas,
    maestro_nombre, maestro_telefono, maestro_correo
  } = req.body;

  const client = await pool.connect();

  try {
    // Iniciar transacción SQL para guardar iglesia + maestros juntos[cite: 3]
    await client.query('BEGIN');

    // Insertar Iglesia / Registro Principal[cite: 3]
    const insertIglesiaQuery = `
      INSERT INTO registros_iglesias 
      (nombre_pastor, telefono_pastor, correo_pastor, nombre_iglesia, direccion, nombre_lider, telefono_lider, correo_lider, num_cajas, fecha_registro)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      RETURNING id;
    `;
    const iglesiaValues = [
      nombre_pastor, telefono_pastor, correo_pastor || null,
      nombre_iglesia, direccion || null,
      nombre_lider, telefono_lider, correo_lider || null,
      parseInt(num_cajas)
    ];

    const result = await client.query(insertIglesiaQuery, iglesiaValues);
    const iglesiaId = result.rows[0].id;

    // Insertar Maestros (Acepta arreglo dinámico de inputs)[cite: 3]
    if (maestro_nombre && Array.isArray(maestro_nombre)) {
      const insertMaestroQuery = `
        INSERT INTO maestros (iglesia_id, nombre, telefono, correo)
        VALUES ($1, $2, $3, $4);
      `;
      for (let i = 0; i < maestro_nombre.length; i++) {
        if (maestro_nombre[i] && maestro_nombre[i].trim() !== '') {
          await client.query(insertMaestroQuery, [
            iglesiaId,
            maestro_nombre[i],
            maestro_telefono[i],
            maestro_correo[i] || null
          ]);
        }
      }
    } else if (maestro_nombre && typeof maestro_nombre === 'string') {
      // Caso cuando solo viene 1 maestro[cite: 3]
      const insertMaestroQuery = `
        INSERT INTO maestros (iglesia_id, nombre, telefono, correo)
        VALUES ($1, $2, $3, $4);
      `;
      await client.query(insertMaestroQuery, [
        iglesiaId,
        maestro_nombre,
        maestro_telefono,
        maestro_correo || null
      ]);
    }

    await client.query('COMMIT');
    
    res.render('index', { 
      mensajeExito: '¡Registro guardado exitosamente!', 
      mensajeError: null 
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar el registro:', error);
    res.render('index', { 
      mensajeExito: null, 
      mensajeError: 'Ocurrió un error al procesar el registro. Inténtalo de nuevo.' 
    });
  } finally {
    client.release();
  }
});

// ==========================================
// 3. RUTA PANEL ADMINISTRATIVO (ADMIN)
// ==========================================
app.get('/admin', async (req, res) => {
  try {
    // Obtener todas las iglesias[cite: 3]
    const iglesiasQuery = 'SELECT * FROM registros_iglesias ORDER BY id DESC;';
    const iglesiasResult = await pool.query(iglesiasQuery);
    const iglesias = iglesiasResult.rows;

    // Obtener los maestros asociados a cada iglesia[cite: 3]
    for (let iglesia of iglesias) {
      const maestrosQuery = 'SELECT nombre, telefono, correo FROM maestros WHERE iglesia_id = $1 ORDER BY id ASC;';
      const maestrosResult = await pool.query(maestrosQuery, [iglesia.id]);
      iglesia.maestros = maestrosResult.rows;
    }

    res.render('admin', { registros: iglesias });
  } catch (error) {
    console.error('Error al consultar la base de datos:', error);
    res.status(500).send('Error interno del servidor.');
  }
});

// ==========================================
// 4. RUTA PARA ELIMINAR UN REGISTRO (DELETE)
// ==========================================
app.post('/eliminar/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Borrar maestros vinculados[cite: 3]
    await client.query('DELETE FROM maestros WHERE iglesia_id = $1;', [id]);

    // 2. Borrar registro principal de la iglesia[cite: 3]
    await client.query('DELETE FROM registros_iglesias WHERE id = $1;', [id]);

    await client.query('COMMIT');
    res.redirect('/admin');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al borrar el registro:', error);
    res.status(500).send('Error al intentar eliminar el registro.');
  } finally {
    client.release();
  }
});

// Arrancar el Servidor[cite: 3]
app.listen(port, () => {
  console.log(`Servidor activo en el puerto ${port}`);
});
