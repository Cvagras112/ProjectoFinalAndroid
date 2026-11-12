// Preparación de datos. La autoridad final son las reglas Firestore, no el cliente.
const fail = (message) => {
  const error = new Error(message);
  error.code = "inventario/validacion";
  throw error;
};
const entero = (value, min = 0, max = 100000) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    fail("Cantidad o precio fuera de rango.");
  }
  return value;
};
const texto = (value, max, obligatorio = false) => {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (obligatorio && !value.trim())
  ) {
    fail("Revisa los campos de texto.");
  }
  return value.trim();
};
const prepararProducto = (datos, anterior = {}) => {
  const p = {...anterior};
  for (const [campo, max, obligatorio] of [
    ["Nombre", 150, true],
    ["Categoria", 100, true],
    ["Descripcion", 2000, false],
    ["imagen", 2000, false],
  ]) {
    p[campo] = texto(
        datos[campo] ?? anterior[campo] ?? "",
        max,
        obligatorio,
    );
  }
  if (p.imagen && !/^https?:\/\/\S+$/.test(p.imagen)) {
    fail("Imagen inválida.");
  }
  p.Precio = entero(datos.Precio ?? anterior.Precio, 1, 999999999);
  p.Stock = entero(datos.Stock ?? anterior.Stock ?? 0, 0, 1000000);
  for (const campo of [
    "Disponible",
    "OfrecerPedido",
    "PiezaUnica",
    "ManejaStock",
  ]) {
    const valor =
      datos[campo] ??
      anterior[campo] ??
      (campo === "Disponible" || campo === "ManejaStock");
    if (typeof valor !== "boolean") fail("Configuración inválida.");
    p[campo] = valor;
  }
  p.AccionAgotado =
    datos.AccionAgotado ?? anterior.AccionAgotado ?? "mostrar";
  if (!["mostrar", "ocultar", "pedido"].includes(p.AccionAgotado)) {
    fail("Modalidad inválida.");
  }
  const variantes = datos.Variantes ?? anterior.Variantes ?? [];
  if (!Array.isArray(variantes) || variantes.length > 10) {
    fail("Máximo diez variantes.");
  }
  const ids = new Set();
  p.Variantes = variantes.map((v) => {
    const id = texto(v.id, 64, true);
    if (ids.has(id) || id.includes("/")) {
      fail("Identificador de variante duplicado o inválido.");
    }
    ids.add(id);
    const imageUrl = texto(v.imageUrl ?? "", 2000);
    if (imageUrl && !/^https?:\/\/\S+$/.test(imageUrl)) {
      fail("Imagen de variante inválida.");
    }
    if (typeof (v.active ?? true) !== "boolean") {
      fail("Disponibilidad de variante inválida.");
    }
    return {
      id,
      name: texto(v.name, 150, true),
      price: entero(v.price, 1, 999999999),
      stock: entero(v.stock),
      imageUrl,
      imagePath: texto(v.imagePath ?? "", 512),
      active: v.active !== false,
    };
  });
  // No borrar identidades utilizadas por ventas anteriores.
  for (const v of anterior.Variantes || []) {
    if (!ids.has(v.id)) p.Variantes.push({...v, active: false});
  }
  if (p.Variantes.length) {
    p.ManejaStock = true;
    p.Stock = p.Variantes.filter((v) => v.active)
        .reduce((total, v) => total + v.stock, 0);
  }
  if (p.Variantes.length > 10) {
    fail(
        "Máximo diez variantes; edita o desactiva las existentes.",
    );
  }
  p.Vendido = anterior.Vendido === true;
  if (p.Vendido) p.Disponible = false;
  p.UltimaVenta = anterior.UltimaVenta || "";
  p.Revision = (anterior.Revision || 0) + 1;
  return p;
};
const prepararVenta = (producto, solicitud) => {
  const cantidad = entero(solicitud.cantidad, 1);
  if (producto.Disponible === false || producto.Vendido) {
    fail("El producto no está disponible.");
  }
  const variantes = producto.Variantes || [];
  const variante = variantes.length ?
    variantes.find(
        (v) => v.id === solicitud.varianteId && v.active !== false,
    ) :
    null;
  if (variantes.length && !variante) {
    fail("Selecciona una variante disponible.");
  }
  if (!variantes.length && solicitud.varianteId) {
    fail("Este producto no tiene variantes.");
  }
  if (producto.PiezaUnica && cantidad !== 1) {
    fail("Una pieza única se vende de a una.");
  }
  const stock = entero(variante ? variante.stock : producto.Stock, 0, 1000000);
  // La modalidad a pedido no autoriza sobregiros de inventario.
  const manejaStock = variantes.length > 0 || producto.ManejaStock !== false;
  if (manejaStock && stock < cantidad) {
    fail("No hay stock suficiente.");
  }
  const precio = entero(
    variante ? variante.price : producto.Precio,
    1,
    999999999,
  );
  const cambios = {Revision: (producto.Revision || 0) + 1};
  if (variantes.length || producto.ManejaStock !== false) {
    if (variante) {
      cambios.Variantes = variantes.map((v) =>
        v.id === variante.id ? {...v, stock: v.stock - cantidad} : v,
      );
    } else cambios.Stock = stock - cantidad;
  }
  if (cambios.Variantes) {
    cambios.Stock = cambios.Variantes.filter((v) => v.active !== false)
        .reduce((total, v) => total + v.stock, 0);
  }
  if (producto.PiezaUnica) {
    Object.assign(cambios, {Vendido: true, Disponible: false});
  }
  return {
    cambios,
    venta: {
      productoNombre: producto.Nombre,
      varianteId: variante?.id || "",
      varianteNombre: variante?.name || "",
      cantidad,
      precioUnitario: precio,
      total: precio * cantidad,
    },
  };
};
export {prepararProducto, prepararVenta};
