/**
 * TASS — itinerary-generator.js
 * Genera los días del itinerario a partir del budget.
 * Pura lógica, sin referencias al DOM.
 */

var TASS_ItineraryGenerator = (function() {

  // ── Helpers de fecha ──────────────────────────────────────
  function addDays(dateStr, n) {
    var d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }

  function formatDateES(dateStr) {
    if (!dateStr) return '—';
    var d = new Date(dateStr + 'T12:00:00');
    var dias   = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    var meses  = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return dias[d.getDay()] + ', ' + d.getDate() + ' de ' + meses[d.getMonth()] + ' ' + d.getFullYear();
  }

  // ── Detección de modo ────────────────────────────────────
  function detectModo(budget) {
    var destStr = ((budget.destino && budget.destino.nombre) || '').toLowerCase();
    var tksStr  = (budget.tickets || []).map(function(t) {
      return ((t.parque || '') + (t.desc || '')).toLowerCase();
    }).join(' ');
    var todo = destStr + ' ' + tksStr;

    if (budget.crucero)                                                                    return 'crucero';
    if (/disney|magic kingdom|epcot|hollywood studios|animal kingdom/i.test(todo))        return 'disney';
    if (/universal|islands of adventure|epic universe|seaworld|busch|aquatica/i.test(todo)) return 'disney';
    if (/caribe|cancun|cancún|playa|beach|resort/i.test(destStr))                          return 'playa';
    if (/europa|paris|madrid|roma|ciudad|city|london|amsterdam/i.test(destStr))            return 'ciudad';
    return 'libre';
  }

  // ── Construir lista ordenada de parques desde tickets ─────
  function buildParquesOrdenados(budget, parquesCheckbox) {
    var lista = [];
    var tks = budget.tickets || [];

    if (tks.length) {
      tks.forEach(function(t) {
        var pq = (t.parque || '').replace(/^Walt Disney World\s*[–-]\s*/i, '')
                                  .replace(/^Universal\s*/i, 'Universal ')
                                  .trim();
        if (!pq || pq === 'Otro') pq = t.desc || '';
        // Saltar tickets de agua/springs (días especiales)
        if (/water park|blizzard|aquatica|springs|shopping/i.test(pq)) return;
        var cant = parseInt(t.cant) || 1;
        for (var k = 0; k < cant; k++) lista.push(pq || 'Parque temático');
      });
    }

    return lista.length ? lista : (parquesCheckbox || ['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom']);
  }

  // ── Builders de actividades por tipo de día ───────────────
  var _H = function(tipo, horarios) {
    return (horarios && horarios[tipo]) || { desayuno:'08:00', parque:'09:00', almuerzo:'13:00', cena:'19:30', traslado:'10:00', checkout:'11:00' }[tipo] || '09:00';
  };

  function buildActsLlegada(hotelTransitions, H) {
    var hotel = hotelTransitions.length ? hotelTransitions[0].nombre : 'el hotel';
    return [
      { hora:'',           emoji:'✈️', color:'color-navy',    desc:'Vuelo / traslado internacional',              nota:'Controlar documentación y equipaje' },
      { hora:'',           emoji:'🚐', color:'color-naranja',  desc:'Traslado desde el aeropuerto a ' + hotel,     nota:'' },
      { hora:'',           emoji:'🏨', color:'color-azul',     desc:'Check-in en ' + hotel,                        nota:'Solicitar Early Check-in si está disponible' },
      { hora:'',           emoji:'🌿', color:'color-verde',    desc:'Descanso y ambientación',                     nota:'Recorrida por las instalaciones del hotel' },
      { hora:_H('cena',H), emoji:'🍽️', color:'color-dorado',  desc:'Cena de bienvenida',                          nota:'' },
      { hora:'21:00',      emoji:'😴', color:'color-verde',    desc:'Descanso — mañana empieza la magia 🏰',       nota:'' },
    ];
  }

  function buildActsSalida(H) {
    return [
      { hora:'07:00',             emoji:'🌅', color:'color-dorado',  desc:'Desayuno final en el hotel',                     nota:'' },
      { hora:_H('checkout',H),    emoji:'🧳', color:'color-azul',    desc:'Check-out del hotel y preparación del equipaje',  nota:'' },
      { hora:'',                  emoji:'🌿', color:'color-verde',   desc:'Última mañana libre (shopping, fotos, recuerdos)',nota:'' },
      { hora:'',                  emoji:'🚐', color:'color-naranja', desc:'Traslado al aeropuerto',                          nota:'Llegar con 3 hs de anticipación' },
      { hora:'',                  emoji:'✈️', color:'color-navy',   desc:'Vuelo de regreso a casa 🏠',                      nota:'Hasta la próxima aventura ✨' },
    ];
  }

  function buildActsTraslado(nuevoHotel, H) {
    var nombre = nuevoHotel ? nuevoHotel.nombre : 'nuevo hotel';
    return [
      { hora:'08:00',           emoji:'🌅', color:'color-dorado',  desc:'Desayuno tranquilo',                                    nota:'' },
      { hora:_H('checkout',H),  emoji:'🧳', color:'color-azul',    desc:'Check-out del hotel anterior',                          nota:'Guardar equipaje en consigna si hace falta' },
      { hora:'11:00',           emoji:'🌿', color:'color-verde',   desc:'Mañana libre — Última recorrida, fotos o descanso',     nota:'' },
      { hora:'13:00',           emoji:'🍽️', color:'color-dorado', desc:'Almuerzo',                                              nota:'' },
      { hora:'15:00',           emoji:'🚐', color:'color-naranja', desc:'Traslado a ' + nombre,                                  nota:'' },
      { hora:'16:00',           emoji:'🏨', color:'color-azul',   desc:'Check-in en ' + nombre,                                 nota:'Explorá las nuevas instalaciones' },
      { hora:_H('cena',H),      emoji:'🍽️', color:'color-dorado', desc:'Cena en el nuevo hotel',                               nota:'' },
    ];
  }

  function buildActsDescanso(H) {
    return [
      { hora:'09:00',       emoji:'🌅', color:'color-dorado',  desc:'Desayuno relajado en el hotel',             nota:'Sin apuro, el día es para recargar energías' },
      { hora:'10:30',       emoji:'🏊', color:'color-azul',    desc:'Piscina o spa del hotel',                   nota:'' },
      { hora:'13:00',       emoji:'🍽️', color:'color-dorado', desc:'Almuerzo tranquilo',                        nota:'' },
      { hora:'15:00',       emoji:'😴', color:'color-verde',   desc:'Siesta / descanso',                         nota:'Energías recargadas para los próximos parques' },
      { hora:'17:00',       emoji:'🛍️', color:'color-lila',   desc:'Pequeño paseo o souvenir',                  nota:'' },
      { hora:_H('cena',H),  emoji:'🍽️', color:'color-dorado', desc:'Cena',                                     nota:'' },
    ];
  }

  var PARQUE_EMOJIS = {
    'Magic Kingdom':'🏰','EPCOT':'🌍','Hollywood Studios':'🎬',
    'Animal Kingdom':'🦁','Universal Studios':'🎭','Islands of Adventure':'⚡',
    'Epic Universe':'✨','Blizzard Beach':'❄️','Disney Springs':'🛍️',
  };
  var PARQUE_TIPS = {
    'Magic Kingdom':       'Comenzar con Tomorrowland — Lightning Lane para Seven Dwarfs',
    'EPCOT':               'World Showcase abre al mediodía — Guardians of the Galaxy temprano',
    'Hollywood Studios':   'Llegar 30 min antes de apertura — Rise of the Resistance agotado rápido',
    'Animal Kingdom':      'Avatar temprano — Los animales están más activos a la mañana',
    'Universal Studios':   'Hagrids Motorbike primero — usar Express Pass si está disponible',
    'Islands of Adventure':'Velocicoaster al abrir — Hogwarts Express al mediodía',
    'Epic Universe':       'Llegar en la apertura — validar mapa del parque antes de ingresar',
  };

  function buildActsParque(parque, H) {
    var emo  = PARQUE_EMOJIS[parque] || '🎢';
    var tip  = PARQUE_TIPS[parque]   || '';
    return [
      { hora:'07:30',       emoji:'☀️', color:'color-dorado',  desc:'Desayuno y preparación para el parque',                nota:'Protector solar, ropa cómoda, snacks' },
      { hora:_H('parque',H),emoji:emo,  color:'color-rojo',    desc:'Apertura — Entrada a ' + parque,                       nota:tip },
      { hora:'11:00',       emoji:'🎢', color:'color-rojo',    desc:'Atracciones principales',                              nota:'Usar Lightning Lane / Virtual Queue para las más populares' },
      { hora:_H('almuerzo',H),emoji:'🍽️',color:'color-dorado',desc:'Almuerzo en el parque',                                nota:'' },
      { hora:'14:30',       emoji:'🎢', color:'color-rojo',    desc:'Más atracciones — Shows y desfiles',                   nota:'' },
      { hora:'17:00',       emoji:'🎭', color:'color-lila',    desc:'Show de tarde / Desfile',                              nota:'Revisar el calendario de espectáculos' },
      { hora:_H('cena',H),  emoji:'🍽️', color:'color-dorado', desc:'Cena',                                                nota:'Reservar con anticipación en restaurantes de autor' },
      { hora:'21:00',       emoji:'🎇', color:'color-rojo',    desc:'Show nocturno / Fuegos artificiales',                  nota:'Mejor posición 30 min antes' },
    ];
  }

  function buildActsAcuatico(H) {
    return [
      { hora:'08:00',      emoji:'☀️', color:'color-dorado', desc:'Desayuno y preparación',                        nota:'Traje de baño, protector solar, toalla' },
      { hora:'09:00',      emoji:'💧', color:'color-azul',   desc:'Entrada al parque acuático',                    nota:'Llegar a la apertura para las mejores piletas' },
      { hora:'12:30',      emoji:'🍔', color:'color-dorado', desc:'Almuerzo en el parque',                         nota:'' },
      { hora:'14:00',      emoji:'🌊', color:'color-azul',   desc:'Toboganes y atracciones acuáticas',             nota:'' },
      { hora:'17:00',      emoji:'🌿', color:'color-verde',  desc:'Regreso y descanso en el hotel',                nota:'' },
      { hora:_H('cena',H), emoji:'🍽️', color:'color-dorado',desc:'Cena',                                         nota:'' },
    ];
  }

  function buildActsShopping(H) {
    return [
      { hora:'09:00',      emoji:'🌅', color:'color-dorado', desc:'Desayuno',                                               nota:'' },
      { hora:'10:00',      emoji:'🛍️', color:'color-lila',   desc:'Disney Springs — Shopping y exploración',               nota:'World of Disney, tiendas temáticas, restaurantes' },
      { hora:'12:30',      emoji:'🍽️', color:'color-dorado',desc:'Almuerzo en Disney Springs',                            nota:'' },
      { hora:'14:00',      emoji:'🛍️', color:'color-lila',   desc:'Últimas compras de souvenirs',                         nota:'' },
      { hora:'16:00',      emoji:'📸', color:'color-lila',   desc:'Sesión de fotos y recuerdos',                           nota:'' },
      { hora:_H('cena',H), emoji:'🍽️', color:'color-dorado',desc:'Cena de despedida',                                    nota:'Reservar con anticipación en restaurante especial' },
    ];
  }

  function buildActsPlaya(nDia, H) {
    return [
      { hora:'08:30',      emoji:'🌅', color:'color-dorado',  desc:'Desayuno en el resort',                        nota:'' },
      { hora:'10:00',      emoji:'🏖️', color:'color-azul',   desc:'Playa / Pileta',                               nota:'Protector solar SPF 50+' },
      { hora:'13:00',      emoji:'🍹', color:'color-dorado',  desc:'Almuerzo y cocteles',                          nota:'' },
      { hora:'15:00',      emoji:'🏊', color:'color-azul',    desc:'Deportes acuáticos o excursión opcional',      nota:'' },
      { hora:'18:00',      emoji:'🌇', color:'color-naranja', desc:'Atardecer en la playa',                        nota:'Momento fotográfico imperdible' },
      { hora:_H('cena',H), emoji:'🍽️', color:'color-dorado', desc:'Cena',                                        nota:'' },
    ];
  }

  function buildActsCrucero(nDia, total, H) {
    if (nDia === 0) return [
      { hora:'10:00', emoji:'🚐', color:'color-naranja', desc:'Traslado al puerto',                       nota:'' },
      { hora:'12:00', emoji:'🚢', color:'color-azul',   desc:'Embarque en el crucero',                   nota:'Drill de seguridad obligatorio' },
      { hora:'16:00', emoji:'🌊', color:'color-azul',   desc:'Zarpe — ¡empieza la aventura!',            nota:'' },
      { hora:_H('cena',H), emoji:'🍽️', color:'color-dorado', desc:'Cena de bienvenida en el comedor principal', nota:'' },
    ];
    if (nDia === total - 1) return [
      { hora:'07:00', emoji:'🌅', color:'color-dorado',  desc:'Último desayuno a bordo',  nota:'' },
      { hora:'09:00', emoji:'🧳', color:'color-azul',    desc:'Desembarque',               nota:'' },
      { hora:'11:00', emoji:'🚐', color:'color-naranja', desc:'Traslado desde el puerto',  nota:'' },
    ];
    return [
      { hora:'08:00',      emoji:'🌅', color:'color-dorado', desc:'Desayuno a bordo',                                nota:'' },
      { hora:'09:30',      emoji:'⚓', color:'color-azul',   desc:'Puerto del día / excursión terrestre',            nota:'Confirmar excursiones con anticipación' },
      { hora:'13:00',      emoji:'🍽️', color:'color-dorado',desc:'Almuerzo a bordo o en tierra',                   nota:'' },
      { hora:'15:00',      emoji:'🎭', color:'color-lila',   desc:'Entretenimiento a bordo',                         nota:'' },
      { hora:_H('cena',H), emoji:'🍽️', color:'color-dorado',desc:'Cena en el comedor temático',                    nota:'Reservar mesa con anticipación' },
      { hora:'21:00',      emoji:'🎸', color:'color-lila',   desc:'Show nocturno a bordo',                           nota:'' },
    ];
  }

  function buildActsCiudad(nDia, H) {
    return [
      { hora:'08:30',      emoji:'☕', color:'color-dorado',  desc:'Desayuno en café local',              nota:'' },
      { hora:'10:00',      emoji:'🏛️', color:'color-azul',   desc:'Visita cultural / Museo o sitio histórico', nota:'' },
      { hora:'13:00',      emoji:'🍽️', color:'color-dorado', desc:'Almuerzo en restaurante local',       nota:'Probar gastronomía típica' },
      { hora:'15:00',      emoji:'🚶', color:'color-verde',   desc:'Barrio histórico / Tour a pie',       nota:'' },
      { hora:'17:30',      emoji:'📸', color:'color-lila',    desc:'Fotos en los puntos icónicos',        nota:'' },
      { hora:_H('cena',H), emoji:'🍽️', color:'color-dorado', desc:'Cena',                               nota:'' },
    ];
  }

  // ── GENERADOR PRINCIPAL ────────────────────────────────────
  /**
   * generateItineraryDays(budget, options) → Array<dia>
   *
   * options: {
   *   modo: 'disney'|'playa'|'crucero'|'ciudad'|'libre',
   *   parquesDisponibles: string[],
   *   descansoEn: number,
   *   reglaLlegada: bool,
   *   reglaSalida: bool,
   *   reglaTraslado: bool,
   *   reglaDescanso: bool,
   *   reglaAgua: bool,
   *   reglaShopping: bool,
   *   horarios: { desayuno, parque, almuerzo, cena, traslado, checkout },
   * }
   */
  function generateItineraryDays(budget, options) {
    var opts = options || {};
    var d    = budget.destino || {};
    var v    = budget.vuelo   || null;

    var fechaIn  = (v && v.fechaIda)    || d.fechaIn  || '';
    var fechaOut = (v && v.fechaVuelta) || d.fechaOut || '';

    if (!fechaIn || !fechaOut) return [];

    var d1 = new Date(fechaIn  + 'T12:00:00');
    var d2 = new Date(fechaOut + 'T12:00:00');
    var totalDias = Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1;
    if (totalDias < 1) return [];

    var modo          = opts.modo          || detectModo(budget);
    var descansoEn    = opts.descansoEn    || 2;
    var H             = opts.horarios      || null;

    // Hoteles y transiciones
    var aloj = budget.alojamiento || [];
    var hotelTransitions = aloj.filter(function(h) { return h.nombre && h.checkin && h.checkout; });
    if (!hotelTransitions.length && aloj.length) {
      hotelTransitions = aloj.map(function(h) {
        return { nombre: h.nombre, in: fechaIn, out: fechaOut };
      });
    }
    // Normalizar claves
    hotelTransitions = hotelTransitions.map(function(h) {
      return { nombre: h.nombre, in: h.checkin || h.in || fechaIn, out: h.checkout || h.out || fechaOut };
    });

    var trasladoDates = new Set();
    if (hotelTransitions.length > 1) {
      hotelTransitions.forEach(function(h, i) { if (i > 0) trasladoDates.add(h.in); });
    }

    var parquesOrdenados = buildParquesOrdenados(budget, opts.parquesDisponibles);

    var dias = [];
    var parqueIdx   = 0;
    var diasDeParque = 0;

    for (var i = 0; i < totalDias; i++) {
      var fechaDia  = addDays(fechaIn, i);
      var esLlegada = (i === 0);
      var esSalida  = (i === totalDias - 1);
      var esTraslado = trasladoDates.has(fechaDia);

      var dia = {
        numero:      i + 1,
        fecha:       fechaDia,
        fechaLabel:  formatDateES(fechaDia),
        tipo:        'parque',
        titulo:      '',
        actividades: [],
        nota:        '',
        visible:     true,
      };

      // REGLA LLEGADA
      if (esLlegada && opts.reglaLlegada !== false) {
        dia.tipo  = 'llegada';
        dia.titulo = 'Llegada y bienvenida';
        dia.actividades = buildActsLlegada(hotelTransitions, H);
        dias.push(dia); continue;
      }

      // REGLA SALIDA
      if (esSalida && opts.reglaSalida !== false) {
        dia.tipo  = 'salida';
        dia.titulo = 'Día de salida';
        dia.actividades = buildActsSalida(H);
        dias.push(dia); continue;
      }

      // REGLA TRASLADO HOTEL
      if (esTraslado && opts.reglaTraslado !== false) {
        var nuevoHotel = hotelTransitions.find(function(h) { return h.in === fechaDia; });
        dia.tipo  = 'traslado_hotel';
        dia.titulo = 'Cambio de hotel' + (nuevoHotel ? ' → ' + nuevoHotel.nombre : '');
        dia.actividades = buildActsTraslado(nuevoHotel, H);
        dias.push(dia); continue;
      }

      // MODOS
      if (modo === 'disney') {
        if (opts.reglaDescanso !== false && diasDeParque > 0 && diasDeParque % descansoEn === 0) {
          dia.tipo  = 'descanso';
          dia.titulo = 'Día de descanso y relax';
          dia.actividades = buildActsDescanso(H);
          diasDeParque = 0;
          dias.push(dia); continue;
        }
        if (opts.reglaAgua && parqueIdx === 2) {
          dia.tipo  = 'libre';
          dia.titulo = 'Parque acuático';
          dia.actividades = buildActsAcuatico(H);
          dias.push(dia); continue;
        }
        if (opts.reglaShopping && i === totalDias - 2 && !esSalida) {
          dia.tipo  = 'libre';
          dia.titulo = 'Disney Springs & Shopping';
          dia.actividades = buildActsShopping(H);
          dias.push(dia); continue;
        }
        var nombreParque = parqueIdx < parquesOrdenados.length
          ? parquesOrdenados[parqueIdx]
          : parquesOrdenados[parqueIdx % parquesOrdenados.length];
        parqueIdx++;
        diasDeParque++;
        dia.tipo  = 'parque';
        dia.titulo = nombreParque;
        dia.actividades = buildActsParque(nombreParque, H);

      } else if (modo === 'playa') {
        dia.tipo  = 'playa';
        dia.titulo = 'Playa & relax';
        dia.actividades = buildActsPlaya(i, H);

      } else if (modo === 'crucero') {
        dia.tipo  = 'crucero';
        dia.titulo = i === 0 ? 'Embarque' : i === totalDias - 1 ? 'Desembarque' : 'Día en crucero / Puerto';
        dia.actividades = buildActsCrucero(i, totalDias, H);

      } else if (modo === 'ciudad') {
        dia.tipo  = 'ciudad';
        dia.titulo = 'Exploración de la ciudad';
        dia.actividades = buildActsCiudad(i, H);

      } else {
        dia.tipo  = 'libre';
        dia.titulo = 'Día ' + (i + 1);
        dia.actividades = [{ hora:'09:00', emoji:'🌿', color:'color-verde', desc:'', nota:'' }];
      }

      dias.push(dia);
    }

    return dias;
  }

  return {
    generateItineraryDays,
    detectModo,
    formatDateES,
    addDays,
    buildParquesOrdenados,
  };

})();
