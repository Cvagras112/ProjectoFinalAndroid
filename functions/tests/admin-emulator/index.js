"use strict";
// Entrada aislada para integración HTTP y auditoría normalizada.
// Nunca requiere functions/index.js.

module.exports = {
  ...require("../../administracion.entry"),
  ...require("../../catalogosAdministrativos.entry"),
  ...require("../../asignacionesEmprendedoras.entry"),
  ...require("../../administradoresAuditados.entry"),
  ...require("../../crearAdministradorAuditado.entry"),
};
