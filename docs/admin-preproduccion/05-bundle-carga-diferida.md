# Análisis del bundle y estrategia propuesta

Medición local con Vite 8.3.5, build({build:{write:false}}), sin alterar App.jsx,
vite.config.js, dist ni archivos preparados. No se ejecutó código contra Firebase.

## Evidencia

Un chunk JavaScript: assets/index-BMKC0i4t.js.
1.064.450 bytes minificados; 307.371 bytes gzip con node:zlib (aprox. 300 KiB).
162 módulos transformados; 111 módulos atribuidos al chunk por el bundler.
La medición gzip puede diferir del nivel de compresión usado por el reporte Vite.

Principales grupos según renderedLength del bundler, ANTES de la minificación
final; no son tamaños de descarga y no deben sumarse como porcentajes del gzip:

| Grupo | Longitud renderizada aproximada |
|---|---:|
| react-dom | 536.687 |
| @firebase/firestore | 425.577 |
| Código del proyecto | 411.525 |
| re2js | 228.091 |
| @firebase/auth | 154.039 |
| react-router | 91.609 |
| @firebase/webchannel-wrapper | 70.585 |

No hay aún medición de carga inicial en red ni LCP/INP en navegador; no se promete
un porcentaje de mejora. re2js requiere revisar su cadena de importación antes
de plantear sustituciones; no retirar dependencias por tamaño solamente.

## Causas y estrategia por fases

App.jsx importa estáticamente todas las páginas, incluido AdminDashboard y
PanelEmprendedor. AdminDashboard importa todos sus módulos. Navegar a la portada
descarga código que solo usa un administrador o una emprendedora.

1. Medir portada, /admin y /panel-emprendedora con caché fría/caliente, red móvil
   controlada, tamaños transferidos, tiempo hasta contenido y navegación.
2. Primera propuesta: React.lazy + Suspense por rutas, empezando por los paneles.
   Mantener Navbar y layout común; añadir fallback accesible y recuperación ante
   fallo de carga de chunk. Preservar las rutas protegidas y sus decisiones de rol.
3. Después, lazy de secciones administrativas si sigue aportando reducción. Esto
   requiere autorización específica para AdminDashboard.jsx, uno de los 15
   archivos preparados. Evitar precargar indiscriminadamente todas las secciones.
4. Medir SDKs compartidos: Firebase importado desde Navbar/auth puede permanecer
   en el camino inicial. Separar chunks no implica que se descarguen más tarde si
   siguen siendo dependencias iniciales. No modificar auth compartida sin revisión.
5. Solo con evidencia, evaluar codeSplitting de Rolldown en Vite 8. No copiar
   manualChunks de versiones antiguas sin verificar compatibilidad. No aumentar
   chunkSizeWarningLimit como solución ni eliminar dependencias activas.

Archivos candidatos: web/src/App.jsx (compartido, coordinación),
web/src/pages/admin/AdminDashboard.jsx (David, preparado, autorización),
web/vite.config.js (configuración compartida, solo si se justifica), y pruebas.
No se propone modificar inventario, ventas, solicitudes ni servicios de otros.

## Criterio de cierre

- Comparación reproducible de JS inicial transferido y tiempos por ruta.
- Paneles no incluidos innecesariamente en la descarga inicial de la portada.
- Carga diferida no dispara consultas de módulos todavía no utilizados.
- Login, autorización, refresco de URL, navegación atrás/adelante y enlaces directos
  funcionan; CSS sin regresiones y estados de espera/error accesibles.
- Probar chunk fallido/desactualizado sin bucles de recarga ni pérdida de formulario.
- Regresiones, lint y build aprobados. Es aceptable un chunk compartido grande si
  está medido y justificado; la advertencia de tamaño por sí sola no es un fallo
  funcional ni acredita una vulnerabilidad.
