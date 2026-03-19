/**
 * TASS — itinerary-generator.js v3.0
 * Input:  budget de collectBudgetData()
 * Output: Array<Dia> listo para renderizar
 */
var TASS_ItineraryGenerator = (function () {

  function addDays(str, n) {
    var d = new Date(str + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }

  function formatDateES(str) {
    if (!str) return '—';
    var d  = new Date(str + 'T12:00:00');
    var DD = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    var MM = ['enero','febrero','marzo','abril','mayo','junio',
              'julio','agosto','septiembre','octubre','noviembre','diciembre'];
    return DD[d.getDay()] + ', ' + d.getDate() + ' de ' + MM[d.getMonth()] + ' ' + d.getFullYear();
  }

  var DEF = { desayuno:'08:00', parque:'09:00', almuerzo:'13:00',
              cena:'19:30', traslado:'10:00', checkout:'11:00' };
  function H(tipo, horarios) { return (horarios && horarios[tipo]) || DEF[tipo]; }

  // ── Fechas desde budget ─────────────────────────────────
  function getFechas(b) {
    var v = b.vuelo, d = b.destino || {};
    return {
      fechaIn:  (v && v.fechaIda)    || d.fechaIn  || '',
      fechaOut: (v && v.fechaVuelta) || d.fechaOut || '',
    };
  }

  // ── Modo desde budget ───────────────────────────────────
  function detectModo(b) {
    if (b.crucero) return 'crucero';
    var dest = ((b.destino && b.destino.nombre) || '').toLowerCase();
    var tks  = (b.tickets || []).map(function(t) {
      return ((t.parque||'') + ' ' + (t.complejo||'') + ' ' + (t.desc||'')).toLowerCase();
    }).join(' ');
    var all = dest + ' ' + tks;
    if (/disney|magic.?kingdom|epcot|hollywood.studios|animal.kingdom/i.test(all))         return 'disney';
    if (/universal|islands.of.adventure|epic.universe|seaworld|busch|aquatica/i.test(all)) return 'disney';
    if (/caribe|cancun|cancún|playa|beach|resort/i.test(dest))                             return 'playa';
    if (/europa|paris|madrid|roma|london|amsterdam|ciudad/i.test(dest))                    return 'ciudad';
    return 'libre';
  }

  // ── Parques en orden desde tickets ─────────────────────
  function buildParquesOrdenados(b, fallback) {
    var lista = [];
    if (b.ticketsActivos === false) return fallback || [];
    (b.tickets || []).forEach(function(t) {
      var src = t.parque || t.desc || '';
      // Normalizar: quitar prefijos, quedarse con el tipo de ticket
      var raw = src
        .replace(/^Walt Disney World\s*[–\-]\s*/i, '')
        .replace(/^Disney WDW\s*[–\-]\s*/i,       '')
        .replace(/^Disneyland\s*[–\-]\s*/i,        'Disneyland – ')
        .replace(/^Universal\s*[–\-]\s*/i,         'Universal – ')
        .trim();
      // Si es tipo "Hopper / Base / Park to Park", usar el nombre del complejo como parque
      // La descripción desc puede tener el nombre real del parque
      if (/^(Ticket Base|Hopper|Park Hopper|Park to Park|3.Park|Base)$/i.test(raw)) {
        // Intentar extraer parque de la descripción
        var descRaw = (t.desc || '').split('—')[0].trim();
        if (descRaw && !/^ticket/i.test(descRaw)) raw = descRaw;
        else {
          // Fallback: usar complejo
          var comp = (t.complejo || '');
          if (comp === 'disney-wdw')       raw = 'Walt Disney World';
          else if (comp === 'disney-dl')   raw = 'Disneyland';
          else if (comp === 'universal-orlando') raw = 'Universal Orlando';
          else if (comp === 'seaworld')    raw = 'SeaWorld Orlando';
        }
      }
      if (!raw || raw === 'Otro') return;
      // Limpiar: sacar cosas como "· 4 días", "– x días", numeros finales
      raw = raw.replace(/[·–]\s*\d+\s*días?/gi,'').replace(/\s{2,}/g,' ').trim();
      if (!raw) return;
      if (/water.?park|blizzard|aquatica|springs|shopping|discovery/i.test(raw)) return;
      var cant = Math.max(1, parseInt(t.cant) || 1);
      for (var k = 0; k < cant; k++) lista.push(raw);
    });
    return lista.length ? lista : (fallback || ['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom']);
  }

  function hasTicket(b, re) {
    return (b.tickets || []).some(function(t) {
      return re.test((t.parque||'') + ' ' + (t.desc||''));
    });
  }

  // ── Actividades ─────────────────────────────────────────
  var EMOJIS = { 'Magic Kingdom':'🏰','EPCOT':'🌍','Hollywood Studios':'🎬',
    'Animal Kingdom':'🦁','Universal':'🎭','Islands of Adventure':'⚡',
    'Epic Universe':'✨','Blizzard Beach':'❄️','Disney Springs':'🛍️',
    'SeaWorld':'🐋','Busch Gardens':'🦓' };
  var TIPS = {
    'Magic Kingdom':      'Empezar por Tomorrowland — Lightning Lane para Seven Dwarfs',
    'EPCOT':              'Guardians of the Galaxy muy temprano — World Showcase desde las 11',
    'Hollywood Studios':  'Rise of the Resistance al abrir — llegar 30 min antes',
    'Animal Kingdom':     'Avatar temprano — animales más activos a la mañana',
    'Universal':          'Hagrids Motorbike al abrir — Express Pass recomendado',
    'Islands':            'Velocicoaster al abrir — Hogwarts Express conecta los parques',
  };
  function emo(nombre) {
    for (var k in EMOJIS) { if (nombre.toLowerCase().indexOf(k.toLowerCase())>-1) return EMOJIS[k]; }
    return '🎢';
  }
  function tip(nombre) {
    for (var k in TIPS) { if (nombre.toLowerCase().indexOf(k.toLowerCase())>-1) return TIPS[k]; }
    return '';
  }

  function aLlegada(hotel, hs) { return [
    { hora:'',         emoji:'✈️', color:'color-navy',    desc:'Vuelo / traslado internacional',           nota:'Controlar documentación y equipaje' },
    { hora:'',         emoji:'🚐', color:'color-naranja', desc:'Traslado aeropuerto → '+(hotel||'hotel'),  nota:'' },
    { hora:'',         emoji:'🏨', color:'color-azul',    desc:'Check-in en '+(hotel||'el hotel'),         nota:'Pedir Early Check-in si está disponible' },
    { hora:'',         emoji:'🌿', color:'color-verde',   desc:'Descanso y ambientación',                  nota:'Recorrida por las instalaciones' },
    { hora:H('cena',hs),emoji:'🍽️',color:'color-dorado', desc:'Cena de bienvenida',                      nota:'' },
    { hora:'21:00',    emoji:'😴', color:'color-verde',   desc:'Descanso — mañana empieza la magia 🏰',   nota:'' },
  ]; }

  function aParque(nombre, hs) { return [
    { hora:'07:30',          emoji:'☀️',   color:'color-dorado', desc:'Desayuno y preparación',              nota:'Protector solar, ropa cómoda, snacks' },
    { hora:H('parque',hs),   emoji:emo(nombre), color:'color-rojo', desc:'Apertura — Entrada a '+nombre,    nota:tip(nombre) },
    { hora:'11:00',          emoji:'🎢',   color:'color-rojo',   desc:'Atracciones principales',             nota:'Lightning Lane para las más populares' },
    { hora:H('almuerzo',hs), emoji:'🍽️',  color:'color-dorado', desc:'Almuerzo en el parque',              nota:'' },
    { hora:'14:30',          emoji:'🎢',   color:'color-rojo',   desc:'Más atracciones — shows y desfiles', nota:'' },
    { hora:'17:00',          emoji:'🎭',   color:'color-lila',   desc:'Show de tarde / Desfile',             nota:'Revisar calendario de espectáculos' },
    { hora:H('cena',hs),     emoji:'🍽️',  color:'color-dorado', desc:'Cena',                              nota:'Reservar con anticipación' },
    { hora:'21:00',          emoji:'🎇',   color:'color-rojo',   desc:'Show nocturno / Fuegos artificiales', nota:'Mejor posición 30 min antes' },
  ]; }

  function aDescanso(hs) { return [
    { hora:'09:00',      emoji:'🌅', color:'color-dorado', desc:'Desayuno relajado en el hotel',  nota:'Sin apuro — día para recargar energías' },
    { hora:'10:30',      emoji:'🏊', color:'color-azul',   desc:'Piscina o spa del hotel',        nota:'' },
    { hora:'13:00',      emoji:'🍽️', color:'color-dorado',desc:'Almuerzo tranquilo',             nota:'' },
    { hora:'15:00',      emoji:'😴', color:'color-verde',  desc:'Siesta / descanso',              nota:'Energías para los próximos parques' },
    { hora:'17:00',      emoji:'🛍️', color:'color-lila',  desc:'Paseo o souvenir',              nota:'' },
    { hora:H('cena',hs), emoji:'🍽️', color:'color-dorado',desc:'Cena',                         nota:'' },
  ]; }

  function aAcuatico(hs) { return [
    { hora:'08:00',      emoji:'☀️', color:'color-dorado', desc:'Desayuno y preparación',         nota:'Traje de baño, protector solar, toalla' },
    { hora:'09:00',      emoji:'💧', color:'color-azul',   desc:'Entrada al parque acuático',     nota:'Llegar temprano para las mejores atracciones' },
    { hora:'12:30',      emoji:'🍔', color:'color-dorado', desc:'Almuerzo en el parque',          nota:'' },
    { hora:'14:00',      emoji:'🌊', color:'color-azul',   desc:'Toboganes y atracciones',        nota:'' },
    { hora:'17:00',      emoji:'🌿', color:'color-verde',  desc:'Regreso y descanso en el hotel', nota:'' },
    { hora:H('cena',hs), emoji:'🍽️', color:'color-dorado',desc:'Cena',                         nota:'' },
  ]; }

  function aShopping(hs) { return [
    { hora:'09:00',      emoji:'🌅', color:'color-dorado', desc:'Desayuno',                                nota:'' },
    { hora:'10:00',      emoji:'🛍️', color:'color-lila',  desc:'Disney Springs — Shopping y exploración', nota:'World of Disney, tiendas temáticas' },
    { hora:'12:30',      emoji:'🍽️', color:'color-dorado',desc:'Almuerzo en Disney Springs',             nota:'' },
    { hora:'14:00',      emoji:'🛍️', color:'color-lila',  desc:'Últimas compras y souvenirs',            nota:'' },
    { hora:'16:00',      emoji:'📸', color:'color-lila',   desc:'Fotos y recuerdos',                      nota:'' },
    { hora:H('cena',hs), emoji:'🍽️', color:'color-dorado',desc:'Cena especial',                        nota:'Reservar con anticipación' },
  ]; }

  function aTrasladoHotel(nuevoH, hs) {
    var n = (nuevoH && nuevoH.nombre) || 'nuevo hotel';
    return [
      { hora:'08:00',         emoji:'🌅', color:'color-dorado',  desc:'Desayuno tranquilo',                nota:'' },
      { hora:H('checkout',hs),emoji:'🧳', color:'color-azul',    desc:'Check-out del hotel anterior',     nota:'Guardar equipaje en consigna si es necesario' },
      { hora:'11:00',         emoji:'🌿', color:'color-verde',   desc:'Mañana libre — última recorrida',  nota:'' },
      { hora:'13:00',         emoji:'🍽️', color:'color-dorado', desc:'Almuerzo',                        nota:'' },
      { hora:'15:00',         emoji:'🚐', color:'color-naranja', desc:'Traslado a '+n,                   nota:'' },
      { hora:'16:00',         emoji:'🏨', color:'color-azul',   desc:'Check-in en '+n,                  nota:'Explorá las instalaciones' },
      { hora:H('cena',hs),    emoji:'🍽️', color:'color-dorado', desc:'Cena en el nuevo hotel',          nota:'' },
    ];
  }

  function aPlaya(hs) { return [
    { hora:'08:30',      emoji:'🌅', color:'color-dorado',  desc:'Desayuno en el resort',          nota:'' },
    { hora:'10:00',      emoji:'🏖️', color:'color-azul',   desc:'Playa / Pileta',                 nota:'Protector solar SPF 50+' },
    { hora:'13:00',      emoji:'🍹', color:'color-dorado',  desc:'Almuerzo y cocteles',            nota:'' },
    { hora:'15:00',      emoji:'🏊', color:'color-azul',    desc:'Deportes acuáticos o excursión', nota:'' },
    { hora:'18:00',      emoji:'🌇', color:'color-naranja', desc:'Atardecer en la playa',          nota:'Momento fotográfico imperdible' },
    { hora:H('cena',hs), emoji:'🍽️', color:'color-dorado', desc:'Cena',                          nota:'' },
  ]; }

  function aCrucero(i, N, hs) {
    if (i === 0) return [
      { hora:'10:00',      emoji:'🚐', color:'color-naranja', desc:'Traslado al puerto',             nota:'' },
      { hora:'12:00',      emoji:'🚢', color:'color-azul',   desc:'Embarque',                      nota:'Drill de seguridad obligatorio' },
      { hora:'16:00',      emoji:'🌊', color:'color-azul',   desc:'Zarpe — ¡empieza la aventura!', nota:'' },
      { hora:H('cena',hs), emoji:'🍽️', color:'color-dorado',desc:'Cena de bienvenida',            nota:'' },
    ];
    if (i === N - 1) return [
      { hora:'07:00', emoji:'🌅', color:'color-dorado',  desc:'Último desayuno a bordo', nota:'' },
      { hora:'09:00', emoji:'🧳', color:'color-azul',    desc:'Desembarque',              nota:'' },
      { hora:'11:00', emoji:'🚐', color:'color-naranja', desc:'Traslado desde el puerto', nota:'' },
    ];
    return [
      { hora:'08:00',      emoji:'🌅', color:'color-dorado', desc:'Desayuno a bordo',                    nota:'' },
      { hora:'09:30',      emoji:'⚓', color:'color-azul',   desc:'Puerto del día / excursión terrestre', nota:'Confirmar con anticipación' },
      { hora:'13:00',      emoji:'🍽️', color:'color-dorado',desc:'Almuerzo a bordo o en tierra',        nota:'' },
      { hora:'15:00',      emoji:'🎭', color:'color-lila',   desc:'Entretenimiento a bordo',              nota:'' },
      { hora:H('cena',hs), emoji:'🍽️', color:'color-dorado',desc:'Cena en el comedor temático',        nota:'Reservar con anticipación' },
      { hora:'21:00',      emoji:'🎸', color:'color-lila',   desc:'Show nocturno a bordo',               nota:'' },
    ];
  }

  function aCiudad(hs) { return [
    { hora:'08:30',      emoji:'☕', color:'color-dorado',  desc:'Desayuno en café local',               nota:'' },
    { hora:'10:00',      emoji:'🏛️', color:'color-azul',   desc:'Visita cultural / Museo / Sitio histórico', nota:'' },
    { hora:'13:00',      emoji:'🍽️', color:'color-dorado', desc:'Almuerzo — gastronomía típica',        nota:'' },
    { hora:'15:00',      emoji:'🚶', color:'color-verde',   desc:'Barrio histórico / Tour a pie',        nota:'' },
    { hora:'17:30',      emoji:'📸', color:'color-lila',    desc:'Fotos en los puntos icónicos',         nota:'' },
    { hora:H('cena',hs), emoji:'🍽️', color:'color-dorado', desc:'Cena',                                nota:'' },
  ]; }

  function aSalida(hs) { return [
    { hora:'07:00',        emoji:'🌅', color:'color-dorado',  desc:'Desayuno final en el hotel',                     nota:'' },
    { hora:H('checkout',hs),emoji:'🧳',color:'color-azul',    desc:'Check-out y preparación del equipaje',           nota:'' },
    { hora:'',             emoji:'🌿', color:'color-verde',   desc:'Última mañana libre — fotos, recuerdos, compras', nota:'' },
    { hora:'',             emoji:'🚐', color:'color-naranja', desc:'Traslado al aeropuerto',                          nota:'Llegar con 3 horas de anticipación' },
    { hora:'',             emoji:'✈️', color:'color-navy',   desc:'Vuelo de regreso a casa 🏠',                      nota:'¡Hasta la próxima aventura! ✨' },
  ]; }

  // ══════════════════════════════════════════════════════════
  //  generateItineraryDays(budget, opts) → Array<Dia>
  // ══════════════════════════════════════════════════════════
  function generateItineraryDays(budget, opts) {
    if (!budget) return [];
    opts = opts || {};

    var f = getFechas(budget);
    if (!f.fechaIn || !f.fechaOut) return [];

    var d1 = new Date(f.fechaIn  + 'T12:00:00');
    var d2 = new Date(f.fechaOut + 'T12:00:00');
    var N  = Math.round((d2 - d1) / 86400000) + 1;
    if (N < 1) return [];

    var modo = opts.modo || detectModo(budget);
    var hs   = opts.horarios || null;

    // Hoteles
    var aloj = (budget.alojamiento || []).map(function(a) {
      return { nombre: a.nombre||'', checkin: a.checkin||f.fechaIn, checkout: a.checkout||f.fechaOut };
    });
    var primerHotel = aloj.length ? aloj[0].nombre : '';
    var trasladoDates = {};
    if (aloj.length > 1) {
      aloj.forEach(function(a, i) { if (i > 0) trasladoDates[a.checkin] = a; });
    }

    // Parques desde tickets del presupuesto
    var parquesDisp = opts.parquesDisponibles ||
      ['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom'];
    var parques = buildParquesOrdenados(budget, parquesDisp);

    // Días especiales desde tickets
    var tieneAgua     = opts.reglaAgua     !== undefined ? opts.reglaAgua     : hasTicket(budget, /water.?park|blizzard|aquatica/i);
    var tieneShopping = opts.reglaShopping !== undefined ? opts.reglaShopping : hasTicket(budget, /springs|shopping/i);
    var descansoEn    = opts.descansoEn || 2;

    var R = {
      llegada:  opts.reglaLlegada  !== false,
      salida:   opts.reglaSalida   !== false,
      traslado: opts.reglaTraslado !== false,
      descanso: opts.reglaDescanso !== false,
    };

    var dias = [], pIdx = 0, dParque = 0, aguaUsado = false;

    for (var i = 0; i < N; i++) {
      var fecha = addDays(f.fechaIn, i);

      var dia = {
        numero:      i + 1,
        fecha:       fecha,
        fechaLabel:  formatDateES(fecha),
        tipo:        'parque',
        titulo:      '',
        actividades: [],
        nota:        '',
        visible:     true,
      };

      // Llegada
      if (i === 0 && R.llegada) {
        dia.tipo = 'llegada'; dia.titulo = 'Llegada y bienvenida';
        dia.actividades = aLlegada(primerHotel, hs);
        dias.push(dia); continue;
      }

      // Salida
      if (i === N - 1 && R.salida) {
        dia.tipo = 'salida'; dia.titulo = 'Día de salida';
        dia.actividades = aSalida(hs);
        dias.push(dia); continue;
      }

      // Cambio de hotel
      if (trasladoDates[fecha] && R.traslado) {
        dia.tipo = 'traslado_hotel';
        dia.titulo = 'Cambio de hotel → ' + trasladoDates[fecha].nombre;
        dia.actividades = aTrasladoHotel(trasladoDates[fecha], hs);
        dias.push(dia); continue;
      }

      if (modo === 'disney') {
        // Descanso intercalado
        if (R.descanso && dParque > 0 && dParque % descansoEn === 0) {
          dia.tipo = 'descanso'; dia.titulo = 'Día de descanso y relax';
          dia.actividades = aDescanso(hs); dParque = 0;
          dias.push(dia); continue;
        }
        // Acuático (1 vez, después del 2do parque)
        if (tieneAgua && !aguaUsado && pIdx === 2) {
          dia.tipo = 'libre'; dia.titulo = 'Parque acuático';
          dia.actividades = aAcuatico(hs); aguaUsado = true;
          dias.push(dia); continue;
        }
        // Shopping (penúltimo día útil)
        if (tieneShopping && i === N - 2) {
          dia.tipo = 'libre'; dia.titulo = 'Disney Springs & Shopping';
          dia.actividades = aShopping(hs);
          dias.push(dia); continue;
        }
        // Parque
        var pn = parques.length ? parques[pIdx % parques.length] : 'Parque temático';
        pIdx++; dParque++;
        dia.tipo = 'parque'; dia.titulo = pn;
        dia.actividades = aParque(pn, hs);

      } else if (modo === 'playa') {
        dia.tipo = 'playa'; dia.titulo = 'Playa & relax';
        dia.actividades = aPlaya(hs);

      } else if (modo === 'crucero') {
        dia.tipo = 'crucero';
        dia.titulo = i===0 ? 'Embarque' : i===N-1 ? 'Desembarque' : 'Día en crucero / Puerto';
        dia.actividades = aCrucero(i, N, hs);

      } else if (modo === 'ciudad') {
        dia.tipo = 'ciudad'; dia.titulo = 'Exploración de la ciudad';
        dia.actividades = aCiudad(hs);

      } else {
        dia.tipo = 'libre'; dia.titulo = 'Día ' + (i + 1);
        dia.actividades = [{ hora:'09:00', emoji:'🌿', color:'color-verde', desc:'', nota:'' }];
      }

      dias.push(dia);
    }

    return dias;
  }

  return {
    generateItineraryDays: generateItineraryDays,
    detectModo:            detectModo,
    buildParquesOrdenados: buildParquesOrdenados,
    getFechas:             getFechas,
    formatDateES:          formatDateES,
    addDays:               addDays,
  };

})();
