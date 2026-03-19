/**
 * TASS — serializer.js
 * Funciones de serialización base64 para pasar datos entre páginas.
 * Único punto de verdad: si el encoding cambia, se cambia aquí.
 */

var TASS_Serializer = (function() {

  /**
   * encodeData(object) → string base64
   * Serializa cualquier objeto JSON a base64 URL-safe.
   */
  function encodeData(obj) {
    try {
      return btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
    } catch(e) {
      console.error('[TASS] encodeData error:', e);
      return '';
    }
  }

  /**
   * decodeData(base64) → object | null
   * Deserializa base64 → JSON object.
   * Retorna null si falla (nunca lanza excepción).
   */
  function decodeData(b64) {
    try {
      return JSON.parse(decodeURIComponent(escape(atob(b64))));
    } catch(e) {
      console.error('[TASS] decodeData error:', e);
      return null;
    }
  }

  /**
   * getParam(name) → string | null
   * Lee un parámetro de la URL actual.
   */
  function getParam(name) {
    return new URLSearchParams(window.location.search).get(name);
  }

  /**
   * readPageData(paramName) → object | null
   * Shortcut: lee, decodifica y valida en un paso.
   */
  function readPageData(paramName) {
    var raw = getParam(paramName);
    if (!raw) return null;
    var data = decodeData(raw);
    if (!data) { console.warn('[TASS] No se pudo decodificar param:', paramName); }
    return data;
  }

  /**
   * navigateTo(page, paramName, data)
   * Construye la URL con el dato serializado y navega (nueva pestaña).
   */
  function navigateTo(page, paramName, data) {
    var encoded = encodeData(data);
    if (!encoded) return false;
    var url = page + '?' + paramName + '=' + encoded;
    window.open(url, '_blank');
    return true;
  }

  return { encodeData, decodeData, getParam, readPageData, navigateTo };

})();
