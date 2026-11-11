# Datos de desarrollo Android

Usa Emulator Suite con el identificador ficticio `demo-bora`. El script de seed exige Firestore y Authentication Emulator y se detiene si falta cualquiera; nunca escribe a producción.

## Instalar dependencias

En PowerShell, desde `backend/`:

```powershell
npm install --cache D:\universiddad\BORA_android_y_web\.npm-cache
Push-Location functions
npm install --cache D:\universiddad\BORA_android_y_web\.npm-cache
Pop-Location
```

El npm cache y los directorios `node_modules` quedan bajo D:.

## Cargar datos falsos

En la terminal que inicia emuladores, define estas variables y arranca Auth/Firestore:

```powershell
$env:GCLOUD_PROJECT = "demo-bora"
$env:FIREBASE_EMULATORS_PATH = "D:\universiddad\BORA_android_y_web\backend\.firebase-emulators"
$env:FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080"
$env:FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099"
npx firebase emulators:start --project demo-bora --only auth,firestore
```

En otra terminal PowerShell, desde `backend/`, define las mismas variables de entorno y ejecuta:

```powershell
npm run seed:dev
```

Cuentas de prueba: `emprendedora@example.test`, `admin@example.test`, `comprador@example.test`. Contraseña solo de emulador: `solo-emulador-123`. El seed crea perfiles, una tienda, asociación, producto, feria e invitación ficticios.

El envío FCM requiere credenciales de Firebase y no forma parte de esta suite local. No simules confirmaciones con tokens reales en un proyecto compartido.

## Suite de reglas

Desde `backend/`, ejecuta `npm run test:rules`. Esta orden usa el proyecto de prueba `demo-bora`, inicia Firestore Emulator y guarda el binario en `backend/.firebase-emulators` (ignorado por Git).

## Limpiar

Detén Emulator Suite y elimina el estado local. No importes estos documentos a producción. No guardes service-account keys ni credenciales reales en el repositorio.
