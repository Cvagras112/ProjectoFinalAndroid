# App Android BORA

## Abrir y ejecutar

Abre la carpeta `android/` en Android Studio y espera la sincronización de Gradle. El proyecto usa Kotlin, Jetpack Compose/Material 3, Firebase Authentication, Cloud Firestore, Storage, Credential Manager y Firebase Messaging. `minSdk = 24`; la versión mínima debe confirmarse con los teléfonos observados en el levantamiento.

Esta copia del proyecto mantiene los archivos, fuentes y configuración dentro de la unidad D:. El directorio de Gradle está configurado en `../.gradle-home` y npm en `../.npm-cache`; conserva `GRADLE_USER_HOME` y `npm_config_cache` apuntando a D: antes de sincronizar o instalar dependencias. No guardes credenciales ni claves privadas en Git.

## Arquitectura Android

- `data/`: modelos y repositorios para Firebase (productos, ventas, acceso, ferias y seguimiento).
- `ui/`: pantallas Compose y ViewModels; las pantallas no consultan Firestore directamente.
- `backend/firestore.rules`: autorización y validación de documentos, acompañada de pruebas del Emulator Suite.

## Flujos disponibles

- Comprador: ingresa con Google, explora catálogo y ferias, puede seguir la tienda desde una ficha de producto. La app solicita permiso de notificaciones al activar avisos. La ubicación se solicita solo al elegir ordenar ferias por cercanía; no se sube a Firebase.
- Emprendedora: correo y contraseña, catálogo/productos, registro e historial de ventas y calendario de invitaciones. Puede aceptar o rechazar una invitación.
- Las rutas de feria se abren en la app de mapas instalada usando las coordenadas guardadas.
- Los datos de producto no enviados se conservan localmente en el dispositivo; los permisos de lectura de galería se retienen cuando Android lo permite.

## Preparación de Firebase pendiente

1. Habilitar Google Sign-In y registrar el SHA-1 de la app.
2. Confirmar la edición, región y base Firestore del proyecto correcto.
3. Crear perfiles de emprendedoras desde un canal administrador seguro.
4. Configurar y validar Emulator Suite y las reglas.
5. Instalar las dependencias de `backend/functions/` con caché npm en D: y desplegar la función `notifyFollowersWhenStoreConfirmsFair` después de revisar el proyecto. Android registra tokens y recibe mensajes; no envía notificaciones masivas desde el cliente. La función actual cubre tiendas; las asociaciones aún requieren el esquema de participantes y su trigger. La entrega FCM no se prueba con la suite de reglas local.
6. Desplegar el índice de colección de seguimientos definido en `backend/firestore.indexes.json`.
6. Separar documentos públicos del inventario privado antes de publicar datos de productos no disponibles.

## Calidad y accesibilidad

La interfaz debe probarse con texto del sistema aumentado, TalkBack, orientación horizontal, zonas táctiles de al menos 48 dp y conexiones intermitentes. Las pantallas usan desplazamiento vertical y textos acompañados por botones. Validar con emprendedoras reales antes de cerrar la entrega; aún no se ha realizado esa validación.

### Guion de validación con usuarias

- Crear un producto interrumpiendo el flujo y reabrirlo; comprobar que nombre, precio, categoría, variante, stock y fotos persisten.
- Editar disponibilidad y agotamiento; confirmar qué ve una persona compradora.
- Registrar ventas con/sin stock, con variante y pieza única; verificar el historial privado.
- Recibir invitación, confirmar/rechazar y abrir ruta de feria.
- Denegar ubicación y notificaciones; comprobar que catálogo y calendario siguen operativos.
- Completar las tareas con TalkBack y tamaño de texto grande; anotar dificultad, lenguaje confuso y errores observados.

Registrar fecha, perfil de participante con consentimiento, tarea, resultado y cambios acordados. No anotar nombres ni datos personales innecesarios.

## Trabajo con Git

- Proteger `main`; crear ramas cortas `feature/<modulo>-<tarea>` o `fix/<tarea>`.
- Abrir Pull Request por issue, describir criterios de aceptación y adjuntar evidencia de revisión; otra persona del equipo revisa antes de integrar.
- Usar commits descriptivos, por ejemplo `feat(android): agregar respuestas a invitaciones`.
- Etiquetar entregas como `entrega-N`; enlazar issues con PR y registrar contribuciones del equipo.
- No subir `local.properties`, tokens, credenciales de servicio ni datos reales.

## Decisiones del levantamiento

No hay ficha de levantamiento ni hallazgos H01…H__ guardados en este checkout. Por lo tanto, las categorías de productos, los tipos libres, los sectores y los campos específicos son provisionales y deben contrastarse con la contraparte. No se inventan resultados de entrevistas.

- Se conserva el modo de comprador con Google y el acceso de emprendedora con credenciales del administrador.
- La app funciona sin IA; el módulo IA no se incluye.
- GPS es opcional y de uso puntual; si falta permiso o ubicación reciente, se mantiene el orden por fecha.
- La ruta se delega a una aplicación de mapas, sin clave de Maps incrustada.
- Administrador necesita un panel seguro para crear/modificar ferias, invitaciones, asociaciones y cuentas; esa interfaz aún no existe en Android.
- Definir en levantamiento campos por tipo de producto, manejo de pedidos/entrega, sectores, asociaciones, contactos y política de precios.

## Pruebas de reglas

Desde `backend/`, instala dependencias con npm (la caché debe estar en D:) y ejecuta `npm run test:rules`. La suite inicia Firestore Emulator con el proyecto ficticio `demo-bora`; nunca apunta al proyecto productivo.
