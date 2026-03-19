/**
 * TASS — Travel Agent System Suite
 * agency-config.js
 * Configuración central de la agencia. Modificar este archivo
 * para adaptar el sistema a cualquier agencia sin tocar la lógica.
 */

var AGENCY_CONFIG = {

  // ── Identidad ──────────────────────────────────────────
  nombre:    'MM Destinos Mágicos',
  sigla:     'MM',
  slogan:    'Agente Certificada · Disney & Universal',
  email:     'contacto@mmdestinos.com',
  whatsapp:  '5492235366351',
  instagram: '@mm_destinosmagicos',
  telefono:  '+54 9 2235 36-6351',
  website:   'https://mmdestinos.com',
  logo:      null,   // URL o base64. null = mostrar sigla como fallback

  // ── Colores de marca ───────────────────────────────────
  colores: {
    primario:   '#C8102E',
    secundario: '#1B2A4A',
    acento:     '#C9A84C',
    fondo:      '#FAF7F2',
  },

  // ── Segmentos de viaje disponibles ────────────────────
  segmentos: [
    { id: 'disney',    label: 'Disney / Orlando',  emoji: '🏰' },
    { id: 'universal', label: 'Universal',          emoji: '🎬' },
    { id: 'caribe',    label: 'Caribe / Playa',     emoji: '🏖️' },
    { id: 'crucero',   label: 'Cruceros',            emoji: '🚢' },
    { id: 'europa',    label: 'Europa',              emoji: '🗺️' },
    { id: 'otro',      label: 'Otro destino',        emoji: '✈️' },
  ],

  // ── Páginas del sistema ────────────────────────────────
  paginas: {
    datos:        'datos.html',
    presupuesto:  'presupuesto.html',
    itinerario:   'itinerario.html',
  },

  // ── Monedas disponibles ────────────────────────────────
  monedas: ['USD', 'ARS', 'EUR'],
  monedaDefault: 'USD',

  // ── Validez default del presupuesto (días) ─────────────
  validezPresupuestoDias: 7,

  // ── Parques disponibles en el generador de itinerario ──
  parques: [
    { id: 'magic-kingdom',    label: 'Magic Kingdom',      emoji: '🏰', grupo: 'disney' },
    { id: 'epcot',            label: 'EPCOT',              emoji: '🌍', grupo: 'disney' },
    { id: 'hollywood-studios',label: 'Hollywood Studios',  emoji: '🎬', grupo: 'disney' },
    { id: 'animal-kingdom',   label: 'Animal Kingdom',     emoji: '🦁', grupo: 'disney' },
    { id: 'universal-studios',label: 'Universal Studios',  emoji: '🎭', grupo: 'universal' },
    { id: 'islands-adventure',label: 'Islands of Adventure',emoji: '⚡', grupo: 'universal' },
    { id: 'epic-universe',    label: 'Epic Universe',      emoji: '✨', grupo: 'universal' },
    { id: 'blizzard-beach',   label: 'Blizzard Beach',     emoji: '❄️', grupo: 'disney-agua' },
    { id: 'disney-springs',   label: 'Disney Springs',     emoji: '🛍️', grupo: 'disney-extra' },
  ],

  // ── Tipos de ticket por complejo ──────────────────────
  ticketTipos: {
    'disney-wdw': {
      label: '🏰 Walt Disney World (Orlando)',
      tipos: [
        { val: 'Disney WDW – Base',        lbl: 'Ticket Base (1 parque/día)' },
        { val: 'Disney WDW – Hopper',      lbl: 'Park Hopper (múltiples parques/día)' },
        { val: 'Disney WDW – Hopper Plus', lbl: 'Park Hopper Plus (parques + acuáticos)' },
      ]
    },
    'disney-dl': {
      label: '🏰 Disneyland (California)',
      tipos: [
        { val: 'Disneyland – Base',   lbl: 'Ticket Base (1 parque/día)' },
        { val: 'Disneyland – Hopper', lbl: 'Park Hopper (ambos parques/día)' },
      ]
    },
    'universal-orlando': {
      label: '🎬 Universal Orlando',
      tipos: [
        { val: 'Universal – Base',         lbl: 'Ticket Base (1 parque)' },
        { val: 'Universal – Park to Park', lbl: 'Park to Park (2 parques)' },
        { val: 'Universal – Epic Universe',lbl: 'Epic Universe (solo)' },
        { val: 'Universal – 3 Park',       lbl: '3-Park (Park to Park + Epic Universe)' },
      ]
    },
    'seaworld': {
      label: '🐋 SeaWorld / Busch Gardens',
      tipos: [
        { val: 'SeaWorld Orlando',    lbl: 'SeaWorld Orlando' },
        { val: 'Busch Gardens Tampa', lbl: 'Busch Gardens Tampa' },
        { val: 'Aquatica Orlando',    lbl: 'Aquatica Orlando' },
        { val: 'Discovery Cove',      lbl: 'Discovery Cove (todo incluido)' },
      ]
    },
    'otros': {
      label: '✏️ Otros / Personalizado',
      tipos: [
        { val: 'Kennedy Space Center', lbl: 'Kennedy Space Center' },
        { val: 'Otro',                 lbl: 'Otro (completar descripción)' },
      ]
    }
  },
};
