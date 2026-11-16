// Componentes públicos reales con servicios sustituidos por cada prueba.
// No carga la configuración de Firebase ni permite acceder a producción.
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { SourceTextModule, SyntheticModule } from 'node:vm'
import { createElement } from 'react'
import * as jsx from 'react/jsx-runtime'
import { transformWithOxc } from 'vite'
import * as productos from '../src/services/productos/productoModelo.js'
import * as tiendas from '../src/services/tiendas/tiendaPublicaModelo.js'

export async function cargarComponentePublico(archivo, dependencias) {
  const fuente = await readFile(new URL(archivo, import.meta.url), 'utf8')
  const codigo = (await transformWithOxc(fuente, archivo, { jsx: { runtime: 'automatic' } })).code
  const modulo = new SourceTextModule(codigo)
  await modulo.link(async nombre => {
    const valores = dependencias[nombre]
    assert.ok(valores, `Dependencia inesperada: ${nombre}`)
    return new SyntheticModule(Object.keys(valores), function () {
      for (const [clave, valor] of Object.entries(valores)) this.setExport(clave, valor)
    })
  })
  await modulo.evaluate()
  return modulo.namespace
}

export async function componentesCatalogo(hooks) {
  const router = { Link: ({ to, children, ...props }) => createElement('a', { ...props, href: to }, children) }
  const contactos = await cargarComponentePublico('../src/components/ContactosPublicos.jsx', {
    'react/jsx-runtime': jsx, '../services/tiendas/tiendaPublicaModelo': tiendas, './ContactosPublicos.css': {},
  })
  const tarjeta = await cargarComponentePublico('../src/components/public/TarjetaProductoPublica.jsx', {
    'react/jsx-runtime': jsx, 'react-router-dom': router,
    '../BotonFavorito': { default: ({ productoId }) => createElement('button', { 'data-favorito': productoId }, 'Favorito') },
    '../ImagenPublica': { default: ({ respaldo, ...props }) => createElement('img', { ...props, src: props.src || respaldo }) },
    '../ContactosPublicos': contactos, '../../services/productos/productoModelo': productos, './CatalogoPublico.css': {},
  })
  const catalogo = await cargarComponentePublico('../src/components/public/CatalogoPublico.jsx', {
    react: hooks, 'react/jsx-runtime': jsx,
    '../../services/productos/productoModelo': productos,
    './TarjetaProductoPublica': tarjeta, './CatalogoPublico.css': {},
  })
  return { catalogo, tarjeta }
}
