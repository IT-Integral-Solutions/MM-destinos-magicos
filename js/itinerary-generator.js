/**
 * TASS — itinerary-generator.js v4.0
 * Input:  budget (collectBudgetData)
 * Output: Array<Dia> con agenda detallada por franja horaria
 */
var TASS_ItineraryGenerator = (function () {

  // ── Utils ───────────────────────────────────────────────
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
  function getFechas(b) {
    var v = b.vuelo, d = b.destino || {};
    return {
      fechaIn:  (v && v.fechaIda)    || d.fechaIn  || '',
      fechaOut: (v && v.fechaVuelta) || d.fechaOut || '',
    };
  }

  // ── Detección de modo ───────────────────────────────────
  function detectModo(b) {
    if (b.crucero) return 'crucero';
    var dest = ((b.destino && b.destino.nombre) || '').toLowerCase();
    var tks  = (b.tickets || []).map(function(t) {
      return ((t.parque||'') + ' ' + (t.complejo||'') + ' ' + (t.desc||'')).toLowerCase();
    }).join(' ');
    var all = dest + ' ' + tks;
    if (/disney|magic.?kingdom|epcot|hollywood.studios|animal.kingdom/i.test(all))         return 'disney';
    if (/universal|islands.of.adventure|epic.universe/i.test(all))                         return 'universal';
    if (/disney.*universal|universal.*disney/i.test(all))                                   return 'combo';
    if (/seaworld|busch|aquatica/i.test(all))                                               return 'disney';
    if (/caribe|cancun|cancún|playa|beach|resort/i.test(dest))                             return 'playa';
    if (/europa|paris|madrid|roma|london|amsterdam|ciudad/i.test(dest))                    return 'ciudad';
    return 'libre';
  }

  // ── Parques ordenados desde tickets ────────────────────
  var DISNEY_ORDER = ['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom'];
  var UNIV_ORDER   = ['Universal Studios','Islands of Adventure','Epic Universe'];

  function buildParquesOrdenados(b, fallback) {
    // Intentar leer desde tickets
    var lista = [];
    if (b.ticketsActivos !== false) {
      (b.tickets || []).forEach(function(t) {
        var src = (t.parque || t.desc || '');
        var raw = src
          .replace(/^Walt Disney World\s*[–\-]\s*/i,'')
          .replace(/^Disney WDW\s*[–\-]\s*/i,'')
          .replace(/[·–]\s*\d+\s*días?/gi,'')
          .trim();
        // Si es un tipo genérico, ignorar — lo manejamos por modo
        if (!raw || /^(Ticket Base|Hopper|Park Hopper|Park to Park|3.Park|Base)$/i.test(raw)) return;
        if (/water.?park|blizzard|aquatica|springs|shopping|discovery/i.test(raw)) return;
        var cant = Math.max(1, parseInt(t.cant) || 1);
        for (var k = 0; k < cant; k++) lista.push(raw);
      });
    }

    // Si no hay parques específicos, usar orden canónico según modo
    if (!lista.length) {
      var modo = detectModo(b);
      if (modo === 'disney')   return DISNEY_ORDER.slice();
      if (modo === 'universal') return UNIV_ORDER.slice();
      if (modo === 'combo')    return DISNEY_ORDER.concat(UNIV_ORDER);
      return fallback || DISNEY_ORDER.slice();
    }

    // Ordenar: Disney primero, Universal después
    var disneyPks = lista.filter(function(p) {
      return DISNEY_ORDER.some(function(d){ return p.toLowerCase().indexOf(d.toLowerCase())>-1; });
    });
    var univPks = lista.filter(function(p) {
      return UNIV_ORDER.some(function(u){ return p.toLowerCase().indexOf(u.toLowerCase())>-1; });
    });
    var otros = lista.filter(function(p) {
      return !disneyPks.includes(p) && !univPks.includes(p);
    });

    // Si no matchearon, devolver lista original
    var ordered = disneyPks.concat(univPks).concat(otros);
    return ordered.length ? ordered : lista;
  }

  // ── Hoteles y cambios de hotel ──────────────────────────
  function getHotelTransitions(b, fechaIn, fechaOut) {
    var aloj = (b.alojamiento || []).map(function(a) {
      return {
        nombre:   a.nombre   || '',
        checkin:  a.checkin  || fechaIn,
        checkout: a.checkout || fechaOut,
      };
    });
    var transitions = {};
    if (aloj.length > 1) {
      aloj.forEach(function(a, i) {
        if (i > 0) transitions[a.checkin] = a;
      });
    }
    return { aloj: aloj, transitions: transitions };
  }

  // ── Contenido de agendas ────────────────────────────────

  var PARQUE_DATA = {
    'Magic Kingdom': {
      emoji: '🏰',
      manana:   'Ingreso a Magic Kingdom antes de la apertura oficial. Primeras atracciones: Seven Dwarfs Mine Train y Space Mountain aprovechando las filas cortas de la mañana.',
      mediodia: 'Almuerzo en Be Our Guest Restaurant o en los food carts de Main Street. Pausa estratégica para recargar energías durante las horas de mayor calor.',
      tarde:    'Afternoon Parade por Main Street. Atracciones secundarias: Pirates of the Caribbean, Haunted Mansion, Splash Mountain. Lightning Lane para las más demandadas.',
      noche:    '✨ Happily Ever After — el espectáculo de fuegos artificiales sobre el Castillo de Cenicienta. Posicionarse en Main Street 30 min antes para los mejores lugares.'
    },
    'EPCOT': {
      emoji: '🌍',
      manana:   'Guardianes de la Galaxia — Cosmic Rewind al abrir (Virtual Queue requerido). Luego Test Track y Mission: SPACE antes de que lleguen las multitudes.',
      mediodia: 'World Showcase abre a las 11hs. Almuerzo temático en uno de los pabellones internacionales: México, Italia, Japón o Marruecos.',
      tarde:    'Recorrida completa de World Showcase. Frozen Ever After en Norway. Compras artesanales en los pabellones culturales.',
      noche:    '🌟 EPCOT Forever — espectáculo nocturno sobre el World Showcase Lagoon con proyecciones, fuegos artificiales y música icónica de Disney.'
    },
    'Hollywood Studios': {
      emoji: '🎬',
      manana:   'Rise of the Resistance al abrir — llegar 30 minutos antes del horario oficial. Esta es la atracción más demandada del parque: no puede perderse.',
      mediodia: 'Almuerzo en Sci-Fi Dine-In Theater (reserva anticipada recomendada) o en los puestos de comida de la zona de Star Wars.',
      tarde:    'Millennium Falcon: Smugglers Run y Slinky Dog Dash en Toy Story Land. Show de Indiana Jones.',
      noche:    '🎆 Fantasmic! — el espectáculo nocturno que combina proyecciones sobre agua, personajes en vivo y fuegos artificiales. Llegar 45 min antes.'
    },
    'Animal Kingdom': {
      emoji: '🦁',
      manana:   'Flight of Passage en Pandora al abrir — los animales están más activos a primera hora y las filas son notablemente más cortas.',
      mediodia: 'Almuerzo en Satuli Canteen (cocina de Pandora) o en Flame Tree Barbecue con vistas al parque. Descanso en las zonas de sombra.',
      tarde:    'Safaris de Kilimanjaro — mejor en la tarde temprana. Kali River Rapids. Espectáculo Finding Nemo: The Big Blue... and Beyond!',
      noche:    '🌅 Tree of Life Awakenings — proyecciones nocturnas sobre el Árbol de la Vida. Breve pero impactante. Vale la pena esperar hasta el cierre.'
    },
    'Universal Studios': {
      emoji: '🎭',
      manana:   'Harry Potter and the Escape from Gringotts al abrir. Luego Hagrid\'s Magical Creatures al inicio de la jornada aprovechando tiempos de espera mínimos.',
      mediodia: 'Almuerzo en Three Broomsticks (Hogsmeade) o en Springfield — área de Los Simpsons. Butterbeer helado como postre imperdible.',
      tarde:    'Hollywood Rip Ride Rockit, Transformers, Despicable Me. Zona de Springfield con atracciones interactivas.',
      noche:    '🎵 Universal\'s Cinematic Spectacular — proyecciones sobre el lago con escenas de las películas más icónicas. Cierre mágico del día.'
    },
    'Islands of Adventure': {
      emoji: '⚡',
      manana:   'Velocicoaster al abrir — la montaña rusa más emocionante de Florida. Luego Hagrid\'s Magical Creatures Motorbike antes de que se forme la fila.',
      mediodia: 'Almuerzo en Three Broomsticks en Hogsmeade o en Confisco Grille. Visitar Butterbeer y las tiendas mágicas de Hogsmeade.',
      tarde:    'The Incredible Hulk Coaster, Spider-Man, Jurassic World Velocicoaster (segunda vuelta). Zona de Doctor Seuss para los más pequeños.',
      noche:    '🦅 Cierre del día en Hogsmeade iluminado — la magia del castillo de Hogwarts con iluminación nocturna es una experiencia única.'
    },
    'Epic Universe': {
      emoji: '✨',
      manana:   'Ingreso anticipado a Ministry of Magic — Harry Potter Universe. Las nuevas atracciones de este parque 2025 tienen demanda altísima: ir muy temprano.',
      mediodia: 'Almuerzo en la zona temática de tu elección — cada mundo tiene restaurantes inmersivos únicos.',
      tarde:    'Exploración de los distintos mundos temáticos. Este parque tiene escala mayor que los anteriores — planificar bien el recorrido.',
      noche:    '🌟 Espectáculo de cierre — Epic Universe ofrece una producción nocturna de gran escala. Posicionarse 20 min antes para buena visibilidad.'
    },
  };

  var DEFAULT_PARK = {
    emoji: '🎢',
    manana:   'Ingreso al parque a primera hora aprovechando las filas más cortas del día. Atracciones principales con Lightning Lane para las más demandadas.',
    mediodia: 'Pausa para el almuerzo dentro del parque. Descanso estratégico para afrontar la tarde con energía.',
    tarde:    'Segunda ronda de atracciones, shows y experiencias interactivas. Compras de souvenirs en las tiendas temáticas.',
    noche:    'Show o espectáculo de cierre del parque. Una experiencia que vale la pena esperar para terminar el día con magia.'
  };

  function getParkData(nombre) {
    for (var k in PARQUE_DATA) {
      if (nombre.toLowerCase().indexOf(k.toLowerCase()) > -1) return PARQUE_DATA[k];
    }
    // Fallback por tipo de ticket genérico
    var n = nombre.toLowerCase();
    if (/park.to.park|universal.*base|universal.*3.park/i.test(n)) return PARQUE_DATA['Universal Studios'];
    if (/hopper|disney.*base|wdw/i.test(n))                        return PARQUE_DATA['Magic Kingdom'];
    if (/islands|ioa/i.test(n))                                     return PARQUE_DATA['Islands of Adventure'];
    if (/epic.universe/i.test(n))                                   return PARQUE_DATA['Epic Universe'];
    return DEFAULT_PARK;
  }

  // ── Agendas por tipo de día ─────────────────────────────

  function agendaLlegada(hotel, vuelo) {
    var destino = hotel || 'el resort';
    var vueloInfo = vuelo ? ('Vuelo ' + (vuelo.aerolinea||'') + ' desde ' + (vuelo.origen||'origen') + '. ') : '';
    return {
      manana:   vueloInfo + 'Traslado al aeropuerto y preparación del equipaje. Documentación lista: pasaportes, vouchers y confirmaciones impresas o en el celular.',
      mediodia: 'Llegada y traslado a ' + destino + '. Check-in y primera recorrida por las instalaciones del resort. Ideal para orientarse y planificar los días siguientes.',
      tarde:    'Tiempo libre para descansar del viaje, conocer la zona y hacer las primeras compras de snacks y essentials. Visita al centro comercial más cercano si hay energía.',
      noche:    '🥂 Cena de bienvenida en el resort — el mejor comienzo para una aventura inolvidable. Brindis en familia por el viaje que empieza.'
    };
  }

  function agendaDescanso(esPost, primerParcial) {
    return {
      manana:   '☀️ Mañana sin apuros. Desayuno tranquilo en el resort o en una cafetería cercana. Tiempo para cargar el celular, revisar fotos y planificar los próximos parques.',
      mediodia: 'Día libre a elección: piscina del resort, paseo por Disney Springs o los alrededores del hotel. Sin filas, sin reloj — puro disfrute.',
      tarde:    '🏊 Piscina o spa del resort. Perfecto momento para hidratarse, usar los toboganes y descansar los pies después de jornadas intensas en los parques.',
      noche:    '🍽️ Cena en un restaurante diferente — explorar opciones fuera del parque. Disney Springs tiene decenas de opciones para todos los gustos y presupuestos.'
    };
  }

  function agendaTransicion(hotelActual, hotelNuevo) {
    var nuevo = (hotelNuevo && hotelNuevo.nombre) || 'nuevo hotel';
    return {
      manana:   '🧳 Check-out de ' + (hotelActual||'el hotel actual') + '. Equipaje listo y facturado antes de las 11hs para evitar cargos adicionales.',
      mediodia: 'Tiempo libre antes del check-in. Almuerzo de transición — ideal para visitar Disney Springs, City Walk o la zona comercial entre los resorts.',
      tarde:    'Check-in en ' + nuevo + '. Primera recorrida por las instalaciones: piscina, restaurantes, servicios. Orientarse para aprovechar al máximo los días siguientes.',
      noche:    '🌅 Cena en el nuevo resort. Cada hotel Disney/Universal tiene opciones gastronómicas únicas — una buena oportunidad para conocer la propuesta culinaria del lugar.'
    };
  }

  function agendaShopping(hasSpring) {
    return {
      manana:   '🛍️ Mañana de compras en Disney Springs. World of Disney (la tienda más grande de temática Disney del mundo), LEGO, Uniqlo y decenas de opciones para todos los gustos.',
      mediodia: 'Almuerzo en Disney Springs — The BOATHOUSE, STK, Morimoto o cualquiera de los más de 20 restaurantes disponibles. Sin reserva: Enzo\'s Hideaway funciona muy bien.',
      tarde:    'Últimas compras de souvenirs y regalos. PhotoPass en los puntos icónicos del área. Aprovechando que no hay entradas de parque, el ritmo es mucho más tranquilo.',
      noche:    '🎶 Música en vivo en los escenarios al aire libre de Disney Springs. Cierre mágico con compras, fotos y el ambiente único de este espacio sin costo de entrada.'
    };
  }

  function agendaAcuatico(parqueNombre) {
    var nombre = parqueNombre || 'parque acuático';
    return {
      manana:   '💧 Llegada a ' + nombre + ' al abrir (9am). Las primeras 2 horas son las más tranquilas — perfecto para los toboganes principales con esperas mínimas.',
      mediodia: 'Almuerzo dentro del parque o en los alrededores. Aplicar protector solar FPS 50+ nuevamente. Hidratación constante — el calor de Florida es intenso.',
      tarde:    '🌊 Río lento, área de olas y toboganes secundarios. Zona infantil si hay niños pequeños. Las tardes suelen ser más tranquilas cuando algunos visitantes se van.',
      noche:    '🌅 Cierre del día con ducha en el hotel, descanso y cena liviana. Los parques acuáticos son físicamente demandantes — una noche tranquila es la mejor recompensa.'
    };
  }

  function agendaPlaya() {
    return {
      manana:   '🌅 Desayuno con vista al mar. Primera sesión de playa desde las 9am — las horas de la mañana son las más frescas y la luz es perfecta para fotos.',
      mediodia: 'Almuerzo en el beach bar del resort o en un restaurante local recomendado. Pausa bajo la sombra durante las horas de mayor intensidad solar.',
      tarde:    '🏄 Deportes acuáticos: kayak, snorkeling, parasailing o simplemente disfrutar el mar. Las tardes en el Caribe tienen una luz y temperatura únicas.',
      noche:    '🍹 Atardecer en la playa con cócteles de temporada. Cena en restaurante con vista al mar — el broche de oro para un día en el paraíso.'
    };
  }

  function agendaCrucero(nDia, total, linea) {
    if (nDia === 0) return {
      manana:   '🚢 Traslado al puerto de embarque. Check-in del crucero y depósito del equipaje. Preparar documentación: pasaportes y tarjetas de embarque impresas.',
      mediodia: 'Embarque en ' + (linea||'el crucero') + '. Exploración del barco: cubiertas, restaurantes, piscinas y entretenimiento. El camarote estará disponible desde las 13:30hs.',
      tarde:    'Drill de seguridad obligatorio (muster drill). Zarpe y celebración en la cubierta principal. Primer avistamiento del océano desde el barco.',
      noche:    '🥂 Cena de bienvenida en el comedor principal con el Capitán. Primera noche en alta mar — una experiencia única que vale cada momento.'
    };
    if (nDia === total - 1) return {
      manana:   '🌅 Último desayuno a bordo. Equipaje debe estar en el pasillo antes de las 8am para el desembarque. Fotos finales en cubierta.',
      mediodia: 'Desembarque organizado por grupos. Trámites de aduana y retirada de equipaje en el puerto. Traslado al hotel o aeropuerto según el itinerario.',
      tarde:    'Tiempo libre post-crucero según los vuelos de regreso. Si hay tiempo: últimas compras en el puerto o almuerzo en tierra.',
      noche:    '🏠 Regreso a casa con los mejores recuerdos. El mar, los puertos, las cenas: un viaje que va a quedar grabado para siempre.'
    };
    return {
      manana:   '⚓ Puerto del día — desembarque para excursión o exploración libre. Las excursiones contratadas a bordo incluyen transporte y garantizan el regreso al barco.',
      mediodia: 'Almuerzo en tierra o a bordo según la preferencia. El buffet del barco siempre es una opción confiable y variada.',
      tarde:    '🎭 Regreso al crucero y entretenimiento a bordo: shows, casino, spas y actividades para todas las edades. El atardecer desde cubierta es imperdible.',
      noche:    '🍽️ Cena en el comedor temático — cada noche tiene un ambiente diferente. Show nocturno en el teatro principal del barco.'
    };
  }

  function agendaCiudad(ciudad, nDia) {
    var c = ciudad || 'la ciudad';
    return {
      manana:   '🏛️ Visita al atractivo principal de ' + c + '. Museos, sitios históricos o barrios emblemáticos según los intereses del grupo. Guía local recomendado.',
      mediodia: 'Almuerzo en restaurante local típico — la mejor manera de conocer la gastronomía auténtica. El mercado central suele ser una excelente opción.',
      tarde:    '📸 Recorrida por los barrios históricos y puntos fotográficos icónicos. Shopping en tiendas locales: artesanías, productos típicos y recuerdos únicos.',
      noche:    '🌆 Cena en restaurante recomendado con la cocina representativa de la región. Una copa en una terraza con vistas para cerrar el día de la mejor manera.'
    };
  }

  function agendaSalida(hotel, vuelo) {
    var hr = vuelo ? ('Vuelo ' + (vuelo.aerolinea||'') + ' a las ' + (vuelo.fechaVuelta||'') + '. ') : '';
    return {
      manana:   '🧳 ' + hr + 'Check-out de ' + (hotel||'el hotel') + '. Desayuno final y últimos momentos en el resort. Foto grupal de despedida en el lobby.',
      mediodia: 'Traslado al aeropuerto con tiempo suficiente. Check-in del vuelo y trámites de migraciones. Últimas compras libres de impuestos en el duty free.',
      tarde:    '✈️ Embarque y vuelo de regreso. Momento de revisar las fotos del viaje y recordar cada día vivido. El mejor vuelo es el que trae los mejores recuerdos.',
      noche:    '🏠 Llegada a casa. El viaje termina, pero los recuerdos y la magia duran para siempre. ¡Ya es hora de empezar a planificar el próximo!'
    };
  }

  // ── GENERADOR PRINCIPAL ─────────────────────────────────
  function generateItineraryDays(budget, opts) {
    if (!budget) return [];
    opts = opts || {};

    var f = getFechas(budget);
    if (!f.fechaIn || !f.fechaOut) return [];

    var d1 = new Date(f.fechaIn  + 'T12:00:00');
    var d2 = new Date(f.fechaOut + 'T12:00:00');
    var N  = Math.round((d2 - d1) / 86400000) + 1;
    if (N < 1) return [];

    var modo  = opts.modo || detectModo(budget);
    var dest  = (budget.destino && budget.destino.nombre) || '';
    var vuelo = budget.vuelo || null;

    // Hoteles
    var hotelInfo = getHotelTransitions(budget, f.fechaIn, f.fechaOut);
    var aloj         = hotelInfo.aloj;
    var transitions  = hotelInfo.transitions;
    var primerHotel  = aloj.length ? aloj[0].nombre : '';
    var ultimoHotel  = aloj.length ? aloj[aloj.length-1].nombre : primerHotel;

    // Parques
    var parquesDisp = opts.parquesDisponibles || [];
    var parques     = buildParquesOrdenados(budget, parquesDisp);

    // Detectar Disney/Universal específicos
    var hasDisney   = parques.some(function(p){ return DISNEY_ORDER.some(function(d){ return p.toLowerCase().indexOf(d.toLowerCase())>-1; }); });
    var hasUniv     = parques.some(function(p){ return UNIV_ORDER.some(function(u){ return p.toLowerCase().indexOf(u.toLowerCase())>-1; }); });

    // Días especiales desde tickets
    var tieneAgua     = opts.reglaAgua     !== undefined ? opts.reglaAgua     : (budget.tickets||[]).some(function(t){ return /water.?park|blizzard|aquatica/i.test((t.parque||'')+(t.desc||'')); });
    var tieneShopping = opts.reglaShopping !== undefined ? opts.reglaShopping : (budget.tickets||[]).some(function(t){ return /springs|shopping/i.test((t.parque||'')+(t.desc||'')); });
    var descansoEn    = opts.descansoEn || 2;

    var R = {
      llegada:  opts.reglaLlegada  !== false,
      salida:   opts.reglaSalida   !== false,
      traslado: opts.reglaTraslado !== false,
      descanso: opts.reglaDescanso !== false,
    };

    var dias       = [];
    var pIdx       = 0;
    var dParque    = 0;
    var aguaUsado  = false;

    for (var i = 0; i < N; i++) {
      var fecha     = addDays(f.fechaIn, i);
      var esLlegada = (i === 0);
      var esSalida  = (i === N - 1);

      // Hotel actual en esta fecha
      var hotelActual = primerHotel;
      aloj.forEach(function(a) {
        if (fecha >= a.checkin && fecha < a.checkout) hotelActual = a.nombre;
      });

      var dia = {
        dia:      i + 1,
        fecha:    fecha,
        fechaLabel: formatDateES(fecha),
        tipo:     'parque',
        titulo:   '',
        parque:   null,
        hotel:    hotelActual,
        agenda:   { manana:'', mediodia:'', tarde:'', noche:'' },
        nota:     '',
        visible:  true,
        // compatibilidad con renderer actual
        numero:      i + 1,
        actividades: [],
      };

      // ── LLEGADA ────────────────────────────────────────
      if (esLlegada && R.llegada) {
        dia.tipo   = 'llegada';
        dia.titulo = '¡Bienvenidos! — Llegada y primer contacto con la magia';
        dia.agenda = agendaLlegada(primerHotel, vuelo);
        dia.actividades = agendaToActividades(dia.agenda, '✈️');
        dias.push(dia); continue;
      }

      // ── SALIDA ──────────────────────────────────────────
      if (esSalida && R.salida) {
        dia.tipo   = 'salida';
        dia.titulo = 'Hasta pronto — Día de regreso a casa';
        dia.agenda = agendaSalida(ultimoHotel, vuelo);
        dia.actividades = agendaToActividades(dia.agenda, '🏠');
        dias.push(dia); continue;
      }

      // ── CAMBIO DE HOTEL (transición) ────────────────────
      if (transitions[fecha] && R.traslado) {
        var nuevoH = transitions[fecha];
        var hotelPrev = '';
        aloj.forEach(function(a) { if (a.checkout === fecha) hotelPrev = a.nombre; });
        dia.tipo   = 'transicion';
        dia.titulo = 'Cambio de resort — De Disney a Universal y nuevas aventuras';
        dia.agenda = agendaTransicion(hotelPrev, nuevoH);
        dia.actividades = agendaToActividades(dia.agenda, '🔄');
        dias.push(dia); continue;
      }

      // ── MODOS ──────────────────────────────────────────
      if (modo === 'disney' || modo === 'universal' || modo === 'combo') {

        // Descanso cada N días de parque
        if (R.descanso && dParque > 0 && dParque % descansoEn === 0) {
          dia.tipo   = 'descanso';
          dia.titulo = 'Día de recarga — Descanso y tiempo libre';
          dia.agenda = agendaDescanso(dParque > 0, parques[0]);
          dia.actividades = agendaToActividades(dia.agenda, '😴');
          dParque = 0;
          dias.push(dia); continue;
        }

        // Parque acuático (1 vez, después del 2do parque normal)
        if (tieneAgua && !aguaUsado && pIdx === 2) {
          dia.tipo   = 'parque';
          dia.titulo = 'Un día de agua — Parque acuático';
          dia.parque = 'Parque acuático';
          dia.agenda = agendaAcuatico(null);
          dia.actividades = agendaToActividades(dia.agenda, '💧');
          aguaUsado = true;
          dias.push(dia); continue;
        }

        // Shopping (penúltimo día útil, solo si no es salida)
        if (tieneShopping && i === N - 2 && !esSalida) {
          dia.tipo   = 'libre';
          dia.titulo = 'Día de compras — Disney Springs & Shopping';
          dia.agenda = agendaShopping(true);
          dia.actividades = agendaToActividades(dia.agenda, '🛍️');
          dias.push(dia); continue;
        }

        // Parque normal
        var pn = parques.length ? parques[pIdx % parques.length] : (modo==='universal'?'Universal Studios':'Magic Kingdom');
        var pkData = getParkData(pn);
        pIdx++;
        dParque++;
        dia.tipo   = 'parque';
        dia.titulo = pkData.emoji + ' Día en ' + pn;
        dia.parque = pn;
        dia.agenda = {
          manana:   pkData.manana,
          mediodia: pkData.mediodia,
          tarde:    pkData.tarde,
          noche:    pkData.noche,
        };
        dia.actividades = agendaToActividades(dia.agenda, pkData.emoji);

      } else if (modo === 'playa') {
        dia.tipo   = 'playa';
        dia.titulo = '🏖️ Día de playa y relax total';
        dia.agenda = agendaPlaya();
        dia.actividades = agendaToActividades(dia.agenda, '🏖️');

      } else if (modo === 'crucero') {
        var linea = (budget.crucero && budget.crucero.linea) || '';
        dia.tipo   = 'crucero';
        dia.titulo = i===0 ? '🚢 Embarque — ¡El crucero comienza!'
                   : i===N-1 ? '🏠 Desembarque — Fin de la aventura en el mar'
                   : '⚓ Día en crucero — Puerto ' + (i);
        dia.agenda = agendaCrucero(i, N, linea);
        dia.actividades = agendaToActividades(dia.agenda, '🚢');

      } else if (modo === 'ciudad') {
        dia.tipo   = 'ciudad';
        dia.titulo = '🏛️ Exploración de ' + (dest||'la ciudad');
        dia.agenda = agendaCiudad(dest, i);
        dia.actividades = agendaToActividades(dia.agenda, '🏛️');

      } else {
        dia.tipo   = 'libre';
        dia.titulo = 'Día ' + (i+1) + ' — Tiempo libre';
        dia.agenda = { manana:'', mediodia:'', tarde:'', noche:'' };
        dia.actividades = [{ hora:'09:00', emoji:'🌿', color:'color-verde', desc:'Día libre a elección', nota:'' }];
      }

      dias.push(dia);
    }

    return dias;
  }

  // ── Convertir agenda a actividades (compatibilidad con renderer) ──
  var FRANJAS = [
    { key:'manana',   hora:'08:30', emoji:'🌅', color:'color-dorado',  label:'Mañana' },
    { key:'mediodia', hora:'13:00', emoji:'🍽️', color:'color-dorado', label:'Mediodía' },
    { key:'tarde',    hora:'15:00', emoji:'🌤️', color:'color-azul',   label:'Tarde' },
    { key:'noche',    hora:'19:30', emoji:'🌙', color:'color-lila',   label:'Noche' },
  ];

  function agendaToActividades(agenda, baseEmoji) {
    var acts = [];
    FRANJAS.forEach(function(f) {
      var texto = agenda[f.key];
      if (!texto) return;
      // Primera oración como desc, resto como nota
      var dot = texto.indexOf('. ');
      var desc = dot > -1 ? texto.substring(0, dot + 1) : texto;
      var nota = dot > -1 ? texto.substring(dot + 2) : '';
      // Usar emoji del texto si empieza con uno
      var emo = f.emoji;
      var match = texto.match(/^([\u{1F000}-\u{1FFFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}])/u);
      if (match) { emo = match[1]; desc = texto.substring(match[1].length).trim(); }
      acts.push({ hora: f.hora, emoji: emo, color: f.color, desc: desc, nota: nota });
    });
    return acts;
  }

  // ── API pública ─────────────────────────────────────────
  return {
    generateItineraryDays: generateItineraryDays,
    detectModo:            detectModo,
    buildParquesOrdenados: buildParquesOrdenados,
    getFechas:             getFechas,
    formatDateES:          formatDateES,
    addDays:               addDays,
  };

})();
