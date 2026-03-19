/**
 * TASS — itinerary-generator.js v5.0
 * Reglas estrictas + agendas reales + estructura editable
 */
var TASS_ItineraryGenerator = (function () {

  // ── Listas fijas de parques ─────────────────────────────
  var DISNEY_PARKS   = ['Magic Kingdom','EPCOT','Hollywood Studios','Animal Kingdom','Typhoon Lagoon'];
  var UNIVERSAL_PARKS= ['Universal Studios','Islands of Adventure','Volcano Bay','Epic Universe'];

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

  // ── Detectar qué grupos de parques hay ─────────────────
  function detectGrupos(budget) {
    var dest = ((budget.destino && budget.destino.nombre) || '').toLowerCase();
    var tks  = (budget.tickets  || []).map(function(t) {
      return ((t.parque||'')+' '+(t.complejo||'')+' '+(t.desc||'')).toLowerCase();
    }).join(' ');
    var all  = dest + ' ' + tks;
    var hasDisney   = /disney|magic.?kingdom|epcot|hollywood.studios|animal.kingdom|typhoon/i.test(all);
    var hasUniversal= /universal|islands.of.adventure|volcano.bay|epic.universe/i.test(all);
    if (budget.crucero) return { crucero: true,  disney: false, universal: false };
    if (!hasDisney && !hasUniversal) {
      if (/caribe|cancun|playa|beach|resort/i.test(dest))         return { playa: true };
      if (/europa|paris|madrid|roma|london|amsterdam/i.test(dest))return { ciudad: true };
      return { libre: true };
    }
    return { disney: hasDisney, universal: hasUniversal };
  }

  // ── Construir lista ordenada de parques ─────────────────
  // Primero Disney, luego Universal. Sin repetir consecutivos.
  function buildListaParques(budget, grupos) {
    // Intentar leer parques reales desde tickets
    var fromTickets = [];
    if (budget.ticketsActivos !== false) {
      (budget.tickets || []).forEach(function(t) {
        // Buscar nombre real en las listas fijas
        var src = ((t.parque||'')+' '+(t.desc||'')).toLowerCase();
        var found = null;
        DISNEY_PARKS.concat(UNIVERSAL_PARKS).forEach(function(p) {
          if (!found && src.indexOf(p.toLowerCase()) > -1) found = p;
        });
        if (found) {
          var cant = Math.max(1, parseInt(t.cant)||1);
          for (var k=0; k<cant; k++) fromTickets.push(found);
        }
      });
    }

    // Si encontramos parques reales en tickets, usarlos ordenados
    if (fromTickets.length > 0) {
      var disneyOnes = fromTickets.filter(function(p){ return DISNEY_PARKS.indexOf(p)>-1; });
      var univOnes   = fromTickets.filter(function(p){ return UNIVERSAL_PARKS.indexOf(p)>-1; });
      return disneyOnes.concat(univOnes);
    }

    // Fallback: usar listas fijas según grupos detectados
    var lista = [];
    if (grupos.disney)   lista = lista.concat(DISNEY_PARKS.slice(0,4)); // los 4 principales
    if (grupos.universal)lista = lista.concat(UNIVERSAL_PARKS.slice(0,2));
    return lista.length ? lista : DISNEY_PARKS.slice(0,4);
  }

  // ── Agendar parques sin repetir consecutivos ────────────
  function nextParque(lista, ultimoParque, idx) {
    if (!lista.length) return { parque: 'Parque temático', nextIdx: idx };
    var p = lista[idx % lista.length];
    // Si repite consecutivo, avanzar uno
    if (p === ultimoParque && lista.length > 1) {
      idx++;
      p = lista[idx % lista.length];
    }
    return { parque: p, nextIdx: idx + 1 };
  }

  // ── Agendas por parque ──────────────────────────────────
  var AGENDAS = {
    'Magic Kingdom': {
      manana:   'Ingresá antes de la apertura oficial y dirigite directo a Seven Dwarfs Mine Train y Space Mountain — las filas más cortas del día. Aprovechá el Early Park Admission si estás en un hotel Disney.',
      mediodia: 'Almuerzo en Be Our Guest Restaurant (reserva anticipada obligatoria) o en los puestos de comida temáticos de Main Street. Descansá del calor en alguna de las atracciones cubiertas.',
      tarde:    'Afternoon Parade por Main Street a las 15hs. Completá Pirates of the Caribbean, Haunted Mansion y Big Thunder Mountain. Usá Lightning Lane para las atracciones con más demanda.',
      noche:    'Happily Ever After: el espectáculo de fuegos artificiales sobre el Castillo de Cenicienta. Posicionarse en el centro de Main Street 30 minutos antes para los mejores lugares. El cierre más mágico del día.'
    },
    'EPCOT': {
      manana:   'Guardianes de la Galaxia: Cosmic Rewind al abrir — requiere Virtual Queue (conseguilo en la app al toque de las 7am). Luego Test Track y Mission: SPACE antes de las multitudes.',
      mediodia: 'World Showcase abre a las 11hs. Almuerzo temático en uno de los 11 pabellones internacionales: México (La Hacienda), Italia (Via Napoli) o Japón (Teppan Edo).',
      tarde:    'Frozen Ever After en el pabellón de Norway (fila corta después de las 14hs). Recorrida completa de World Showcase. Compras artesanales auténticas en los pabellones culturales.',
      noche:    'EPCOT Forever: el espectáculo nocturno sobre World Showcase Lagoon con proyecciones, fuegos artificiales y música icónica. Desde la orilla del lago o desde el pabellón de Canadá para mejor vista.'
    },
    'Hollywood Studios': {
      manana:   'Rise of the Resistance al abrir — llegá 30 minutos antes del horario oficial. Es la atracción más inmersiva del parque y las filas superan las 2 horas pasado el mediodía. Imperdible.',
      mediodia: 'Almuerzo en Sci-Fi Dine-In Theater (reserva recomendada) o en los puestos de Galaxy\'s Edge. Millenium Falcon: Smugglers Run después del almuerzo cuando la espera baja.',
      tarde:    'Slinky Dog Dash en Toy Story Land. Show de Indiana Jones a las 16hs. Recorrida por Star Wars Galaxy\'s Edge al atardecer cuando la atmósfera es ideal para fotos.',
      noche:    'Fantasmic!: el show nocturno con proyecciones de agua, personajes en vivo y fuegos artificiales. Llegá 45 minutos antes para conseguir buen lugar. El broche perfecto para el día.'
    },
    'Animal Kingdom': {
      manana:   'Flight of Passage en Pandora al abrir — los avatares vuelan mejor con la mente descansada y las filas más cortas. Kilimanjaro Safaris temprano: los animales están activos y la luz es perfecta para fotos.',
      mediodia: 'Almuerzo en Satuli Canteen (cocina inspirada en Pandora) o en Flame Tree Barbecue con vistas al parque. Las tardes con calor intenso son ideales para las atracciones cubiertas.',
      tarde:    'Kali River Rapids si el calor lo amerita (mojarse garantizado). Espectáculo Finding Nemo: The Big Blue... and Beyond! Zona de Rafiki\'s Planet Watch accesible en tren.',
      noche:    'Tree of Life Awakenings: proyecciones nocturnas sobre el Árbol de la Vida que duran solo minutos pero son absolutamente mágicas. El parque cierra antes que los demás — llegá temprano para aprovechar al máximo.'
    },
    'Typhoon Lagoon': {
      manana:   'Llegá a la apertura (10am) para reservar los mejores chapuzones en Wave Pool y Summit Plummet. Las primeras 2 horas tienen esperas mínimas en los toboganes principales.',
      mediodia: 'Almuerzo en Leaning Palms o puestos de comida del parque. Reactivá el protector solar FPS 50+. La zona de snorkeling con tiburones y rayas es única — no te la pierdas.',
      tarde:    'Río lento Castaway Creek: perfecta manera de descansar activamente. Toboganes en grupo para la familia. Las tardes suelen estar más tranquilas.',
      noche:    'El parque acuático cierra temprano (generalmente a las 17hs). Regreso al hotel, ducha larga y cena liviana — un día de agua es físicamente intenso. Ideal para descansar antes del próximo parque.'
    },
    'Universal Studios': {
      manana:   'Harry Potter and the Escape from Gringotts apenas abra el parque. Inmediatamente después: Hagrid\'s Magical Creatures Motorbike Adventure antes de que se forme la fila de 90 minutos.',
      mediodia: 'Almuerzo en Three Broomsticks en el área de Harry Potter (Butterbeer helado imperdible) o en el área de Los Simpsons en Krusty Burger.',
      tarde:    'Hollywood Rip Ride Rockit, Transformers 3D y Minion Mayhem. Zona interactiva de Springfield con atracciones para toda la familia. Tiendas de souvenirs únicos.',
      noche:    'Universal\'s Cinematic Spectacular: proyecciones sobre el lago central con escenas de las películas más icónicas del cine. El cierre más emotivo del parque.'
    },
    'Islands of Adventure': {
      manana:   'Velocicoaster al abrir: la montaña rusa más emocionante de Florida con 4 inversiones. Luego Hagrid\'s Magical Creatures si no lo hiciste en Universal Studios. Temprano es clave.',
      mediodia: 'Almuerzo en Hogsmeade: Three Broomsticks o Hog\'s Head Pub. Butterbeer caliente en invierno, frío en verano. Hogwarts Express conecta los dos parques (requiere boleto Park to Park).',
      tarde:    'The Incredible Hulk Coaster y Spider-Man 4K. Doctor Doom\'s Fearfall para los más audaces. Zona de Seuss Landing para los más pequeños del grupo.',
      noche:    'Hogsmeade iluminado al caer la noche: el Castillo de Hogwarts con iluminación nocturna es una de las experiencias visuales más impactantes de todo Orlando.'
    },
    'Volcano Bay': {
      manana:   'Llegá con el sistema TapuTapu listo: es la pulsera que reserva los toboganes sin hacer fila física. Krakatau Aqua Coaster al abrir para experiencia única en tobogán de agua.',
      mediodia: 'Almuerzo en Kohola Reef Restaurant. Zona de piscina wave para descansar entre actividades. Reactivá protector solar cada 2 horas.',
      tarde:    'Toboganes en grupo: Ko\'okiri Body Plunge (caída casi vertical) y Honu ika Moana para la familia. La zona de río lento es perfecta para el final de tarde.',
      noche:    'El parque cierra temprano (17-18hs). Regreso al hotel, recuperación y preparación para los parques temáticos del día siguiente.'
    },
    'Epic Universe': {
      manana:   'Ministry of Magic y el nuevo universo de Harry Potter al abrir: este parque 2025 tiene demanda altísima. How to Train Your Dragon World y Super Nintendo World también tempranas.',
      mediodia: 'Cada mundo temático tiene restaurantes únicos e inmersivos. La experiencia gastronómica es parte del parque — no te conformes con el primer puesto que veas.',
      tarde:    'Universal Monster Land y Celestial Park para fotos icónicas. Las tardes en Epic Universe son más tranquilas que los demás parques — aprovechá para recorrer sin apuro.',
      noche:    'El espectáculo nocturno de Epic Universe tiene escala mayor que cualquier otro parque en Florida. Una producción que justifica el viaje por sí sola.'
    },
  };

  var AGENDA_DESCANSO = {
    manana:   'Mañana sin apuros y sin boletos de parque. Desayuno relajado en el resort disfrutando las instalaciones. Revisá las fotos del viaje y planificá los días que vienen.',
    mediodia: 'Día libre a total elección: piscina del resort, Disney Springs o los alrededores del hotel. Sin filas, sin reloj — este día es solo para disfrutar sin presión.',
    tarde:    'Piscina o spa del resort. Los resorts Disney y Universal tienen áreas acuáticas increíbles que pocas veces se aprovechan. Es el momento ideal.',
    noche:    'Cena en un restaurante diferente — explorá opciones fuera de los parques. Disney Springs, CityWalk o las propuestas del hotel son excelentes alternativas.'
  };

  var AGENDA_TRANSICION = function(hotelAnterior, hotelNuevo) {
    var prev = hotelAnterior || 'el hotel anterior';
    var next = hotelNuevo   || 'el nuevo hotel';
    return {
      manana:   'Check-out de ' + prev + '. Equipaje listo y facturado antes de las 11hs. Desayuno final disfrutando las instalaciones que no volvés a ver.',
      mediodia: 'Tiempo libre de transición: almuerzo en Disney Springs o CityWalk — el punto intermedio perfecto entre los dos resorts. Sin apuros.',
      tarde:    'Check-in en ' + next + '. Primera recorrida por las nuevas instalaciones: piscina, restaurantes, lobby. Orientate para sacarle el máximo en los días siguientes.',
      noche:    'Cena en el nuevo resort. Cada hotel tiene su propuesta gastronómica única — una buena oportunidad para descubrir algo nuevo antes de los parques de Universal.'
    };
  };

  var AGENDA_LLEGADA = function(hotel, vuelo) {
    var h = hotel || 'el resort';
    var v = vuelo ? 'Vuelo ' + (vuelo.aerolinea||'') + ' desde ' + (vuelo.origen||'origen') + '. ' : '';
    return {
      manana:   v + 'Preparación del equipaje y documentación de viaje: pasaportes, vouchers, confirmaciones de hotel y reservas de restaurantes. Todo impreso y digitalizado.',
      mediodia: 'Llegada y traslado a ' + h + '. Check-in y primera recorrida por las instalaciones del resort. El primer contacto con la magia empieza aquí.',
      tarde:    'Tiempo libre para descansar del viaje, conocer la zona y hacer las primeras compras esenciales. Visita al Disney Springs o al área comercial del resort.',
      noche:    'Cena de bienvenida en el resort — el mejor comienzo posible para una aventura que va a quedar grabada para siempre. ¡Brindis en familia!'
    };
  };

  var AGENDA_SALIDA = function(hotel, vuelo) {
    var h = hotel || 'el hotel';
    var v = vuelo ? 'Vuelo ' + (vuelo.aerolinea||'') + ' a las ' + (vuelo.fechaVuelta||'horario acordado') + '. ' : '';
    return {
      manana:   v + 'Check-out de ' + h + '. Desayuno final y últimas fotos en el resort. El equipaje debe estar listo antes de las 11hs.',
      mediodia: 'Traslado al aeropuerto con tiempo suficiente. Check-in del vuelo, trámites de migraciones y últimas compras en el duty free.',
      tarde:    'Embarque y vuelo de regreso. Momento perfecto para revisar todas las fotos del viaje y empezar a recordar cada momento vivido.',
      noche:    'Llegada a casa. El viaje termina pero la magia queda para siempre. ¡Ya es hora de empezar a planificar el próximo!'
    };
  };

  // ── Convertir agenda a actividades (compatibilidad con renderer actual) ──
  function agendaToActividades(agenda) {
    var franjas = [
      { key:'manana',   hora:'08:30', emoji:'🌅', color:'color-dorado'  },
      { key:'mediodia', hora:'13:00', emoji:'🍽️', color:'color-dorado' },
      { key:'tarde',    hora:'15:00', emoji:'☀️', color:'color-azul'   },
      { key:'noche',    hora:'19:30', emoji:'🌙', color:'color-lila'   },
    ];
    return franjas.map(function(f) {
      var txt = (agenda && agenda[f.key]) || '';
      return { hora: f.hora, emoji: f.emoji, color: f.color, desc: txt, nota: '' };
    }).filter(function(a){ return a.desc; });
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

    var grupos  = detectGrupos(budget);
    var vuelo   = budget.vuelo || null;

    // Hoteles y transiciones
    var aloj = (budget.alojamiento || []).map(function(a) {
      return { nombre: a.nombre||'', checkin: a.checkin||f.fechaIn, checkout: a.checkout||f.fechaOut };
    });
    var primerHotel = aloj.length ? aloj[0].nombre : '';
    var ultimoHotel = aloj.length ? aloj[aloj.length-1].nombre : primerHotel;

    // Mapear fechas de transición
    var transMap = {}; // fecha → { hotelAnterior, hotelNuevo }
    if (aloj.length > 1) {
      aloj.forEach(function(a, i) {
        if (i > 0) {
          transMap[a.checkin] = { hotelNuevo: a, hotelAnterior: aloj[i-1] };
        }
      });
    }

    // Hotel activo en una fecha
    function hotelEn(fecha) {
      var activo = primerHotel;
      aloj.forEach(function(a) {
        if (fecha >= a.checkin && fecha < a.checkout) activo = a.nombre;
      });
      return activo;
    }

    // Lista de parques
    var listaParques = buildListaParques(budget, grupos);
    var descansoEn   = opts.descansoEn || 2;

    var dias       = [];
    var pIdx       = 0;
    var dParque    = 0;
    var ultimoPark = null;

    for (var i = 0; i < N; i++) {
      var fecha = addDays(f.fechaIn, i);
      var dia = {
        dia:        i + 1,
        fecha:      fecha,
        fechaLabel: formatDateES(fecha),
        tipo:       'parque',
        titulo:     '',
        parque:     null,
        hotel:      hotelEn(fecha),
        agenda:     { manana:'', mediodia:'', tarde:'', noche:'' },
        nota:       '',
        // compat con renderer actual
        numero:      i + 1,
        visible:     true,
        actividades: [],
      };

      // DÍA 1: LLEGADA
      if (i === 0) {
        dia.tipo   = 'llegada';
        dia.titulo = '¡Bienvenidos! Llegada y primer contacto con la magia';
        dia.agenda = AGENDA_LLEGADA(primerHotel, vuelo);
        dia.actividades = agendaToActividades(dia.agenda);
        dias.push(dia); continue;
      }

      // ÚLTIMO DÍA: SALIDA
      if (i === N - 1) {
        dia.tipo   = 'salida';
        dia.titulo = 'Hasta pronto — Vuelo de regreso a casa';
        dia.agenda = AGENDA_SALIDA(ultimoHotel, vuelo);
        dia.actividades = agendaToActividades(dia.agenda);
        dias.push(dia); continue;
      }

      // TRANSICIÓN DE HOTEL
      if (transMap[fecha]) {
        var tr = transMap[fecha];
        dia.tipo   = 'transicion';
        dia.titulo = 'Cambio de hotel — ' + (tr.hotelAnterior.nombre||'') + ' → ' + (tr.hotelNuevo.nombre||'');
        dia.agenda = AGENDA_TRANSICION(tr.hotelAnterior.nombre, tr.hotelNuevo.nombre);
        dia.actividades = agendaToActividades(dia.agenda);
        dias.push(dia); continue;
      }

      // MODOS ESPECIALES
      if (grupos.playa) {
        dia.tipo   = 'playa';
        dia.titulo = '🏖️ Día de playa y relax total';
        dia.agenda = {
          manana:   'Primera sesión de playa desde las 9am. La luz de la mañana es perfecta para fotos y el sol aún no está en su pico máximo. Instalarse en la mejor zona de la playa.',
          mediodia: 'Almuerzo en el beach bar del resort o en un restaurante local recomendado. Pausa bajo la sombra durante las horas de mayor intensidad solar.',
          tarde:    'Deportes acuáticos: kayak, snorkeling, parasailing o simplemente disfrutar el mar. Las tardes en el Caribe tienen una luz y temperatura únicas.',
          noche:    'Atardecer en la playa con cócteles de temporada. Cena en restaurante con vista al mar — el broche de oro para un día en el paraíso.'
        };
        dia.actividades = agendaToActividades(dia.agenda);
        dias.push(dia); continue;
      }

      if (grupos.ciudad) {
        dia.tipo   = 'ciudad';
        dia.titulo = '🏛️ Exploración de ' + ((budget.destino && budget.destino.nombre)||'la ciudad');
        dia.agenda = {
          manana:   'Visita al atractivo principal de la ciudad: museo, sitio histórico o barrio emblemático según los intereses del grupo. Guía local recomendado.',
          mediodia: 'Almuerzo en restaurante local típico — la mejor manera de conocer la gastronomía auténtica. El mercado central suele ser una opción excelente.',
          tarde:    'Recorrida por los barrios históricos y puntos fotográficos icónicos. Shopping en tiendas locales: artesanías, productos típicos y recuerdos únicos.',
          noche:    'Cena en restaurante recomendado con la cocina representativa de la región. Una copa en una terraza con vistas para cerrar el día.'
        };
        dia.actividades = agendaToActividades(dia.agenda);
        dias.push(dia); continue;
      }

      if (grupos.crucero) {
        var linea = (budget.crucero && budget.crucero.linea) || 'el crucero';
        var esEmbarque   = (i === 1);
        var esDesembarque = (i === N - 2);
        dia.tipo   = 'crucero';
        dia.titulo = esEmbarque ? '🚢 Embarque en ' + linea
                   : esDesembarque ? '🏠 Desembarque — Fin de la aventura'
                   : '⚓ Día ' + i + ' — Puerto y exploración';
        dia.agenda = {
          manana:   esEmbarque ? 'Traslado al puerto de embarque con toda la documentación. Check-in del crucero y depósito del equipaje antes del mediodía.'
                  : esDesembarque ? 'Último desayuno a bordo. Equipaje en el pasillo antes de las 8am para el desembarque organizado.'
                  : 'Desembarque para excursión terrestre o exploración libre del puerto. Las excursiones del crucero garantizan el regreso al barco.',
          mediodia: esEmbarque ? 'Embarque y primera exploración del barco: cubiertas, restaurantes, piscinas. El camarote disponible desde las 13:30hs.'
                  : esDesembarque ? 'Desembarque y trámites en el puerto. Traslado al aeropuerto o al hotel según el itinerario de regreso.'
                  : 'Almuerzo en tierra o en el buffet del barco. Cada puerto tiene especialidades gastronómicas únicas que vale la pena probar.',
          tarde:    esEmbarque ? 'Drill de seguridad obligatorio y zarpe. Primera experiencia de alta mar con el barco en movimiento.'
                  : esDesembarque ? 'Tiempo libre post-crucero según los vuelos. Últimas compras en el puerto si hay tiempo disponible.'
                  : 'Regreso al barco y entretenimiento a bordo: shows, casino, actividades para todas las edades. Atardecer desde cubierta.',
          noche:    esEmbarque ? 'Cena de bienvenida en el comedor principal con el Capitán. Primera noche en alta mar.'
                  : esDesembarque ? 'Vuelo o hotel. El mar, los puertos y las cenas: recuerdos que duran toda la vida.'
                  : 'Cena en el comedor temático del barco. Show nocturno en el teatro principal — cada noche trae una producción diferente.'
        };
        dia.actividades = agendaToActividades(dia.agenda);
        dias.push(dia); continue;
      }

      // PARQUES (Disney / Universal / Combo)
      if (grupos.disney || grupos.universal) {

        // Descanso cada N días de parque
        if (dParque > 0 && dParque % descansoEn === 0) {
          dia.tipo   = 'descanso';
          dia.titulo = 'Día de recarga — Descanso y tiempo libre';
          dia.agenda = AGENDA_DESCANSO;
          dia.actividades = agendaToActividades(dia.agenda);
          dParque = 0;
          dias.push(dia); continue;
        }

        // Asignar parque sin repetir consecutivo
        var result = nextParque(listaParques, ultimoPark, pIdx);
        var pn     = result.parque;
        pIdx       = result.nextIdx;
        dParque++;
        ultimoPark = pn;

        var agendaPark = AGENDAS[pn] || {
          manana:   'Ingresá al parque a primera hora para aprovechar las filas más cortas. Atracciones principales con Lightning Lane disponible.',
          mediodia: 'Pausa para el almuerzo dentro del parque. Descansá del calor en alguna atracción cubierta.',
          tarde:    'Segunda ronda de atracciones, shows y experiencias interactivas. Compras en las tiendas temáticas.',
          noche:    'Show o espectáculo de cierre del parque. Terminá el día con la magia encendida.'
        };

        dia.tipo   = 'parque';
        dia.titulo = '🎢 Día en ' + pn;
        dia.parque = pn;
        dia.agenda = agendaPark;
        dia.actividades = agendaToActividades(dia.agenda);
        dias.push(dia); continue;
      }

      // LIBRE (fallback)
      dia.tipo   = 'libre';
      dia.titulo = 'Día ' + (i+1) + ' — Tiempo libre';
      dia.agenda = AGENDA_DESCANSO;
      dia.actividades = agendaToActividades(dia.agenda);
      dias.push(dia);
    }

    return dias;
  }

  // ── nextParque sin repetir consecutivo ─────────────────
  function nextParque(lista, ultimo, idx) {
    if (!lista.length) return { parque: 'Parque temático', nextIdx: idx + 1 };
    var p = lista[idx % lista.length];
    if (p === ultimo && lista.length > 1) {
      idx++;
      p = lista[idx % lista.length];
    }
    return { parque: p, nextIdx: idx + 1 };
  }

  // ── API pública ─────────────────────────────────────────
  return {
    generateItineraryDays: generateItineraryDays,
    detectGrupos:          detectGrupos,
    buildListaParques:     buildListaParques,
    buildParquesOrdenados: buildListaParques, // alias compat
    getFechas:             getFechas,
    formatDateES:          formatDateES,
    addDays:               addDays,
    DISNEY_PARKS:          DISNEY_PARKS,
    UNIVERSAL_PARKS:       UNIVERSAL_PARKS,
  };

})();
