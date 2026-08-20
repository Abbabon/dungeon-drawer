import type { DifficultyId, ShapeId } from './maze/types';

export type Lang = 'en' | 'he' | 'es' | 'fr' | 'de';

export const LANGS: { id: Lang; label: string }[] = [
  { id: 'en', label: 'English' },
  { id: 'he', label: 'עברית' },
  { id: 'es', label: 'Español' },
  { id: 'fr', label: 'Français' },
  { id: 'de', label: 'Deutsch' },
];

export const RTL_LANGS: ReadonlySet<Lang> = new Set<Lang>(['he']);

export interface Strings {
  appTitle: string;
  tagline: string;
  secDifficulty: string;
  secShape: string;
  secDoors: string;
  secTreasures: string;
  secName: string;
  difficulty: Record<DifficultyId, string>;
  shapes: Record<ShapeId, string>;
  waysIn: string;
  waysOut: string;
  doorsHint: string;
  themes: Record<string, string>;
  myPictures: string;
  uploadPictures: string;
  uploadHint: string;
  howMany: string;
  treasuresHint: string;
  tryAnother: string;
  peekSolution: string;
  downloadPdf: string;
  addToBook: string;
  includeSolutionPage: string;
  yourBook: string;
  bookEmpty: string;
  mazeCount: (n: number) => string;
  solutionsAtBack: string;
  downloadBook: string;
  bookHint: string;
  footer: string;
  defaultMazeTitle: string;
  defaultBookTitle: string;
  solution: string;
  mazesInside: (n: number) => string;
  remove: string;
}

export const STRINGS: Record<Lang, Strings> = {
  en: {
    appTitle: 'Dungeon Drawer',
    tagline: 'Make print-and-play mazes your kids will love',
    secDifficulty: '1. How tricky?',
    secShape: '2. Pick a shape',
    secDoors: '3. Doors',
    secTreasures: '4. Treasures to find',
    secName: '5. Name it',
    difficulty: { easy: 'Easy', medium: 'Medium', hard: 'Hard', expert: 'Expert', giant: 'Giant' },
    shapes: { rectangle: 'Classic', circle: 'Circle', heart: 'Heart', star: 'Star', hexagon: 'Hexagon' },
    waysIn: 'Ways in',
    waysOut: 'Ways out',
    doorsHint: 'Only one door really works — the rest are sneaky dead ends! 😉',
    themes: { treasure: 'Treasure', animals: 'Animals', space: 'Space', sweets: 'Sweets', ocean: 'Ocean' },
    myPictures: 'My pictures',
    uploadPictures: '📷 Add your own pictures',
    uploadHint: 'Family photos, drawings, pets… they become the treasures in the maze.',
    howMany: 'How many?',
    treasuresHint: 'The path to the exit passes through every treasure.',
    tryAnother: '🎲 Try another',
    peekSolution: 'Peek at solution',
    downloadPdf: '⬇️ Download PDF',
    addToBook: '📖 Add to book',
    includeSolutionPage: 'Include a solution page in the PDF',
    yourBook: '📚 Your maze book',
    bookEmpty: 'empty',
    mazeCount: (n) => `${n} maze${n === 1 ? '' : 's'}`,
    solutionsAtBack: 'Solutions at the back',
    downloadBook: '📚 Download book PDF',
    bookHint: 'Press “Add to book” to collect mazes, then download them all as one printable book with a cover page.',
    footer: 'Made for rainy afternoons ☔ — print on A4, grab a pencil, go!',
    defaultMazeTitle: 'My Amazing Maze',
    defaultBookTitle: 'Our Maze Book',
    solution: 'Solution',
    mazesInside: (n) => `${n} maze${n === 1 ? '' : 's'} inside`,
    remove: 'Remove',
  },
  he: {
    appTitle: 'מצייר מבוכים',
    tagline: 'מבוכים להדפסה שהילדים שלכם יאהבו',
    secDifficulty: '1. כמה קשה?',
    secShape: '2. בחרו צורה',
    secDoors: '3. דלתות',
    secTreasures: '4. אוצרות למצוא',
    secName: '5. תנו שם',
    difficulty: { easy: 'קל', medium: 'בינוני', hard: 'קשה', expert: 'קשה מאוד', giant: 'ענק' },
    shapes: { rectangle: 'קלאסי', circle: 'עיגול', heart: 'לב', star: 'כוכב', hexagon: 'משושה' },
    waysIn: 'כניסות',
    waysOut: 'יציאות',
    doorsHint: 'רק דלת אחת באמת עובדת — כל השאר מבוי סתום! 😉',
    themes: { treasure: 'אוצר', animals: 'חיות', space: 'חלל', sweets: 'ממתקים', ocean: 'ים' },
    myPictures: 'התמונות שלי',
    uploadPictures: '📷 הוסיפו תמונות משלכם',
    uploadHint: 'תמונות משפחה, ציורים, חיות מחמד… הן יהפכו לאוצרות במבוך.',
    howMany: 'כמה?',
    treasuresHint: 'הדרך ליציאה עוברת דרך כל אוצר.',
    tryAnother: '🎲 נסו עוד אחד',
    peekSolution: 'הצצה לפתרון',
    downloadPdf: '⬇️ הורדת PDF',
    addToBook: '📖 הוספה לחוברת',
    includeSolutionPage: 'לכלול עמוד פתרון ב-PDF',
    yourBook: '📚 חוברת המבוכים שלכם',
    bookEmpty: 'ריקה',
    mazeCount: (n) => `${n} מבוכים`,
    solutionsAtBack: 'פתרונות בסוף',
    downloadBook: '📚 הורדת חוברת PDF',
    bookHint: 'לחצו על ״הוספה לחוברת״ כדי לאסוף מבוכים, ואז הורידו את כולם כחוברת אחת להדפסה עם עמוד שער.',
    footer: 'נעים לימים גשומים ☔ — מדפיסים על A4, לוקחים עיפרון, ויוצאים לדרך!',
    defaultMazeTitle: 'המבוך המדהים שלי',
    defaultBookTitle: 'חוברת המבוכים שלנו',
    solution: 'פתרון',
    mazesInside: (n) => `${n} מבוכים בפנים`,
    remove: 'הסרה',
  },
  es: {
    appTitle: 'Dungeon Drawer',
    tagline: 'Crea laberintos para imprimir que encantarán a tus hijos',
    secDifficulty: '1. ¿Qué tan difícil?',
    secShape: '2. Elige una forma',
    secDoors: '3. Puertas',
    secTreasures: '4. Tesoros por encontrar',
    secName: '5. Ponle nombre',
    difficulty: { easy: 'Fácil', medium: 'Medio', hard: 'Difícil', expert: 'Experto', giant: 'Gigante' },
    shapes: { rectangle: 'Clásico', circle: 'Círculo', heart: 'Corazón', star: 'Estrella', hexagon: 'Hexágono' },
    waysIn: 'Entradas',
    waysOut: 'Salidas',
    doorsHint: 'Solo una puerta funciona de verdad, ¡las demás son callejones sin salida! 😉',
    themes: { treasure: 'Tesoro', animals: 'Animales', space: 'Espacio', sweets: 'Dulces', ocean: 'Océano' },
    myPictures: 'Mis fotos',
    uploadPictures: '📷 Añade tus propias fotos',
    uploadHint: 'Fotos de familia, dibujos, mascotas… se convierten en los tesoros del laberinto.',
    howMany: '¿Cuántos?',
    treasuresHint: 'El camino a la salida pasa por todos los tesoros.',
    tryAnother: '🎲 Probar otro',
    peekSolution: 'Ver la solución',
    downloadPdf: '⬇️ Descargar PDF',
    addToBook: '📖 Añadir al libro',
    includeSolutionPage: 'Incluir página de solución en el PDF',
    yourBook: '📚 Tu libro de laberintos',
    bookEmpty: 'vacío',
    mazeCount: (n) => `${n} laberinto${n === 1 ? '' : 's'}`,
    solutionsAtBack: 'Soluciones al final',
    downloadBook: '📚 Descargar libro en PDF',
    bookHint: 'Pulsa «Añadir al libro» para reunir laberintos y descárgalos como un libro imprimible con portada.',
    footer: 'Perfecto para tardes de lluvia ☔ — imprime en A4, coge un lápiz ¡y a jugar!',
    defaultMazeTitle: 'Mi laberinto increíble',
    defaultBookTitle: 'Nuestro libro de laberintos',
    solution: 'Solución',
    mazesInside: (n) => `${n} laberinto${n === 1 ? '' : 's'} dentro`,
    remove: 'Quitar',
  },
  fr: {
    appTitle: 'Dungeon Drawer',
    tagline: 'Créez des labyrinthes à imprimer que vos enfants vont adorer',
    secDifficulty: '1. Quelle difficulté ?',
    secShape: '2. Choisissez une forme',
    secDoors: '3. Portes',
    secTreasures: '4. Trésors à trouver',
    secName: '5. Donnez-lui un nom',
    difficulty: { easy: 'Facile', medium: 'Moyen', hard: 'Difficile', expert: 'Expert', giant: 'Géant' },
    shapes: { rectangle: 'Classique', circle: 'Cercle', heart: 'Cœur', star: 'Étoile', hexagon: 'Hexagone' },
    waysIn: 'Entrées',
    waysOut: 'Sorties',
    doorsHint: 'Une seule porte fonctionne vraiment — les autres sont des impasses ! 😉',
    themes: { treasure: 'Trésor', animals: 'Animaux', space: 'Espace', sweets: 'Bonbons', ocean: 'Océan' },
    myPictures: 'Mes images',
    uploadPictures: '📷 Ajoutez vos propres images',
    uploadHint: 'Photos de famille, dessins, animaux… ils deviennent les trésors du labyrinthe.',
    howMany: 'Combien ?',
    treasuresHint: 'Le chemin vers la sortie passe par chaque trésor.',
    tryAnother: '🎲 Un autre !',
    peekSolution: 'Voir la solution',
    downloadPdf: '⬇️ Télécharger le PDF',
    addToBook: '📖 Ajouter au livre',
    includeSolutionPage: 'Inclure une page de solution dans le PDF',
    yourBook: '📚 Votre livre de labyrinthes',
    bookEmpty: 'vide',
    mazeCount: (n) => `${n} labyrinthe${n === 1 ? '' : 's'}`,
    solutionsAtBack: 'Solutions à la fin',
    downloadBook: '📚 Télécharger le livre en PDF',
    bookHint: 'Appuyez sur « Ajouter au livre » pour collectionner des labyrinthes, puis téléchargez-les en un seul livre imprimable avec couverture.',
    footer: 'Parfait pour les après-midis pluvieux ☔ — imprimez en A4, prenez un crayon, c’est parti !',
    defaultMazeTitle: 'Mon labyrinthe génial',
    defaultBookTitle: 'Notre livre de labyrinthes',
    solution: 'Solution',
    mazesInside: (n) => `${n} labyrinthe${n === 1 ? '' : 's'} à l’intérieur`,
    remove: 'Retirer',
  },
  de: {
    appTitle: 'Dungeon Drawer',
    tagline: 'Labyrinthe zum Ausdrucken, die eure Kinder lieben werden',
    secDifficulty: '1. Wie knifflig?',
    secShape: '2. Form wählen',
    secDoors: '3. Türen',
    secTreasures: '4. Schätze zum Finden',
    secName: '5. Namen geben',
    difficulty: { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer', expert: 'Experte', giant: 'Riesig' },
    shapes: { rectangle: 'Klassisch', circle: 'Kreis', heart: 'Herz', star: 'Stern', hexagon: 'Sechseck' },
    waysIn: 'Eingänge',
    waysOut: 'Ausgänge',
    doorsHint: 'Nur eine Tür führt wirklich zum Ziel — der Rest sind fiese Sackgassen! 😉',
    themes: { treasure: 'Schatz', animals: 'Tiere', space: 'Weltraum', sweets: 'Süßes', ocean: 'Meer' },
    myPictures: 'Meine Bilder',
    uploadPictures: '📷 Eigene Bilder hinzufügen',
    uploadHint: 'Familienfotos, Zeichnungen, Haustiere… sie werden zu den Schätzen im Labyrinth.',
    howMany: 'Wie viele?',
    treasuresHint: 'Der Weg zum Ausgang führt durch jeden Schatz.',
    tryAnother: '🎲 Noch eins!',
    peekSolution: 'Lösung ansehen',
    downloadPdf: '⬇️ PDF herunterladen',
    addToBook: '📖 Zum Buch hinzufügen',
    includeSolutionPage: 'Lösungsseite ins PDF aufnehmen',
    yourBook: '📚 Euer Labyrinth-Buch',
    bookEmpty: 'leer',
    mazeCount: (n) => `${n} Labyrinth${n === 1 ? '' : 'e'}`,
    solutionsAtBack: 'Lösungen am Ende',
    downloadBook: '📚 Buch als PDF herunterladen',
    bookHint: '„Zum Buch hinzufügen“ drücken, um Labyrinthe zu sammeln — dann alles als druckbares Buch mit Titelseite herunterladen.',
    footer: 'Gemacht für Regennachmittage ☔ — auf A4 drucken, Stift schnappen, los geht’s!',
    defaultMazeTitle: 'Mein tolles Labyrinth',
    defaultBookTitle: 'Unser Labyrinth-Buch',
    solution: 'Lösung',
    mazesInside: (n) => `${n} Labyrinth${n === 1 ? '' : 'e'} drin`,
    remove: 'Entfernen',
  },
};

export function detectLang(): Lang {
  const nav = (navigator.languages?.[0] ?? navigator.language ?? 'en').slice(0, 2).toLowerCase();
  return (LANGS.some((l) => l.id === nav) ? nav : 'en') as Lang;
}
