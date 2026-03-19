/**
 * TASS — budget-builder.js
 * Lógica de construcción y cálculo del presupuesto.
 * No tiene referencias al DOM. Trabaja solo con datos.
 */

var TASS_BudgetBuilder = (function() {

  /**
   * calcHotelNoches(checkin, checkout) → number
   */
  function calcHotelNoches(checkin, checkout) {
    if (!checkin || !checkout) return 0;
    var d1 = new Date(checkin), d2 = new Date(checkout);
    var n = Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    return n > 0 ? n : 0;
  }

  /**
   * calcTotales(budget) → { vuelo, aloj, tickets, traslados, crucero, seguro, comidas, extras, subtotal, descuento, total }
   */
  function calcTotales(b) {
    var vuelo     = b.vuelo    ? (b.vuelo.precio + b.vuelo.tasas)     : 0;
    var aloj      = (b.alojamiento || []).reduce(function(s, h) { return s + h.precio * h.noches; }, 0);
    var tickets   = b.ticketsActivos ? (b.tickets || []).reduce(function(s, t) { return s + t.precio * t.cant; }, 0) : 0;
    var traslados = b.trasladosActivos ? (b.traslados || []).reduce(function(s, t) { return s + t.precio; }, 0) : 0;
    var crucero   = b.crucero  ? b.crucero.precio                    : 0;
    var seguro    = b.seguro   ? b.seguro.precio                     : 0;
    var comidas   = b.comidas  ? b.comidas.precio                    : 0;
    var extras    = (b.extras  || []).filter(function(e) { return !e.opcional; }).reduce(function(s, e) { return s + e.precio; }, 0);

    var subtotal  = vuelo + aloj + tickets + traslados + crucero + seguro + comidas + extras;
    var descPct   = b.descuento ? b.descuento.pct : 0;
    var descMonto = subtotal * (descPct / 100);
    var total     = subtotal - descMonto;

    return { vuelo, aloj, tickets, traslados, crucero, seguro, comidas, extras, subtotal, descuento: descMonto, total };
  }

  /**
   * formatMonto(n, moneda) → string legible
   */
  function formatMonto(n, moneda) {
    if (!n || n === 0) return '—';
    return (moneda || 'USD') + ' ' + parseFloat(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  /**
   * formatFecha(dateStr) → string legible en español
   */
  function formatFecha(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  /**
   * buildBudget(formData) → budget object normalizado
   * Recibe los datos crudos del formulario de presupuesto y construye
   * el objeto budget canónico que usará el itinerario.
   */
  function buildBudget(formData) {
    var f = formData;
    var totales = calcTotales(f);

    return {
      _version: '3.0',
      meta: {
        numero:   f.numero   || '',
        agente:   f.agente   || 'MM',
        moneda:   f.moneda   || 'USD',
        fecha:    f.fecha    || new Date().toISOString().split('T')[0],
        validez:  f.validez  || 7,
        color1:   '#C8102E',
        color2:   '#1B2A4A',
      },
      cliente: {
        nombre:   f.clienteNombre  || '',
        wa:       f.clienteWa      || '',
        email:    f.clienteEmail   || '',
        pais:     f.clientePais    || '',
        adultos:  f.adultos        || '2',
        menores:  f.menores        || '0',
        edades:   f.edades         || '',
      },
      destino: {
        nombre:   f.destino     || '',
        fechaIn:  f.fechaIn     || '',
        fechaOut: f.fechaOut    || '',
        noches:   f.noches      || 0,
        temporada:f.temporada   || '',
        desc:     f.desc        || '',
      },
      vuelo:         f.vuelo         || null,
      alojamiento:   f.alojamiento   || [],
      tickets:       f.tickets       || [],
      ticketsActivos:f.ticketsActivos !== false,
      traslados:     f.traslados     || [],
      trasladosActivos: !!f.trasladosActivos,
      crucero:       f.crucero       || null,
      seguro:        f.seguro        || null,
      comidas:       f.comidas       || null,
      extras:        f.extras        || [],
      noIncluye:     f.noIncluye     || [],
      cuotas:        f.cuotas        || [],
      metodosPago:   f.metodosPago   || [],
      descuento:     f.descuento     || { pct: 0, motivo: '', monto: 0 },
      totales:       totales,
      notas:         f.notas         || '',
      mensaje:       f.mensaje       || '',
      logo:          f.logo          || null,
    };
  }

  return { calcHotelNoches, calcTotales, formatMonto, formatFecha, buildBudget };

})();
