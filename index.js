// ==========================================
// RUTAS DEL ADMINISTRADOR (EDITAR Y ELIMINAR)
// ==========================================

// 1. Mostrar Formulario para Editar
app.get('/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { data: registro, error } = await supabase
      .from('registros')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !registro) return res.redirect('/admin');
    
    res.render('editar', { registro });
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});

// 2. Procesar Edición
app.post('/editar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('registros')
      .update(req.body)
      .eq('id', id);

    if (error) console.error("Error al editar:", error);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});

// 3. Eliminar Registro (Resuelve el Cannot POST /eliminar/:id)
app.post('/eliminar/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { error } = await supabase
      .from('registros')
      .delete()
      .eq('id', id);

    if (error) console.error("Error al eliminar:", error);
    res.redirect('/admin');
  } catch (err) {
    console.error(err);
    res.redirect('/admin');
  }
});
