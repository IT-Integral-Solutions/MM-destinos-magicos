/**
 * TASS — tass-state.js
 * Estado compartido entre los tres módulos.
 * Fuente de verdad única: TASS_State.
 *
 * Flujo:
 *   datos.html      → TASS_State.saveCliente(clienteConsulta)
 *   presupuesto.html → TASS_State.saveBudget(budget)
 *   itinerario.html  → TASS_State.loadBudget() → genera días automáticamente
 */

var TASS_State = (function () {

  var KEYS = {
    cliente: 'tass_cliente',
    budget:  'tass_budget',
    itin:    'tass_itinerario',
  };

  // ── Persistencia ──────────────────────────────────────
  function save(key, obj) {
    try {
      localStorage.setItem(key, JSON.stringify(obj));
      return true;
    } catch(e) {
      console.warn('[TASS_State] save error:', e);
      return false;
    }
  }

  function load(key) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch(e) {
      console.warn('[TASS_State] load error:', e);
      return null;
    }
  }

  function clear(key) {
    try { localStorage.removeItem(key); } catch(e) {}
  }

  // ── API pública ────────────────────────────────────────

  function saveCliente(obj) { return save(KEYS.cliente, obj); }
  function loadCliente()    { return load(KEYS.cliente); }

  function saveBudget(obj)  { return save(KEYS.budget, obj); }
  function loadBudget()     { return load(KEYS.budget); }

  function saveItinerario(dias) { return save(KEYS.itin, dias); }
  function loadItinerario()     { return load(KEYS.itin); }

  function clearAll() {
    clear(KEYS.cliente);
    clear(KEYS.budget);
    clear(KEYS.itin);
  }

  /**
   * getBudgetFromUrl()
   * Lee ?budget= de la URL, lo decodifica, lo guarda en localStorage
   * y lo retorna. Si no hay URL param, intenta desde localStorage.
   */
  function getBudgetFromUrl() {
    var enc = new URLSearchParams(window.location.search).get('budget');
    if (enc) {
      var b = TASS_Serializer.decodeData(enc);
      if (b) { saveBudget(b); return b; }
    }
    return loadBudget();
  }

  /**
   * getClienteFromUrl()
   * Lee ?data= de la URL → guarda en localStorage → retorna.
   * Si no hay URL param, intenta desde localStorage.
   */
  function getClienteFromUrl() {
    var enc = new URLSearchParams(window.location.search).get('data');
    if (enc) {
      var c = TASS_Serializer.decodeData(enc);
      if (c) { saveCliente(c); return c; }
    }
    return loadCliente();
  }

  /**
   * getPresupuestoUrl(budget)
   * Construye la URL completa para abrir presupuesto.html con los datos del cliente.
   */
  function getPresupuestoUrl(clienteConsulta) {
    var encoded = TASS_Serializer.encodeData(clienteConsulta);
    return AGENCY_CONFIG.paginas.presupuesto + '?data=' + encoded;
  }

  /**
   * getItinerarioUrl(budget)
   * Construye la URL completa para abrir itinerario.html con el budget.
   */
  function getItinerarioUrl(budget) {
    var encoded = TASS_Serializer.encodeData(budget);
    return AGENCY_CONFIG.paginas.itinerario + '?budget=' + encoded;
  }

  return {
    saveCliente, loadCliente,
    saveBudget,  loadBudget,
    saveItinerario, loadItinerario,
    clearAll,
    getBudgetFromUrl,
    getClienteFromUrl,
    getPresupuestoUrl,
    getItinerarioUrl,
  };

})();
