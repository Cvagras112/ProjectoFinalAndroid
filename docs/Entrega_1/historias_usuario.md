# BORA

## Historias de usuario

Las siguientes historias de usuario representan los flujos principales
definidos para BORA. Cada historia se encuentra asociada a un requisito
funcional mediante un identificador único, permitiendo mantener la
trazabilidad entre los requisitos, el mapa de navegación y el modelo
conceptual del sistema.

---

# 4.1 Emprendedora

## RF-AUT-01 — Ingresar a la aplicación con huella

**Historia de usuario:**

Como emprendedora, quiero ingresar a BORA utilizando mi huella digital,
para acceder a mi cuenta de forma rápida y segura sin tener que ingresar
mis credenciales cada vez.

**Criterios de aceptación:**

- La emprendedora debe tener una cuenta previamente registrada.
- La aplicación debe permitir utilizar autenticación biométrica cuando
  el dispositivo sea compatible.
- La huella debe ser validada antes de permitir el acceso.
- Si la autenticación biométrica falla, el sistema debe impedir el acceso.
- Debe existir una alternativa de acceso cuando la autenticación biométrica
  no esté disponible.

---

## RF-PRO-01 — Crear un producto

**Historia de usuario:**

Como emprendedora, quiero registrar un producto en mi tienda,
para mostrarlo a potenciales compradores dentro de BORA.

**Criterios de aceptación:**

- La emprendedora debe poder ingresar el nombre del producto.
- Debe poder incorporar una descripción.
- Debe poder indicar el precio.
- Debe poder agregar una imagen del producto.
- El producto debe quedar asociado a su tienda.
- La información obligatoria debe ser validada antes de guardar.
- Una vez registrado, el producto debe estar disponible en el catálogo
  de la tienda.

---

## RF-VEN-01 — Registrar una venta

**Historia de usuario:**

Como emprendedora, quiero registrar una venta realizada,
para mantener un registro de los productos vendidos y apoyar el control
de mi emprendimiento.

**Criterios de aceptación:**

- La emprendedora debe poder seleccionar el producto vendido.
- Debe poder indicar la cantidad vendida.
- La venta debe registrar su fecha.
- La venta debe quedar asociada a la emprendedora y al producto correspondiente.
- Si el producto utiliza control de stock, la cantidad disponible deberá
  actualizarse según las reglas definidas para ese tipo de producto.

---

## RF-FER-01 — Responder una invitación a feria

**Historia de usuario:**

Como emprendedora, quiero recibir y responder invitaciones para participar
en una feria, para confirmar si mi emprendimiento participará en el evento.

**Criterios de aceptación:**

- La emprendedora debe poder visualizar las invitaciones recibidas.
- Debe poder consultar información básica de la feria.
- Debe poder aceptar o rechazar una invitación.
- El sistema debe registrar la respuesta seleccionada.
- La respuesta debe quedar asociada a la feria y a la emprendedora invitada.

---

## RF-TIE-01 — Compartir mi tienda

**Historia de usuario:**

Como emprendedora, quiero compartir mi tienda de BORA,
para darla a conocer a potenciales compradores mediante otros medios
digitales.

**Criterios de aceptación:**

- La emprendedora debe disponer de una opción para compartir su tienda.
- La tienda compartida debe dirigir a la vitrina correspondiente.
- La información compartida debe permitir identificar el emprendimiento.
- La opción debe utilizar los mecanismos de compartir disponibles en
  el dispositivo cuando corresponda.

---

# 4.2 Comprador

## RF-BUS-01 — Encontrar una tienda

**Historia de usuario:**

Como comprador, quiero buscar y encontrar una tienda dentro de BORA,
para descubrir emprendimientos y acceder a los productos que ofrecen.

**Criterios de aceptación:**

- El comprador debe poder visualizar tiendas disponibles.
- Debe existir una forma de localizar una tienda.
- Cada resultado debe permitir identificar el emprendimiento.
- Al seleccionar una tienda, el comprador debe poder acceder a su vitrina.

---

## RF-PRO-02 — Ver los productos de una tienda

**Historia de usuario:**

Como comprador, quiero visualizar los productos publicados por una tienda,
para conocer qué ofrece antes de decidir si deseo contactar a la emprendedora.

**Criterios de aceptación:**

- El comprador debe poder acceder al catálogo de la tienda.
- Cada producto debe mostrar información relevante disponible.
- Debe poder seleccionar un producto para consultar más detalles.
- Los productos mostrados deben corresponder a la tienda seleccionada.

---

## RF-CON-01 — Contactar a la emprendedora

**Historia de usuario:**

Como comprador, quiero acceder a una forma de contacto con la emprendedora,
para realizar consultas sobre los productos que me interesan.

**Criterios de aceptación:**

- La tienda debe mostrar al menos un medio de contacto habilitado.
- El comprador debe poder iniciar el contacto desde la información
  disponible en la tienda.
- El medio de contacto debe corresponder al emprendimiento seleccionado.
- BORA debe mostrar claramente qué acción realizará el comprador antes
  de abandonar la plataforma o abrir una aplicación externa, si corresponde.

---

# 4.3 Administrador

## RF-ADM-01 — Registrar una emprendedora

**Historia de usuario:**

Como administrador, quiero registrar una emprendedora en BORA,
para permitir que pueda acceder a la plataforma y gestionar su emprendimiento.

**Criterios de aceptación:**

- El administrador debe poder ingresar los datos requeridos de la emprendedora.
- El sistema debe validar los campos obligatorios.
- El registro debe generar o asociar una cuenta con el rol correspondiente.
- La emprendedora registrada debe quedar disponible para su posterior
  vinculación con su tienda.
- El sistema debe informar si el registro se realizó correctamente.

---

## RF-FER-02 — Crear una feria e invitar participantes

**Historia de usuario:**

Como administrador, quiero crear una feria e invitar emprendedoras,
para organizar la participación de distintos emprendimientos en un evento.

**Criterios de aceptación:**

- El administrador debe poder crear una nueva feria.
- Debe poder registrar la información necesaria del evento.
- Debe poder seleccionar emprendedoras para invitarlas.
- Cada invitación debe quedar asociada a la feria correspondiente.
- Las emprendedoras invitadas deben poder visualizar posteriormente
  la invitación desde la aplicación.
- El administrador debe poder identificar las invitaciones enviadas.

---

# 4.4 Resumen de trazabilidad

| ID | Perfil | Flujo principal |
|---|---|---|
| RF-AUT-01 | Emprendedora | Ingresar con huella |
| RF-PRO-01 | Emprendedora | Crear producto |
| RF-VEN-01 | Emprendedora | Registrar venta |
| RF-FER-01 | Emprendedora | Responder invitación a feria |
| RF-TIE-01 | Emprendedora | Compartir tienda |
| RF-BUS-01 | Comprador | Encontrar una tienda |
| RF-PRO-02 | Comprador | Ver productos de una tienda |
| RF-CON-01 | Comprador | Contactar a la emprendedora |
| RF-ADM-01 | Administrador | Registrar una emprendedora |
| RF-FER-02 | Administrador | Crear feria e invitar participantes |

## Relación con los siguientes entregables

Los identificadores definidos en este documento deberán conservarse durante
el desarrollo.

Cada flujo deberá poder recorrerse completamente en el mapa de navegación y
las entidades necesarias para realizarlo deberán encontrarse representadas
en el modelo conceptual del dominio.

De esta forma se mantiene trazabilidad entre:

**Requisito → Historia de usuario → Navegación → Entidades del dominio**