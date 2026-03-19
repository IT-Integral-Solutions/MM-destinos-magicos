/**
 * TASS — itinerary-generator.js v6.0
 * Genera itinerario REAL desde datos del presupuesto.
 * Sin plantillas fijas. Sin placeholders genéricos.
 */
var TASS_ItineraryGenerator = (function () {

  // ── Listas de parques reales ────────────────────────────
  var DISNEY   = ['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom','Typhoon Lagoon'];
  var UNIVERSAL= ['Universal Studios','Islands of Adventure','Volcano Bay','Epic Universe'];

  // ── Utils ───────────────────────────────────────────────
  function addDays(str, n) {
    var d = new Date(str + 'T12:00:00');
    d.setDate(d.getDate() + n);
    return d.toISOString().split('T')[0];
  }
  function formatDateES(str) {
    if (!str) return '';
    var d  = new Date(str + 'T12:00:00');
    var DD = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    var MM = ['enero','febrero','marzo','abril','mayo','junio','julio',
              'agosto','septiembre','octubre','noviembre','diciembre'];
    return DD[d.getDay()] + ', ' + d.getDate() + ' de ' + MM[d.getMonth()] + ' ' + d.getFullYear();
  }
  function getFechas(b) {
    var v = b.vuelo || null, d = b.destino || {};
    return {
      fechaIn:  (v && v.fechaIda)    || d.fechaIn  || '',
      fechaOut: (v && v.fechaVuelta) || d.fechaOut || '',
    };
  }
  function isDisney(p)    { return DISNEY.some(function(d){ return p===d; }); }
  function isUniversal(p) { return UNIVERSAL.some(function(u){ return p===u; }); }

  // ── PASO 1: Leer tickets reales del budget ──────────────
  // Devuelve { disney: ['Magic Kingdom', 'EPCOT', ...], universal: [...] }
  function parseTickets(budget) {
    var disneyDays   = [];
    var universalDays= [];

    if (budget.ticketsActivos === false) return { disney: disneyDays, universal: universalDays };

    (budget.tickets || []).forEach(function(t) {
      var src    = ((t.parque||'') + ' ' + (t.desc||'')).toLowerCase();
      var cant   = Math.max(1, parseInt(t.cant) || 1);
      var complejo = (t.complejo || '').toLowerCase();

      // Detectar grupo (Disney o Universal)
      var grupo = null;
      if (complejo.indexOf('disney') > -1 || complejo.indexOf('wdw') > -1 || complejo.indexOf('dl') > -1) {
        grupo = 'disney';
      } else if (complejo.indexOf('universal') > -1) {
        grupo = 'universal';
      } else if (/magic.?kingdom|epcot|hollywood.studios|animal.kingdom|typhoon/i.test(src)) {
        grupo = 'disney';
      } else if (/universal.studios|islands.of.adventure|volcano.bay|epic.universe/i.test(src)) {
        grupo = 'universal';
      }
      if (!grupo) return;

      // Detectar parque específico mencionado explícitamente
      var parqueEspecifico = null;
      var allParks = DISNEY.concat(UNIVERSAL);
      allParks.forEach(function(p) {
        if (!parqueEspecifico && src.indexOf(p.toLowerCase()) > -1) {
          parqueEspecifico = p;
        }
      });

      // Agregar cant entradas al grupo
      for (var k = 0; k < cant; k++) {
        if (grupo === 'disney') {
          // Si hay parque específico, usar ese; si no, se asignará en rotación
          disneyDays.push(parqueEspecifico || null);
        } else {
          universalDays.push(parqueEspecifico || null);
        }
      }
    });

    // Asignar parques reales a los slots vacíos (rotación sin repetir)
    disneyDays    = assignParques(disneyDays, DISNEY);
    universalDays = assignParques(universalDays, UNIVERSAL);

    return { disney: disneyDays, universal: universalDays };
  }

  // Rellena slots null con rotación sin repetir consecutivos
  function assignParques(slots, lista) {
    var rotIdx  = 0;
    var lastPark= null;
    return slots.map(function(p) {
      if (p && lista.indexOf(p) > -1) {
        lastPark = p;
        return p;
      }
      // Rotar sin repetir el anterior
      var tries = 0;
      var chosen = lista[rotIdx % lista.length];
      while (chosen === lastPark && lista.length > 1 && tries < lista.length) {
        rotIdx++;
        chosen = lista[rotIdx % lista.length];
        tries++;
      }
      rotIdx++;
      lastPark = chosen;
      return chosen;
    });
  }

  // Validar y corregir: no repetir consecutivos
  function validateNoRepeat(parks) {
    for (var i = 1; i < parks.length; i++) {
      if (parks[i] === parks[i-1]) {
        // Buscar el siguiente diferente en la misma lista
        var lista = isDisney(parks[i]) ? DISNEY : UNIVERSAL;
        var idx   = lista.indexOf(parks[i]);
        parks[i]  = lista[(idx + 1) % lista.length];
      }
    }
    return parks;
  }

  // ── PASO 2: Construir slot de días ──────────────────────
  // Genera la secuencia: parque, parque, descanso, parque, parque, descanso...
  // usando exactamente los tickets disponibles.
  function buildSlots(disneyParks, universalParks, transicionDates) {
    var allParks = disneyParks.concat(universalParks);
    allParks = validateNoRepeat(allParks);

    var slots  = [];
    var pIdx   = 0;
    var streak = 0; // días de parque consecutivos

    while (pIdx < allParks.length) {
      // Intercalar descanso cada 2 parques
      if (streak > 0 && streak % 2 === 0) {
        slots.push({ tipo: 'descanso', parque: null });
        streak = 0;
      }
      slots.push({ tipo: 'parque', parque: allParks[pIdx] });
      pIdx++;
      streak++;
    }

    return slots;
  }

  // ── PASO 3: Agendas reales por parque ───────────────────
  var AGENDAS = {
    'Magic Kingdom': {
      manana:   'Entrada al parque en la apertura y ataque directo a Seven Dwarfs Mine Train y Space Mountain — las colas más cortas son en los primeros 45 minutos. Early Park Admission si el hotel lo incluye.',
      mediodia: 'Almuerzo en Be Our Guest Restaurant en Fantasyland (reserva requerida) o en el Columbia Harbour House para comer sin espera. Descanso estratégico durante el pico de calor.',
      tarde:    'Pirates of the Caribbean, Haunted Mansion y Big Thunder Mountain. Afternoon Parade por Main Street a las 15hs. Lightning Lane para las atracciones con más de 45 minutos de espera.',
      noche:    'Happily Ever After: el show de proyecciones y fuegos artificiales sobre el Castillo de Cenicienta. Posición ideal: centro de Main Street 30 minutos antes del inicio.'
    },
    'EPCOT': {
      manana:   'Guardians of the Galaxy: Cosmic Rewind requiere Virtual Queue desde las 7am en la app. Test Track y Mission: SPACE antes de las 11hs para evitar filas largas.',
      mediodia: 'World Showcase abre a las 11hs. Almuerzo en La Hacienda de San Angel (México) o Via Napoli (Italia) — reserva anticipada recomendada. Food & Wine Festival si coincide con la fecha.',
      tarde:    'Frozen Ever After en Norway a las 14hs cuando la espera baja. Recorrida completa del World Showcase con 11 pabellones internacionales. Compras artesanales auténticas.',
      noche:    'EPCOT Forever: espectáculo nocturno sobre World Showcase Lagoon con proyecciones, fuegos artificiales y música icónica de Disney. Mejor vista desde la orilla del lago.'
    },
    'Hollywood Studios': {
      manana:   'Rise of the Resistance al abrir — llegar 30 minutos antes del horario oficial. La atracción más inmersiva de toda Florida: las filas superan 90 minutos después de las 10hs.',
      mediodia: 'Almuerzo en Sci-Fi Dine-In Theater (reserva obligatoria) o en los puestos de comida de Galaxy\'s Edge con temática Star Wars. Millennium Falcon: Smugglers Run después de comer.',
      tarde:    'Slinky Dog Dash en Toy Story Land. Show de Indiana Jones a las 16hs. Recorrida por Star Wars: Galaxy\'s Edge al atardecer — la atmósfera es perfecta para fotos.',
      noche:    'Fantasmic!: show nocturno con agua, proyecciones, personajes en vivo y fuegos artificiales. Llegar 45 minutos antes para conseguir lugar en las tribunas.'
    },
    'Animal Kingdom': {
      manana:   'Flight of Passage en Pandora apenas abra el parque — la fila de este simulador supera 2 horas después de las 9am. Kilimanjaro Safaris temprano: los animales están activos y la luz es ideal.',
      mediodia: 'Almuerzo en Satuli Canteen (cocina de Pandora) o en Flame Tree Barbecue con vistas al parque. Pausa en la zona de sombra durante el mediodía más caluroso.',
      tarde:    'Kali River Rapids si el calor lo amerita (mojarse garantizado). Espectáculo Finding Nemo: The Big Blue... and Beyond! en el teatro cubierto. Avatar Flight of Passage segunda vuelta si hubo Lightning Lane.',
      noche:    'Tree of Life Awakenings: proyecciones sobre el Árbol de la Vida que duran solo minutos pero son absolutamente únicas. Animal Kingdom cierra más temprano — aprovechá el día completo.'
    },
    'Typhoon Lagoon': {
      manana:   'Llegada a la apertura (generalmente 10am) y directo a Summit Plummet — la caída más alta del parque. Reservar los mejores sillas antes de que el parque se llene.',
      mediodia: 'Almuerzo en Leaning Palms Restaurant. Re-aplicar protector solar FPS 50+ obligatoriamente. La zona de snorkeling con tiburones y rayas es única en el mundo.',
      tarde:    'Río lento Castaway Creek para descansar mientras avanzás. Toboganes en grupo: Crush \'n\' Gusher para los más aventureros. La zona de olas es perfecta al final de la tarde.',
      noche:    'El parque acuático cierra temprano (17-18hs). Regreso al hotel, ducha larga y cena liviana — un día de agua es físicamente intenso y el cuerpo lo va a pedir.'
    },
    'Universal Studios': {
      manana:   'Harry Potter and the Escape from Gringotts apenas abra. Luego Hagrid\'s Magical Creatures Motorbike Adventure — esta atracción tiene el mayor tiempo de espera del parque y vale cada minuto.',
      mediodia: 'Almuerzo en Three Broomsticks en el área de Harry Potter (incluye Butterbeer helado) o en Krusty Burger en el área de Los Simpsons. Dos experiencias gastronómicas muy distintas.',
      tarde:    'Hollywood Rip Ride Rockit, Transformers 3D y Minion Mayhem. Zona interactiva de Springfield: Los Simpsons Ride y atracciones complementarias.',
      noche:    'Universal\'s Cinematic Spectacular: proyecciones cinematográficas sobre el lago central con escenas de las sagas más icónicas. El cierre más emotivo del parque.'
    },
    'Islands of Adventure': {
      manana:   'Velocicoaster al abrir: la montaña rusa más emocionante de Florida con 4 inversiones y velocidad máxima de 120 km/h. Hagrid\'s a continuación antes de que la fila supere 60 minutos.',
      mediodia: 'Almuerzo en Hogsmeade: Three Broomsticks o Hog\'s Head Pub. Butterbeer en versión caliente si es invierno. Hogwarts Express conecta con Universal Studios (requiere ticket Park to Park).',
      tarde:    'The Incredible Hulk Coaster y Doctor Doom\'s Fearfall para los más valientes. Amazing Adventures of Spider-Man 4K. Zona de Seuss Landing para los más chicos del grupo.',
      noche:    'Hogsmeade iluminado al caer la noche — el Castillo de Hogwarts con proyecciones nocturnas es una de las experiencias visuales más impactantes de todo Orlando.'
    },
    'Volcano Bay': {
      manana:   'Llegada con el sistema TapuTapu activado (pulsera incluida con la entrada). Krakatau Aqua Coaster en la primera hora — la experiencia más única del parque acuático de Universal.',
      mediodia: 'Almuerzo en Kohola Reef Restaurant o en los puestos del parque. Zona de piscina wave para recuperar fuerzas. Protector solar cada 2 horas sin excepción.',
      tarde:    'Ko\'okiri Body Plunge: la caída casi vertical de 53 metros para los más audaces. Honu ika Moana para la familia. El río lento Kopiko Wai Winding River para cerrar la tarde.',
      noche:    'Cierre temprano (generalmente 17-18hs). Regreso al Loews Hotel, tiempo en el spa o piscina del resort y cena en CityWalk con las opciones gastronómicas de Universal.'
    },
    'Epic Universe': {
      manana:   'Ministry of Magic — el nuevo mundo de Harry Potter en Epic Universe al abrir. Este parque 2025 tiene la mayor demanda del mercado: llegar muy temprano es imprescindible.',
      mediodia: 'Cada uno de los 5 mundos temáticos tiene restaurantes completamente inmersivos. La experiencia gastronómica de Epic Universe es parte central del parque — no elegir al azar.',
      tarde:    'How to Train Your Dragon World y Super Nintendo World en la tarde cuando la demanda de los parques de Harry Potter baja. Universal Monster Land para los fanáticos del cine clásico.',
      noche:    'El espectáculo nocturno de Epic Universe es la producción más grande jamás realizada en un parque temático de Florida. Una experiencia que justifica el viaje por sí sola.'
    },
  };

  var AGENDA_DESCANSO_DISNEY = {
    manana:   'Mañana sin boletos de parque — sin apuros ni alarmas. Desayuno con calma en el resort. Tiempo para revisar fotos, cargar el celular y disfrutar las instalaciones del hotel sin correr.',
    mediodia: 'Opción A: piscina del resort con toboganes y servicio de bar. Opción B: visita a Disney Springs — shopping, restaurantes y entretenimiento sin costo de entrada al parque.',
    tarde:    'Piscina o spa del hotel. Los resorts de Disney tienen infraestructura increíble que pocas veces se aprovecha durante un viaje lleno de parques. Este es el momento.',
    noche:    'Cena en restaurante de Disney Springs o en uno de los restaurantes signature del resort. Explorar opciones gastronómicas fuera de los parques es una de las mejores decisiones del viaje.'
  };

  var AGENDA_DESCANSO_UNIVERSAL = {
    manana:   'Descanso total en el resort de Universal. Desayuno con calma aprovechando el acceso exclusivo a los restaurantes del hotel.',
    mediodia: 'CityWalk de Universal: zona comercial y gastronómica con acceso gratuito. Hard Rock Cafe, Antojitos Mexican Food y Voodoo Doughnut son las paradas obligadas.',
    tarde:    'Piscina del resort — los hoteles Loews tienen piscinas temáticas de primer nivel. Perfecto para descansar después de jornadas de parques intensas.',
    noche:    'Cena en uno de los restaurantes de CityWalk o en el restaurante del resort. Ambiente relajado y sin la presión del horario de los parques.'
  };

  var AGENDA_TRANSICION = function(hotelAnterior, hotelNuevo) {
    var prev = hotelAnterior || 'el hotel Disney';
    var next = hotelNuevo   || 'el hotel Universal';
    return {
      manana:   'Check-out de ' + prev + '. Equipaje facturado antes de las 11hs. Desayuno final en el resort disfrutando las instalaciones que no vas a volver a ver en este viaje.',
      mediodia: 'Almuerzo de transición en Disney Springs o en la zona comercial entre resorts — el punto intermedio perfecto. Sin apuros y sin agenda de parques.',
      tarde:    'Check-in en ' + next + '. Primera recorrida por las nuevas instalaciones: piscina, lobby, restaurantes. Orientarse para aprovechar al máximo los días de Universal.',
      noche:    'Cena en CityWalk de Universal — el área gastronómica y de entretenimiento gratuita que conecta los parques. Primer sabor del mundo Universal antes de los parques.'
    };
  };

  var AGENDA_LLEGADA = function(hotel, vuelo) {
    var h = hotel || 'el resort';
    var v = vuelo ? 'Vuelo ' + (vuelo.aerolinea || '') + ' desde ' + (vuelo.origen || 'origen') + '. ' : '';
    return {
      manana:   v + 'Preparación del equipaje y documentación: pasaportes, vouchers de hotel, confirmaciones de restaurantes y tickets de parques. Todo digitalizado en el celular y con copia impresa.',
      mediodia: 'Llegada al aeropuerto de Orlando (MCO) y traslado a ' + h + '. Check-in y primera recorrida por las instalaciones. El viaje empieza a ser real en este momento.',
      tarde:    'Visita a la tienda del resort para los primeros souvenirs y essentials. Orientarse en el mapa del complejo. Descanso del viaje — el primer día es de aclimatación.',
      noche:    'Cena de bienvenida en el restaurante del resort. El mejor comienzo para una aventura que va a quedar grabada para siempre. ¡Brindis en familia por lo que viene!'
    };
  };

  var AGENDA_SALIDA = function(hotel, vuelo) {
    var h = hotel || 'el hotel';
    var v = vuelo ? 'Vuelo ' + (vuelo.aerolinea || '') + ' de regreso. ' : '';
    return {
      manana:   'Check-out de ' + h + '. Equipaje listo antes de las 11hs. Desayuno final aprovechando cada minuto del resort. Fotos grupales de despedida en el lobby.',
      mediodia: 'Traslado al aeropuerto MCO con tiempo suficiente — Orlando tiene mucho tráfico. Check-in del vuelo y trámites de migraciones. Últimas compras en el duty free.',
      tarde:    v + 'Embarque y vuelo de regreso. Momento ideal para organizar las fotos del viaje y empezar a recordar cada atracción, cada show y cada momento compartido.',
      noche:    'Llegada a casa. Los parques terminaron pero la magia queda. Los próximos días van a estar llenos de historias para contar. ¡Hasta la próxima aventura!'
    };
  };

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

    var vuelo = budget.vuelo || null;

    // Hoteles
    var aloj = (budget.alojamiento || []).map(function(a) {
      return { nombre: a.nombre||'', checkin: a.checkin||f.fechaIn, checkout: a.checkout||f.fechaOut };
    });
    var primerHotel = aloj.length ? aloj[0].nombre : '';
    var ultimoHotel = aloj.length ? aloj[aloj.length-1].nombre : primerHotel;

    // Mapear fechas de transición
    var transMap = {};
    if (aloj.length > 1) {
      aloj.forEach(function(a, i) {
        if (i > 0) transMap[a.checkin] = { prev: aloj[i-1].nombre, next: a.nombre };
      });
    }

    // Hotel activo en una fecha
    function hotelEn(fecha) {
      var h = primerHotel;
      aloj.forEach(function(a) { if (fecha >= a.checkin && fecha < a.checkout) h = a.nombre; });
      return h;
    }

    // Detectar si hotel Disney o Universal
    function isDisneyHotel(nombre) { return /disney/i.test(nombre); }
    function isUniversalHotel(nombre) { return /universal|loews|portofino|hard.rock|sapphire/i.test(nombre); }

    // Tickets del presupuesto
    var tickets = parseTickets(budget);
    var disneyQueue   = tickets.disney.slice();   // cola de días Disney a consumir
    var universalQueue= tickets.universal.slice(); // cola de días Universal a consumir

    // Construir slots de parques con patrón 2+1
    var parkSlots = buildSlots(disneyQueue, universalQueue, transMap);
    var slotIdx   = 0;

    var dias = [];

    for (var i = 0; i < N; i++) {
      var fecha = addDays(f.fechaIn, i);

      var dia = {
        dia:        i + 1,
        numero:     i + 1,
        fecha:      fecha,
        fechaLabel: formatDateES(fecha),
        tipo:       'libre',
        titulo:     '',
        parque:     null,
        hotel:      hotelEn(fecha),
        agenda:     { manana:'', mediodia:'', tarde:'', noche:'' },
        nota:       '',
        visible:    true,
        actividades:[],
      };

      // DÍA 1: LLEGADA
      if (i === 0) {
        dia.tipo   = 'llegada';
        dia.titulo = '¡Bienvenidos! — Llegada y primer contacto con la magia';
        dia.agenda = AGENDA_LLEGADA(primerHotel, vuelo);
        dias.push(dia); continue;
      }

      // ÚLTIMO DÍA: SALIDA
      if (i === N - 1) {
        dia.tipo   = 'salida';
        dia.titulo = 'Hasta pronto — Vuelo de regreso a casa';
        dia.agenda = AGENDA_SALIDA(ultimoHotel, vuelo);
        dias.push(dia); continue;
      }

      // TRANSICIÓN DE HOTEL
      if (transMap[fecha]) {
        var tr = transMap[fecha];
        dia.tipo   = 'transicion';
        dia.titulo = 'Cambio de hotel — ' + tr.prev + ' → ' + tr.next;
        dia.parque = null;
        dia.agenda = AGENDA_TRANSICION(tr.prev, tr.next);
        dias.push(dia); continue;
      }

      // ASIGNAR DESDE SLOTS
      if (slotIdx < parkSlots.length) {
        var slot = parkSlots[slotIdx];
        slotIdx++;

        if (slot.tipo === 'descanso') {
          // Detectar tipo de descanso según hotel del día
          var hDia = hotelEn(fecha);
          var agDescanso = isUniversalHotel(hDia) ? AGENDA_DESCANSO_UNIVERSAL : AGENDA_DESCANSO_DISNEY;
          dia.tipo   = 'descanso';
          dia.titulo = 'Día de recarga — Descanso y tiempo libre';
          dia.parque = null;
          dia.agenda = agDescanso;

        } else if (slot.tipo === 'parque') {
          var pn = slot.parque;
          dia.tipo   = 'parque';
          dia.titulo = '🎢 Día en ' + pn;
          dia.parque = pn;
          dia.agenda = AGENDAS[pn] || {
            manana:   'Ingreso al parque aprovechando las colas más cortas de la mañana.',
            mediodia: 'Almuerzo en el parque.',
            tarde:    'Atracciones secundarias y shows de la tarde.',
            noche:    'Show o espectáculo de cierre del parque.'
          };
        }

        dias.push(dia); continue;
      }

      // Si se agotaron los slots pero quedan días: libre
      dia.tipo   = 'libre';
      dia.titulo = 'Día libre — A tu elección';
      dia.agenda = AGENDA_DESCANSO_DISNEY;
      dias.push(dia);
    }

    // ── Validación final ──────────────────────────────────
    return validate(dias);
  }

  // ── Validación: corregir incoherencias ─────────────────
  function validate(dias) {
    var lastPark = null;
    dias.forEach(function(dia, i) {

      // 1. Si tipo=parque debe tener parque válido
      if (dia.tipo === 'parque') {
        if (!dia.parque || (DISNEY.indexOf(dia.parque) === -1 && UNIVERSAL.indexOf(dia.parque) === -1)) {
          dia.parque = DISNEY[0]; // fallback: Magic Kingdom
          dia.titulo = '🎢 Día en ' + dia.parque;
          dia.agenda = AGENDAS[dia.parque];
        }
      }

      // 2. Si tipo != parque, no debe tener parque
      if (dia.tipo !== 'parque') {
        dia.parque = null;
      }

      // 3. No repetir parque consecutivo
      if (dia.tipo === 'parque') {
        if (dia.parque === lastPark) {
          var lista = isDisney(dia.parque) ? DISNEY : UNIVERSAL;
          var idx   = lista.indexOf(dia.parque);
          dia.parque = lista[(idx + 1) % lista.length];
          dia.titulo = '🎢 Día en ' + dia.parque;
          dia.agenda = AGENDAS[dia.parque] || dia.agenda;
        }
        lastPark = dia.parque;
      } else {
        lastPark = null;
      }
    });
    return dias;
  }

  // ── API pública ─────────────────────────────────────────
  return {
    generateItineraryDays: generateItineraryDays,
    parseTickets:          parseTickets,
    getFechas:             getFechas,
    formatDateES:          formatDateES,
    addDays:               addDays,
    validate:              validate,
    DISNEY_PARKS:          DISNEY,
    UNIVERSAL_PARKS:       UNIVERSAL,
    // aliases compat
    detectGrupos:          function(b){ return { disney: (parseTickets(b).disney.length>0), universal: (parseTickets(b).universal.length>0) }; },
    buildParquesOrdenados: function(b){ var t=parseTickets(b); return t.disney.concat(t.universal); },
  };

})();
