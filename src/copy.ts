// All visitor-facing copy, English and Spanish. `es` must match `en`'s shape (typed).
import type { Lang } from './shop.ts';

export const SERVICE_KEYS = ['diagnostics', 'engine', 'brakes', 'maintenance', 'electrical', 'other'] as const;
export type ServiceKey = typeof SERVICE_KEYS[number];

interface Chapter {
  short: string;
  part: string;
  focus: string;
  hook: readonly [string, string];
  text: string;
  cta: string;
  readout: readonly string[];
}

const en = {
  langLabel: 'EN',
  otherLang: 'es' as Lang,
  otherLangLabel: 'ES',
  switchLabel: 'Ver el sitio en español',
  skip: 'Skip to content',
  nav: { services: 'Services', tour: 'Why hire us', location: 'Find us', book: 'Book a service', menuOpen: 'Open menu', menuClose: 'Close menu', home: 'M&D Multi-Service home', main: 'Main navigation' },
  status: {
    open: 'Open now', closed: 'Closed now',
    until: (time: string) => `Until ${time}`,
    opens: (day: string, time: string, today: boolean) => today ? `Opens today ${time}` : `Opens ${day} ${time}`,
    days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
  },
  hero: {
    kicker: 'M&D AUTO MECHANIC SERVICE · EST. BY DAVID & EDITH',
    title: ['Boyle Heights’', 'Hardest-Working', 'Auto Shop'],
    intro: ['FAMILY-OWNED & OPERATED.', 'ALL MAKES. ALL MODELS.', 'DAVID & EDITH.'],
    cta: 'Let’s get you road-ready',
    scroll: 'SCROLL TO LOOK CLOSER',
    tiltOn: 'TILT ENABLED', tiltOff: 'ENABLE TILT',
    badgeAlt: 'M&D Multi-Service forged steel badge',
    badgeLabel: 'M&D badge with an independently rotating steel gear',
    watermark: 'M&D',
    name: 'Why “M&D”? It honors Malachi, David & Edith’s son, and David.',
  },
  services: {
    topline: ['01 / WHAT WE DO', 'ALL MAKES. ALL MODELS.'],
    title: ['Built for', 'the everyday.'],
    text: 'Daily-driver Toyotas and Hondas, heavy-duty trucks, European rides like Mercedes-Benz. Pick what you need and we’ll carry it into your booking.',
    pick: 'Choose a service',
    request: 'Book this service',
    items: {
      diagnostics: { label: 'Diagnostics & check-engine', text: 'Warning light, strange sound, or something that just feels off. We find the real cause before anything gets replaced.' },
      engine: { label: 'Engine repair', text: 'Leaks, misfires, timing, cooling, and the work that keeps an engine running strong for the long haul.' },
      brakes: { label: 'Brakes & suspension', text: 'Squeals, pulling, a soft pedal, or a rough ride. Tell us what you feel behind the wheel.' },
      maintenance: { label: 'Oil changes & maintenance', text: 'Regular attention goes a long way. Keep your everyday driver ready for the next mile.' },
      electrical: { label: 'A/C & electrical', text: 'Trouble staying cool or getting started? Bring us the symptoms and we’ll trace them down.' },
      other: { label: 'Something else', text: 'Not sure what it is? Describe it in your own words and David will take it from there.' },
    } satisfies Record<ServiceKey, { label: string; text: string }>,
  },
  tour: {
    topline: 'WHY HIRE US',
    section: 'Why hire us: four views under the hood',
    scrollNote: 'SCROLL TO TURN THE ENGINE',
    prev: 'Previous engine view', next: 'Next engine view', continue: 'Continue to shop location',
    chaptersLabel: 'Engine tour chapters',
    view: (n: number, name: string) => `View ${n}: ${name}`,
    modesLabel: 'Engine shading mode',
    modes: { studio: 'STUDIO PBR', cad: 'CAD WIREFRAME', spec: 'SPEC LIGHTING' },
    inspectOn: 'TAP TO INSPECT 3D', inspectOff: 'DONE INSPECTING', inspectHint: 'Drag to turn the engine',
    loading: 'Decompressing Forged Steel & Cast Aluminum Assets…',
    stages: { idle: 'Queued', download: 'Streaming geometry', decode: 'Draco decode', curvature: 'Curvature & cavity pass', tangents: 'Tangent frames', maps: 'Procedural surface maps', ready: 'Mounting studio', error: 'Load failed' },
    fallback: 'Your engine. In good hands.',
    canvasLabel: 'Interactive four-zone engine tour',
    restoring: 'RESTORING 3D…',
    sim: 'SIM',
    chapters: [
      { short: 'Diagnostics', part: 'CYLINDER HEAD & VALVE COVER', focus: 'TOP END', hook: ['No Guessing.', 'Master-Level Diagnostics.'], text: 'Anyone can swap parts. David knows the ins and outs of your engine down to the millimeter, fixing the real problem the first time.', cta: 'Tell us what’s wrong', readout: ['COMPRESSION: 195 PSI', 'TOLERANCE: ±0.002mm'] },
      { short: 'All makes', part: 'COMPOSITE INTAKE MANIFOLD', focus: 'INTAKE RUNNERS', hook: ['All Makes. All Models.', 'Zero Shortcuts.'], text: 'From daily-driver Toyotas and Hondas to heavy-duty trucks and European rides like Mercedes-Benz, we treat every intake, sensor, and seal like our own family is driving it.', cta: 'Talk to your mechanic', readout: ['4-RUNNER INTAKE', 'SEALS: INSPECTED'] },
      { short: 'Honest work', part: 'VVT TIMING ASSEMBLY', focus: 'VVT ACTUATOR', hook: ['Real Hard Work.', 'No Dealership Rip-Offs.'], text: 'You don’t pay for a luxury waiting room here. You pay for honest, blue-collar mechanical perfection from a family-owned shop.', cta: 'Get an honest quote', readout: ['VVT TIMING HOUSING', 'TARGET LOCKED'] },
      { short: 'Family shop', part: 'FLEXPLATE & RING GEAR', focus: 'FLYWHEEL', hook: ['Built on Family & Word-of-Mouth', '(4.6★ on Google).'], text: 'David & Edith built M&D Multi-Service on pure grit and trust. When your car leaves our bay, it leaves solid, safe, and road-ready.', cta: 'Meet your mechanics', readout: ['CRANKSHAFT TORQUE SPEC: VERIFIED'] },
    ] satisfies Chapter[] as Chapter[],
  },
  proof: {
    topline: ['03 / RIGHT HERE IN BOYLE HEIGHTS', 'WORD OF MOUTH'],
    title: ['Good people.', 'Great work.'],
    text: 'A family shop with a neighborhood heart. Meet David & Edith at M&D Multi-Service.',
    ratingLabel: 'Google rating',
    reviews: (count: string) => `${count} verified Google reviews`,
    readReviews: 'Read our reviews on Google',
    directions: 'Get directions',
    hoursTitle: 'SHOP HOURS · LOS ANGELES TIME',
    hours: [['Monday – Friday', '8:30 AM – 6:00 PM'], ['Saturday', '8:00 AM – 4:00 PM'], ['Sunday', 'Closed']] as [string, string][],
    mapTitle: 'M&D Multi-Service location at 419 N Boyle Ave',
    route: 'ROUTE CARD',
    routeText: 'Off N Boyle Ave, a short drive from the 5, 10, 60 & 101.',
  },
  booking: {
    topline: ['04 / SERVICE BOOKING TERMINAL', 'DAVID & EDITH'],
    title: ['Let’s get', 'to work.'],
    text: 'Tell David & Edith what your vehicle needs. One tap opens your messaging app with everything filled in.',
    name: 'Your name', namePlaceholder: 'Your name',
    year: 'Year', make: 'Make', model: 'Model',
    service: 'Service',
    message: 'What are you noticing?', messagePlaceholder: 'Noise, warning light, smell, when it happens…',
    preview: 'MESSAGE PREVIEW',
    sms: 'Text the shop', email: 'Email the shop', vcard: 'Save contact (.vcf)',
    call: 'Or call',
    note: 'Your messaging app opens with your request. Send it there to reach the shop. Appointments are confirmed when we reply.',
    invalid: 'Add your name, vehicle year, make, and model first.',
    required: 'required',
  },
  footer: { tagline: 'FAMILY-OWNED. BOYLE HEIGHTS, LOS ANGELES.', email: 'Email David & Edith' },
};

export type Copy = typeof en;

const es: Copy = {
  langLabel: 'ES',
  otherLang: 'en',
  otherLangLabel: 'EN',
  switchLabel: 'View the site in English',
  skip: 'Saltar al contenido',
  nav: { services: 'Servicios', tour: 'Por qué elegirnos', location: 'Ubicación', book: 'Agendar servicio', menuOpen: 'Abrir menú', menuClose: 'Cerrar menú', home: 'Inicio de M&D Multi-Service', main: 'Navegación principal' },
  status: {
    open: 'Abierto ahora', closed: 'Cerrado ahora',
    until: (time: string) => `Hasta las ${time}`,
    opens: (day: string, time: string, today: boolean) => today ? `Abre hoy a las ${time}` : `Abre el ${day} a las ${time}`,
    days: ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'],
  },
  hero: {
    kicker: 'M&D AUTO MECHANIC SERVICE · DE DAVID Y EDITH',
    title: ['El taller', 'más trabajador', 'de Boyle Heights'],
    intro: ['NEGOCIO FAMILIAR.', 'TODAS LAS MARCAS Y MODELOS.', 'DAVID Y EDITH.'],
    cta: 'Ponga su carro en buenas manos',
    scroll: 'DESLICE PARA VER DE CERCA',
    tiltOn: 'INCLINACIÓN ACTIVA', tiltOff: 'ACTIVAR INCLINACIÓN',
    badgeAlt: 'Emblema de acero forjado de M&D Multi-Service',
    badgeLabel: 'Emblema de M&D con un engrane de acero que gira por separado',
    watermark: 'M&D',
    name: '¿Por qué “M&D”? Por Malachi, el hijo de David y Edith, y por David.',
  },
  services: {
    topline: ['01 / LO QUE HACEMOS', 'TODAS LAS MARCAS. TODOS LOS MODELOS.'],
    title: ['Hecho para', 'el día a día.'],
    text: 'Toyotas y Hondas de diario, camionetas de trabajo pesado, autos europeos como Mercedes-Benz. Elija lo que necesita y lo pasamos a su solicitud.',
    pick: 'Elija un servicio',
    request: 'Agendar este servicio',
    items: {
      diagnostics: { label: 'Diagnóstico y luz de check engine', text: 'Una luz de advertencia, un ruido raro o algo que no se siente bien. Encontramos la causa real antes de cambiar cualquier pieza.' },
      engine: { label: 'Reparación de motor', text: 'Fugas, fallas de encendido, sincronización, enfriamiento y el trabajo que mantiene su motor fuerte por mucho tiempo.' },
      brakes: { label: 'Frenos y suspensión', text: 'Rechinidos, jaloneos, un pedal suave o un manejo brusco. Díganos lo que siente al volante.' },
      maintenance: { label: 'Cambios de aceite y mantenimiento', text: 'Un poco de atención regular rinde mucho. Mantenga su carro de diario listo para la próxima milla.' },
      electrical: { label: 'A/C y sistema eléctrico', text: '¿No enfría o le cuesta arrancar? Tráiganos los síntomas y los rastreamos hasta el origen.' },
      other: { label: 'Otra cosa', text: '¿No sabe qué es? Descríbalo con sus propias palabras y David se encarga del resto.' },
    },
  },
  tour: {
    topline: 'POR QUÉ ELEGIRNOS',
    section: 'Por qué elegirnos: cuatro vistas bajo el cofre',
    scrollNote: 'DESLICE PARA GIRAR EL MOTOR',
    prev: 'Vista anterior del motor', next: 'Siguiente vista del motor', continue: 'Continuar a la ubicación del taller',
    chaptersLabel: 'Capítulos del recorrido del motor',
    view: (n: number, name: string) => `Vista ${n}: ${name}`,
    modesLabel: 'Modo de sombreado del motor',
    modes: { studio: 'ESTUDIO PBR', cad: 'CAD ALAMBRE', spec: 'LUZ DE INSPECCIÓN' },
    inspectOn: 'TOQUE PARA INSPECCIONAR 3D', inspectOff: 'TERMINAR INSPECCIÓN', inspectHint: 'Arrastre para girar el motor',
    loading: 'Descomprimiendo acero forjado y aluminio fundido…',
    stages: { idle: 'En espera', download: 'Descargando geometría', decode: 'Decodificando Draco', curvature: 'Curvatura y cavidades', tangents: 'Marcos tangentes', maps: 'Mapas de superficie procedurales', ready: 'Montando el estudio', error: 'Falló la carga' },
    fallback: 'Su motor. En buenas manos.',
    canvasLabel: 'Recorrido interactivo del motor en cuatro zonas',
    restoring: 'RESTAURANDO 3D…',
    sim: 'SIM',
    chapters: [
      { short: 'Diagnóstico', part: 'CULATA Y TAPA DE VÁLVULAS', focus: 'PARTE SUPERIOR', hook: ['Sin adivinar.', 'Diagnóstico de nivel experto.'], text: 'Cualquiera cambia piezas. David conoce su motor por dentro y por fuera, al milímetro, y arregla el problema real desde la primera vez.', cta: 'Cuéntenos qué pasa', readout: ['COMPRESIÓN: 195 PSI', 'TOLERANCIA: ±0.002mm'] },
      { short: 'Todas las marcas', part: 'MÚLTIPLE DE ADMISIÓN', focus: 'CONDUCTOS DE ADMISIÓN', hook: ['Todas las marcas. Todos los modelos.', 'Sin atajos.'], text: 'Desde Toyotas y Hondas de diario hasta camionetas de trabajo pesado y autos europeos como Mercedes-Benz, tratamos cada admisión, sensor y sello como si lo manejara nuestra propia familia.', cta: 'Hable con su mecánico', readout: ['ADMISIÓN DE 4 CONDUCTOS', 'SELLOS: INSPECCIONADOS'] },
      { short: 'Trabajo honesto', part: 'SINCRONIZACIÓN VVT', focus: 'ACTUADOR VVT', hook: ['Trabajo duro de verdad.', 'Sin abusos de agencia.'], text: 'Aquí no paga una sala de espera de lujo. Paga por trabajo mecánico honesto y bien hecho, de un taller familiar.', cta: 'Pida una cotización honesta', readout: ['CARCASA DE SINCRONIZACIÓN VVT', 'OBJETIVO FIJADO'] },
      { short: 'Taller familiar', part: 'VOLANTE Y CORONA', focus: 'VOLANTE', hook: ['Hecho en familia y de boca en boca', '(4.6★ en Google).'], text: 'David y Edith levantaron M&D Multi-Service a puro esfuerzo y confianza. Cuando su carro sale de nuestro taller, sale firme, seguro y listo para el camino.', cta: 'Conozca a sus mecánicos', readout: ['TORQUE DEL CIGÜEÑAL: VERIFICADO'] },
    ],
  },
  proof: {
    topline: ['03 / AQUÍ MISMO EN BOYLE HEIGHTS', 'DE BOCA EN BOCA'],
    title: ['Buena gente.', 'Gran trabajo.'],
    text: 'Un taller familiar con corazón de barrio. Venga a conocer a David y Edith en M&D Multi-Service.',
    ratingLabel: 'Calificación en Google',
    reviews: (count: string) => `${count} reseñas verificadas en Google`,
    readReviews: 'Lea nuestras reseñas en Google',
    directions: 'Cómo llegar',
    hoursTitle: 'HORARIO · HORA DE LOS ÁNGELES',
    hours: [['Lunes a viernes', '8:30 a.m. – 6:00 p.m.'], ['Sábado', '8:00 a.m. – 4:00 p.m.'], ['Domingo', 'Cerrado']],
    mapTitle: 'Ubicación de M&D Multi-Service en 419 N Boyle Ave',
    route: 'RUTA',
    routeText: 'Sobre N Boyle Ave, a unos minutos de las autopistas 5, 10, 60 y 101.',
  },
  booking: {
    topline: ['04 / TERMINAL DE SERVICIO', 'DAVID Y EDITH'],
    title: ['Manos', 'a la obra.'],
    text: 'Díganles a David y Edith lo que necesita su vehículo. Con un toque se abre su app de mensajes con todo ya escrito.',
    name: 'Su nombre', namePlaceholder: 'Su nombre',
    year: 'Año', make: 'Marca', model: 'Modelo',
    service: 'Servicio',
    message: '¿Qué está notando?', messagePlaceholder: 'Ruido, luz de advertencia, olor, cuándo pasa…',
    preview: 'VISTA PREVIA DEL MENSAJE',
    sms: 'Mandar mensaje', email: 'Mandar correo', vcard: 'Guardar contacto (.vcf)',
    call: 'O llame al',
    note: 'Su app de mensajes se abre con su solicitud. Envíela desde ahí para comunicarse con el taller. La cita se confirma cuando le respondamos.',
    invalid: 'Primero escriba su nombre y el año, marca y modelo de su vehículo.',
    required: 'obligatorio',
  },
  footer: { tagline: 'NEGOCIO FAMILIAR. BOYLE HEIGHTS, LOS ÁNGELES.', email: 'Escríbale a David y Edith' },
};

export const COPY: Record<Lang, Copy> = { en, es };
