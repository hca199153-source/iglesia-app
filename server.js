const express = require('express');
const { Pool } = require('pg');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Configuración de la base de datos PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Configuración de EJS y Archivos Estáticos
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// RUTA PRINCIPAL (Renderiza index.ejs)
app.get('/', (req, res) => {
  const mensajeExito = req.query.exito || '';
  const mensajeError = req.query.error || '';

  res.render('index', { 
    mensajeExito: mensajeExito, 
    mensajeError: mensajeError 
  });
});

// RUTA POST: Guardar cliente y maestros
app.post('/guardar', async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      nombre_completo,
      telefono,
      correo,
      calle_numero,
      colonia,
      ciudad_estado,
      cajas,
      maestro_nombre,
      maestro_telefono,
      maestro_correo
    } = req.body;

    await client.query('BEGIN');

    // 1. Insertar el cliente principal
    const queryCliente = `
      INSERT INTO clientes (nombre_completo, telefono, correo, calle_numero, colonia, ciudad_estado, cajas)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id;
    `;
    const valuesCliente = [
      nombre_completo,
      telefono,
      correo,
      calle_numero,
      colonia,
      ciudad_estado,
      cajas
    ];

    const resultCliente = await client.query(queryCliente, valuesCliente);
    const clienteId = resultCliente.rows[0].id;

    // 2. Insertar los maestros (si existen)
    if (maestro_nombre && Array.isArray(maestro_nombre)) {
      const queryMaestro = `
        INSERT INTO maestros (cliente_id, nombre_completo, telefono, correo)
        VALUES ($1, $2, $3, $4);
      `;

      for (let i = 0; i < maestro_nombre.length; i++) {
        if (maestro_nombre[i] && maestro_nombre[i].trim() !== '') {
          await client.query(queryMaestro, [
            clienteId,
            maestro_nombre[i],
            maestro_telefono[i] || null,
            maestro_correo[i] || null
          ]);
        }
      }
    } else if (maestro_nombre && typeof maestro_nombre === 'string') {
      // En caso de que se envíe un único maestro como string
      const queryMaestro = `
        INSERT INTO maestros (cliente_id, nombre_completo, telefono, correo)
        VALUES ($1, $2, $3, $4);
      `;
      await client.query(queryMaestro, [
        clienteId,
        maestro_nombre,
        maestro_telefono || null,
        maestro_correo || null
      ]);
    }

    await client.query('COMMIT');

    // Redirecciona agregando el parámetro de éxito para que index.ejs lo detecte
    res.redirect('/?exito=' + encodeURIComponent('¡Registro guardado exitosamente!'));

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al guardar registro:', error);
    res.redirect('/?error=' + encodeURIComponent('Ocurrió un error al guardar los datos. Inténtalo de nuevo.'));
  } finally {
    client.release();
  }
});

// Iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});
