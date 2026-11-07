// ═══════════════════════════════════════════════════════════════════
//  Palanca · Taxonomía (vocabulario controlado de etiquetas)
// ───────────────────────────────────────────────────────────────────
//  Única fuente de verdad de las FACETAS por las que se clasifica y
//  filtra el contenido: universidad, centro, carrera, curso, asignatura
//  y profesor. Cada faceta es una lista de {id, label, ...relaciones}.
//
//  El contenido (SIMS y, más adelante, los esquemas subidos) referencia
//  estos `id` — nunca texto libre — para evitar duplicados del tipo
//  "UDC" / "udc" / "U.D.C.".
//
//  Diseñado para mapear 1:1 a tablas de Supabase en la fase de subida:
//  cada faceta = una tabla; cada recurso guarda los id como claves ajenas.
//
//  Para añadir un valor nuevo: añádelo a la lista de su faceta.
//  Se propaga solo a los filtros (§ 02 se autogenera desde aquí).
//  Cargar SIEMPRE después de simcatalog.js (usa SUBJECTS).
// ═══════════════════════════════════════════════════════════════════

// Orden y etiquetas de las facetas tal como aparecen en la UI de filtros.
const FACETS = [
  { key: "universidad", labelEs: "Universidad", labelEn: "University" },
  { key: "centro",      labelEs: "Centro",      labelEn: "School" },
  { key: "carrera",     labelEs: "Carrera",     labelEn: "Degree" },
  { key: "curso",       labelEs: "Curso",       labelEn: "Year" },
  { key: "asignatura",  labelEs: "Asignatura",  labelEn: "Subject" },
  { key: "tipo",        labelEs: "Tipo",        labelEn: "Type" },
  { key: "profesor",    labelEs: "Profesor",    labelEn: "Professor" },
  { key: "tags",        labelEs: "Etiquetas",   labelEn: "Tags" },
];

// Curso típico de cada asignatura (editable). Se usa para dar valor a la
// faceta "curso" del contenido existente hasta que cada recurso lo fije.
const SUBJECT_CURSO = {
  materiales:  "1",
  maquinas:    "2",
  rm:          "2",
  electronica: "2",
  mates1:      "1",
  edo:         "2",
  termodinamica: "2",
  electricidad: "2",
};

const TAXONOMY = {
  universidad: [
    { id: "udc", label: "Universidade da Coruña" },
  ],
  centro: [
    { id: "eps-ferrol", label: "EPS de Ferrol", universidad: "udc" },
  ],
  carrera: [
    { id: "mecanica", label: "Ingeniería Mecánica", centro: "eps-ferrol", universidad: "udc" },
    { id: "naval",    label: "Ingeniería Naval",    centro: "eps-ferrol", universidad: "udc" },
  ],
  curso: [
    { id: "1", label: "1º" },
    { id: "2", label: "2º" },
    { id: "3", label: "3º" },
    { id: "4", label: "4º" },
  ],
  // La faceta "asignatura" se deriva de SUBJECTS (simcatalog.js) para no
  // duplicar las etiquetas. Ver enriquecimiento más abajo.
  asignatura: [],
  tipo: [
    { id: "simulacion", label: "Simulación", labelEn: "Simulation" },
    { id: "apunte",     label: "Apunte",     labelEn: "Note" },
    { id: "esquema",    label: "Esquema",    labelEn: "Schematic" },
    { id: "herramienta", label: "Herramienta de estudio", labelEn: "Study tool" },
  ],
  // Añade aquí los profesores reales conforme se etiquete el contenido.
  // Ej.: { id: "n-apellido", label: "Nombre Apellido", carrera: "mecanica" }
  profesor: [],
};

// ── Derivar asignaturas desde SUBJECTS, añadiendo curso y carrera ──
if (typeof SUBJECTS !== "undefined") {
  TAXONOMY.asignatura = SUBJECTS.map(s => ({
    id:      s.id,
    label:   s.labelEs,
    labelEn: s.labelEn,
    carrera: "mecanica",
    curso:   SUBJECT_CURSO[s.id] || null,
  }));
}

// ── Enriquecer un recurso con facetas por defecto ──
// Capa de migración: mientras no exista la tabla en Supabase, todo el
// contenido sin clasificar es de UDC · EPS Ferrol · Ingeniería Mecánica.
// Cada recurso puede sobreescribir cualquier campo definiéndolo él mismo.
// Reutilizado por apuntes.js para los apuntes subidos.
function enrichResource(s) {
  s.universidad = s.universidad || "udc";
  s.centro      = s.centro      || "eps-ferrol";
  s.carrera     = s.carrera     || "mecanica";
  s.curso       = s.curso       || SUBJECT_CURSO[s.subject] || null;
  s.profesor    = s.profesor    || null;   // sin asignar
  s.tipo        = s.tipo        || "simulacion";
  s.formato     = s.formato     || "html";
  return s;
}

if (typeof SIMS !== "undefined") SIMS.forEach(enrichResource);

// ── Ayudante: etiqueta legible de un valor de faceta ──
// Resuelve el `id` de una faceta a su etiqueta en el idioma pedido.
function facetValueLabel(facetKey, id, lang) {
  if (id == null) return lang === "es" ? "Sin asignar" : "Unassigned";
  if (facetKey === "tags") return id; // los tags libres son su propia etiqueta
  const list = TAXONOMY[facetKey] || [];
  const v = list.find(x => x.id === id);
  if (!v) return id;
  return (lang === "en" && v.labelEn) ? v.labelEn : v.label;
}

// ── Ayudante: nombre de la faceta ──
function facetName(facetKey, lang) {
  const f = FACETS.find(x => x.key === facetKey);
  return f ? (lang === "es" ? f.labelEs : f.labelEn) : facetKey;
}

// ── Etiquetas predeterminadas al subir un apunte ──
// Se sugieren a partir del TÍTULO (palabras clave) y de la ASIGNATURA.
// El usuario siempre puede editarlas antes de publicar.
const TAG_KEYWORDS = [
  { re: /viga|biapoyada|voladizo|empotrad/i, tag: "Vigas" },
  { re: /cortante/i,                          tag: "Cortantes" },
  { re: /flector|flexion/i,                   tag: "Flectores" },
  { re: /momento|\bpar\b/i,                   tag: "Momento" },
  { re: /puntual/i,                           tag: "Carga puntual" },
  { re: /distribuid/i,                        tag: "Carga distribuida" },
  { re: /inercia/i,                           tag: "Inercia" },
  { re: /tension|esfuerzo/i,                  tag: "Tensiones" },
  { re: /coriolis/i,                          tag: "Coriolis" },
  { re: /velocidad|aceleracion/i,             tag: "Cinemática" },
  { re: /mecanismo|barra|corredera|articulad/i, tag: "Mecanismos" },
  { re: /cristal|celda|miller|alumina/i,      tag: "Cristalografía" },
  { re: /circuito|amplificador|diodo|transistor|orcad/i, tag: "Circuitos" },
  { re: /diagrama/i,                          tag: "Diagramas" },
  { re: /esquema/i,                           tag: "Esquema" },
  { re: /laplace/i,                           tag: "Laplace" },
];

const SUBJECT_DEFAULT_TAGS = {
  materiales:  ["Materiales"],
  maquinas:    ["Máquinas", "Cinemática"],
  rm:          ["Resistencia"],
  electronica: ["Electrónica"],
  mates1:      ["Matemáticas"],
  edo:         ["EDO"],
  termodinamica: ["Termodinámica"],
  electricidad: ["Electricidad"],
};

function suggestTags(title, subjectId) {
  // sin acentos para que /flexion/ también capture "flexión"
  const norm = (title || "").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const out = [];
  for (const k of TAG_KEYWORDS) {
    if (k.re.test(norm) && !out.includes(k.tag)) out.push(k.tag);
  }
  for (const t of (SUBJECT_DEFAULT_TAGS[subjectId] || [])) {
    if (!out.includes(t)) out.push(t);
  }
  return out.slice(0, 5);
}
