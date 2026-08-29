import type { GameId } from "../../core/types";

export type TutorialId = "setup" | GameId;

export interface GuidedTourStep {
  target: string;
  eyebrow: string;
  title: string;
  description: string;
  tip: string;
}

export interface GameDemoStep {
  title: string;
  description: string;
  action: string;
}

export interface GameGuide {
  title: string;
  badge: string;
  summary: string;
  beta: boolean;
  steps: GameDemoStep[];
}

export const gameGuides: Record<GameId, GameGuide> = {
  roulette: {
    title: "Ruleta casino",
    badge: "CLÁSICO",
    beta: false,
    summary: "Cada nombre ocupa una casilla y el resultado se sella antes de que la rueda empiece a girar.",
    steps: [
      { title: "Carga los nombres", description: "Cada participante recibe número, color y una casilla visible. La ruleta se adapta sin dejar espacios vacíos.", action: "Comprueba la lista de la izquierda." },
      { title: "Elige el modo", description: "Ganador directo entrega premios sin repetir; Eliminación retira una persona por ronda hasta llegar al final.", action: "Selecciona el modo antes de iniciar." },
      { title: "Gira la ruleta", description: "Pulsa Lanzar pelota. La selección ya está comprometida y la animación representa ese resultado verificable.", action: "No necesitas elegir una casilla manualmente." },
      { title: "Confirma el resultado", description: "La tarjeta final anuncia el nombre, registra el premio y actualiza el historial automáticamente.", action: "Cierra el resultado para continuar." },
    ],
  },
  cards: {
    title: "Cartas",
    badge: "CLÁSICO",
    beta: false,
    summary: "Los nombres se asignan a cartas visibles, el mazo se reúne y después se reparte boca abajo.",
    steps: [
      { title: "Verifica la asignación", description: "Antes de barajar puedes comprobar qué carta pertenece a cada persona. El vínculo queda visible y numerado.", action: "Revisa nombres y cartas en la mesa." },
      { title: "Reúne y baraja", description: "El botón principal recoge todas las cartas, sella la ronda y ejecuta el barajado visual.", action: "Pulsa Reunir y barajar una sola vez." },
      { title: "Escoge cualquier reverso", description: "Cuando las cartas estén boca abajo, toca cualquiera. La posición elegida revela el resultado previamente sellado.", action: "Las cartas disponibles brillan al pasar el cursor." },
      { title: "Revela y continúa", description: "La carta gira, muestra la persona y el historial conserva el resultado para las rondas siguientes.", action: "Usa Continuar en el anuncio final." },
    ],
  },
  pinball: {
    title: "Pinball 3D",
    badge: "BETA",
    beta: true,
    summary: "Todas las pelotas salen juntas y cada una representa a un participante durante la misma partida.",
    steps: [
      { title: "Prepara la mesa", description: "El sistema crea una distribución verificable y asigna un número a cada pelota antes de encender la máquina.", action: "Puedes generar otra distribución antes de jugar." },
      { title: "Elige automático o manual", description: "Automático controla toda la mesa. Manual permite usar A, D, flechas y espacio sin alterar el resultado sellado.", action: "El control se elige desde el inicio." },
      { title: "Sigue una pelota", description: "La cámara predictiva puede acompañar a cualquier participante y muestra una estela para no perderlo de vista.", action: "Usa el selector Cámara sobre la mesa." },
      { title: "Lanza el lote completo", description: "Todas las pelotas salen al mismo tiempo. Choques, flippers y puntos presentan la ronda hasta confirmar el resultado.", action: "Pulsa Encender y jugar o Lanzar todas." },
    ],
  },
  marbles: {
    title: "Canicas 3D",
    badge: "BETA",
    beta: true,
    summary: "Una pista modular con altura, curvas, puentes y poderes distintos se genera para cada ronda.",
    steps: [
      { title: "Revisa la pista", description: "Dificultad, altura, trampas y poderes aparecen antes de abrir la compuerta. Puedes generar otro mapa mientras la ronda no esté sellada.", action: "Comprueba los indicadores superiores." },
      { title: "Escoge una cámara", description: "Vista general muestra toda la carrera. Persecución, A bordo y Aérea siguen a la canica seleccionada.", action: "Elige un nombre y cambia el estilo de cámara." },
      { title: "Observa poderes y remontadas", description: "Quienes van atrás tienen más oportunidades de recibir ayudas o afectar a quienes lideran, sin cambiar la imparcialidad del resultado.", action: "Mira el registro de eventos durante la carrera." },
      { title: "Recuperación y meta", description: "Si una canica abandona la pista vuelve de forma segura al inicio. En Eliminación, la última en cruzar queda fuera.", action: "Pulsa Iniciar carrera y sigue la clasificación." },
    ],
  },
  ducks: {
    title: "Patos 3D",
    badge: "BETA",
    beta: true,
    summary: "Puntería con cámara frontal fija: uno o dos patos, tres disparos por tanda, refugios y tres vidas.",
    steps: [
      { title: "Elige la tanda", description: "Usa Un pato para aprender o Dos patos para aumentar la dificultad. La cámara frontal permanece estable mientras apuntas.", action: "Elige el modo y pulsa Soltar los patos." },
      { title: "Tres disparos", description: "Cada tanda permite tres intentos y tiene tiempo limitado. Si fallas los tres o se acaba el reloj, los patos escapan.", action: "Un impacto revela el siguiente nombre sellado y resta una vida." },
      { title: "Refugio y salida colectiva", description: "Los patos se ocultan por completo detrás de árboles o pasto. Tras cada impacto, toda la bandada sale antes de la siguiente tanda.", action: "Sigue las lámparas de impacto y la meta visual." },
      { title: "Resiste sus poderes", description: "Algunos patos cambian la paleta, invierten colores o hacen temblar la vista. Los efectos son visuales y no alteran quién gana.", action: "El último participante con vidas vence." },
    ],
  },
};

export const guidedTours: Record<TutorialId, GuidedTourStep[]> = {
  setup: [
    { target: ".setup-hero", eyebrow: "BIENVENIDA", title: "Todo empieza aquí", description: "Sigue los pasos del 1 al 4: participantes, juego, modo e inicio. Primero te mostramos dónde está cada control; después podrás llenar tu lista.", tip: "Puedes repetir esta guía con el botón Guía de la barra superior." },
    { target: ".setup-name-entry", eyebrow: "PASO 1 · UN NOMBRE", title: "Escribe y agrega", description: "Escribe el nombre de una persona en este campo. Presiona Enter o el botón + para añadirla. Repite la operación con las demás personas.", tip: "Ejemplo: escribe Ana López y pulsa +. No pongas una coma si agregas solo una persona." },
    { target: ".setup-participant-actions", eyebrow: "PASO 1 · LISTA COMPLETA", title: "También puedes pegar varios", description: "Pulsa Pegar varios nombres. En el cuadro que se abre, escribe una persona por línea o sepáralas con comas. Después pulsa Agregar nombres.", tip: "Ejemplo: Ana, Bruno, Camila. Los nombres repetidos se omiten; no necesitas numerarlos." },
    { target: ".participant-list--full", eyebrow: "PASO 1 · REVISIÓN", title: "Comprueba tu lista", description: "Aquí verás a todas las personas cargadas. Si hay un error, usa la X junto al nombre para quitarlo y agrégalo de nuevo correctamente.", tip: "Necesitas al menos dos participantes habilitados para entrar al juego." },
    { target: ".game-options--large", eyebrow: "PASO 2", title: "Elige una experiencia", description: "Ruleta y Cartas son modos clásicos. Pinball, Canicas y Patos están marcados como BETA y muestran controles y reglas especiales.", tip: "Seleccionar un juego actualiza inmediatamente las instrucciones inferiores." },
    { target: ".selected-game-guide", eyebrow: "DEMOSTRACIONES", title: "Aprende antes de jugar", description: "Cada juego incluye una demostración visual de cuatro pasos. Puedes verla antes de añadir nombres o repetirla cuando quieras.", tip: "Pulsa Ver demo paso a paso para explorar el juego seleccionado." },
    { target: ".mode-choice-panel", eyebrow: "PASO 3", title: "Define cómo termina", description: "Ganador directo permite varios premios sin repetir. Eliminación retira participantes hasta dejar un ganador. Aquí también defines el premio y los controles especiales.", tip: "Patos siempre usa supervivencia de tres vidas." },
    { target: ".setup-hero-start", eyebrow: "PASO 4", title: "Entra al juego", description: "Con dos nombres o más, pulsa Iniciar sorteo. Dentro del juego aparecerá otra guía corta sobre sus controles reales.", tip: "El tutorial nunca realiza ni altera un sorteo." },
  ],
  roulette: [
    { target: ".casino-roster-panel", eyebrow: "RULETA · 1", title: "Relaciona nombre y casilla", description: "Esta lista conserva el número y color de cada participante durante la ronda.", tip: "En Eliminación también muestra PAR o IMPAR como referencia visual." },
    { target: ".roulette-stage", eyebrow: "RULETA · 2", title: "Lee la rueda", description: "La rueda se adapta a la cantidad real de nombres. La bola y la animación presentan un resultado que ya fue sellado de forma verificable.", tip: "No existen casillas vacías seleccionables." },
    { target: ".casino-spin-button", eyebrow: "RULETA · 3", title: "Lanza cuando estés listo", description: "Pulsa Lanzar pelota para iniciar la ronda. Mientras gira se bloquea para evitar dos resultados simultáneos.", tip: "Después aparecerá el anuncio oficial y se actualizará el historial." },
  ],
  cards: [
    { target: ".card-game-status", eyebrow: "CARTAS · 1", title: "Sigue la fase actual", description: "La cabecera te dice si estás verificando, reuniendo, barajando, repartiendo o revelando.", tip: "No necesitas memorizar el orden de acciones." },
    { target: ".card-table", eyebrow: "CARTAS · 2", title: "Verifica y escoge", description: "Primero verás nombres y cartas; después del barajado quedarán boca abajo y podrás tocar cualquier posición disponible.", tip: "La elección visual no puede cambiar el resultado sellado." },
    { target: ".card-game-controls", eyebrow: "CARTAS · 3", title: "Un botón te guía", description: "El control inferior cambia su mensaje según la fase y solo permite la acción correcta en cada momento.", tip: "Espera el mensaje Toca una carta antes de elegir." },
  ],
  pinball: [
    { target: ".pinball-game__status", eyebrow: "PINBALL · 1", title: "Comprueba modo y sello", description: "Aquí ves si la mesa es automática o manual y confirmas que la ronda ya tiene un resultado protegido.", tip: "Los controles solo afectan la presentación física." },
    { target: ".pinball-cabinet", eyebrow: "PINBALL · 2", title: "Todas salen juntas", description: "La mesa libera el lote completo al mismo tiempo y muestra lanzamientos, pelotas activas, impactos y rendimiento.", tip: "Cada pelota mantiene el número de su participante." },
    { target: ".pinball-camera-control", eyebrow: "PINBALL · 3", title: "Acompaña una pelota", description: "Selecciona un nombre para activar la cámara predictiva y su estela. Vista general vuelve a mostrar toda la mesa.", tip: "Puedes cambiar de participante durante la partida." },
    { target: ".pinball-controls", eyebrow: "PINBALL · 4", title: "Enciende o controla", description: "Automático requiere un solo botón. En manual, espacio lanza todo el lote y A/D o las flechas accionan los flippers.", tip: "La mesa terminará la ronda de forma automática." },
  ],
  marbles: [
    { target: ".marble-race-status", eyebrow: "CANICAS · 1", title: "Lee el mapa antes de salir", description: "Dificultad, riesgo, poderes, altura y cantidad de canicas están resumidos en la cabecera.", tip: "Puedes cambiar mapa o dificultad antes de iniciar." },
    { target: ".marble-arena", eyebrow: "CANICAS · 2", title: "Pista modular con altura", description: "Puentes, curvas, túneles y zonas de poder forman un circuito distinto para cada semilla.", tip: "Una canica fuera de pista activa recuperación segura." },
    { target: ".marble-camera-control", eyebrow: "CANICAS · 3", title: "Elige a quién seguir", description: "Selecciona un participante y alterna Persecución, A bordo o Aérea. Las flechas cambian rápidamente de canica.", tip: "Vista general conserva el mapa completo en pantalla." },
    { target: ".marble-power-quick-legend", eyebrow: "CANICAS · 4", title: "Entiende los poderes", description: "La leyenda muestra qué efectos pueden aparecer. Las canicas retrasadas reciben más oportunidades de remontada.", tip: "Los eventos explican quién activó cada poder." },
    { target: ".marble-controls", eyebrow: "CANICAS · 5", title: "Abre la compuerta", description: "Pulsa Iniciar carrera. La clasificación, zona de riesgo y meta se actualizan en vivo hasta confirmar el resultado.", tip: "En Eliminación, la última canica queda fuera." },
  ],
  ducks: [
    { target: ".duck-hunt__status", eyebrow: "PATOS · 1", title: "Elige una modalidad", description: "Un pato es el modo básico y Dos patos eleva la dificultad. Cada tanda tiene tres disparos y un reloj.", tip: "Todos empiezan con tres vidas." },
    { target: ".duck-hunt__arena", eyebrow: "PATOS · 2", title: "Cámara frontal de puntería", description: "La vista permanece fija. Los patos vuelan frente al bosque y se esconden completamente detrás de árboles o pasto.", tip: "Las lámparas superiores registran las últimas diez tandas." },
    { target: ".duck-life-table", eyebrow: "PATOS · 3", title: "Sigue vidas y racha", description: "La tabla revela un nombre después de su primer impacto, resta corazones y conserva tu mejor racha.", tip: "Los participantes ocultos mantienen protegida su identidad." },
    { target: ".duck-hunt__controls", eyebrow: "PATOS · 4", title: "Dispara o resuelve", description: "Puedes apuntar directamente, usar Siguiente impacto o resolver el orden sellado con controles accesibles.", tip: "Paleta, temblor e inversión son efectos visuales temporales." },
  ],
};
