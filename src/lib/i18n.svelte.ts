// English and German. The English text is the key; German comes from the table (anything missing
// stays English). {name} placeholders are filled from the second argument. The choice is the
// family's: System, Deutsch or English, saved under `ewo:lang` (public/boot.js reads it before paint).

export type Lang = 'en' | 'de';
export type LangChoice = Lang | 'system';
const KEY = 'ewo:lang';

/** The first of the browser's languages the game speaks, English otherwise. */
export function systemLang(): Lang {
  const tags = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language || '']) : [];
  for (const tag of tags) {
    const base = String(tag).toLowerCase().slice(0, 2);
    if (base === 'de' || base === 'en') return base;
  }
  return 'en';
}

function storedChoice(): LangChoice {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'en' || v === 'de' || v === 'system') return v;
    // the app's own key before 2026-10-23
    const old = JSON.parse(localStorage.getItem('cx-prefs') || '{}')?.lang;
    if (old === 'en' || old === 'de') return old;
  } catch {
    // storage off
  }
  return 'system';
}

const choice = storedChoice();
export const i18n = $state({ choice, lang: (choice === 'system' ? systemLang() : choice) as Lang });

/** Stores a choice and shows the page in that language. */
export function setLanguage(next: LangChoice) {
  i18n.choice = next;
  i18n.lang = next === 'system' ? systemLang() : next;
  document.documentElement.lang = i18n.lang;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // not kept
  }
}

const DE: Record<string, string> = {
  'Your name': 'Dein Name',
  'Your colour': 'Deine Farbe',
  'New room': 'Neuer Raum',
  'Join': 'Beitreten',
  'Room code': 'Raumcode',
  'Level {n}': 'Level {n}',
  '{xp} XP': '{xp} XP',
  '{n} XP to level {next}': 'Noch {n} XP bis Level {next}',
  'Stats': 'Statistik',
  'Settings': 'Einstellungen',
  'Sound': 'Ton',
  'Language': 'Sprache',
  'Close': 'Schließen',
  'Leave': 'Verlassen',
  'Copy link': 'Link kopieren',
  'Copied': 'Kopiert',
  'Players': 'Spieler',
  'Host': 'Host',
  'You': 'Du',
  'Start': 'Starten',
  'Game': 'Spiel',
  'Free for all': 'Jeder gegen jeden',
  'Teams': 'Teams',
  'Team {n}': 'Team {n}',
  'Mode': 'Modus',
  'Target': 'Ziel',
  'Classic ({n})': 'Klassisch ({n})',
  'Rounds to win': 'Runden zum Sieg',
  'Powerups': 'Powerups',
  'How often': 'Wie oft',
  'Feel': 'Fahrgefühl',
  'Tune': 'Feintuning',
  'Profile': 'Profil',
  'Save as': 'Speichern als',
  'Save': 'Speichern',
  'Back to measured': 'Zurück zu gemessen',
  'Applies from the next round.': 'Gilt ab der nächsten Runde.',
  'Round {n}': 'Runde {n}',
  'Round': 'Runde',
  'Room': 'Raum',
  'First to': 'Ziel',
  'First team to': 'Erstes Team mit',
  'rounds': 'Runden',
  '2 points clear': '2 Punkte Vorsprung',
  'you': 'du',
  '{name} steers with': '{name} lenkt mit',
  'Hold left': 'Links halten',
  'Hold right': 'Rechts halten',
  '{name} takes the round': '{name} holt die Runde',
  'Nobody takes the round': 'Niemand holt die Runde',
  'Team {n} takes the round': 'Team {n} holt die Runde',
  'Get ready': 'Mach dich bereit',
  'Watching': 'Zuschauen',
  'You join the next game.': 'Du spielst ab dem nächsten Spiel mit.',
  'Turn your phone': 'Dreh dein Handy',
  'The field needs the wide side.': 'Das Spielfeld braucht die breite Seite.',
  'Game over': 'Spiel vorbei',
  '{name} wins': '{name} gewinnt',
  'Team {n} wins': 'Team {n} gewinnt',
  'Back to the room': 'Zurück in den Raum',
  'Play again': 'Nochmal',
  '+{n} XP': '+{n} XP',
  'No room with that code.': 'Kein Raum mit diesem Code.',
  'The room is full.': 'Der Raum ist voll.',
  'Add a seat': 'Platz hinzufügen',
  'Remove': 'Entfernen',
  'Press left…': 'Links drücken…',
  'Press right…': 'Rechts drücken…',
  'Back': 'Zurück',
  'Games': 'Spiele',
  'Wins': 'Siege',
  'Points': 'Punkte',
  'Kills': 'Abschüsse',
  'Survived rounds': 'Überlebte Runden',
  'Powerups taken': 'Powerups',
  'Distance': 'Strecke',
  'Longest round': 'Längste Runde',
  'Turns left / right': 'Lenken links / rechts',
  'Gaps': 'Lücken',
  'Unlocked at level {n}': 'Ab Level {n}',
  'Steer with ← → or A D. On a phone, hold the left or right half.': 'Lenken mit ← → oder A D. Am Handy die linke oder rechte Hälfte halten.',
  'All apps': 'Alle Apps',
  'How to play': 'So geht’s',
  'Next': 'Weiter',
  'Skip': 'Überspringen',
  'Let’s go': 'Los geht’s',
  'The others': 'Die anderen',
  'Everyone': 'Alle',
  'Steering, gaps, powerups: the game in five steps': 'Lenken, Lücken, Powerups: das Spiel in fünf Schritten',
  'Your name first, please.': 'Erst deinen Namen, bitte.',
  'Opening a room …': 'Der Raum wird geöffnet …',
  'That didn’t work. Try again.': 'Das hat nicht geklappt. Versuch es nochmal.',
  'Who’s driving?': 'Wer fährt?',
  'Name': 'Name',
  'Play together': 'Zusammen spielen',
  'A room with a code: everyone on their own computer or phone, up to ten curves.': 'Ein Raum mit Code: alle am eigenen Rechner oder Handy, bis zu zehn Kurven.',
  'Join with a room code': 'Mit Raumcode beitreten',
  'One keyboard': 'Eine Tastatur',
  'Two to four players on this computer, two keys each.': 'Zwei bis vier Leute an diesem Rechner, je zwei Tasten.',
  'Set up the seats': 'Plätze einrichten',
  'Your stats': 'Deine Statistik',
  'Joining the room …': 'Du kommst in den Raum …',
  'Home': 'Start',
  'Join the room': 'In den Raum',
  'Starting …': 'Es geht los …',
  'Invite people with the code or the QR code.': 'Lade Leute mit dem Code oder dem QR-Code ein.',
  'In the room': 'Im Raum',
  'Tap yourself to change your seal, colour or team.': 'Tipp auf dich, um Siegel, Farbe oder Team zu ändern.',
  'The game': 'Das Spiel',
  'Play': 'Spielart',
  '{n} teams': '{n} Teams',
  'Your own': 'Eigenes',
  'Classic: ten points for every other player. Two points clear wins.': 'Klassisch: zehn Punkte für jeden anderen Spieler. Gewonnen wird mit zwei Punkten Vorsprung.',
  'Start the game': 'Spiel starten',
  '{name} starts the game.': '{name} startet das Spiel.',
  'Your team': 'Dein Team',
  'Done': 'Fertig',
  'Back to the seats': 'Zurück zu den Plätzen',
  'Another seal': 'Anderes Siegel',
  'Colour': 'Farbe',
  'Tap a seal for another one, the keys to set new ones.': 'Tipp auf ein Siegel für ein anderes, auf die Tasten für neue.',
  'Every seat needs two keys of its own.': 'Jeder Platz braucht zwei eigene Tasten.',
  'QR code for this room': 'QR-Code für diesen Raum',
  'You win!': 'Du gewinnst!',
  'Back to the room …': 'Zurück in den Raum …',
  'with {n} points': 'mit {n} Punkten',
  '{name} takes everyone back to the room.': '{name} holt alle zurück in den Raum.',
  'Leave the room': 'Raum verlassen',
  'Ending the game …': 'Das Spiel wird beendet …',
  'This game': 'Dieses Spiel',
  'End the game for everyone?': 'Das Spiel für alle beenden?',
  'Yes, end it': 'Ja, beenden',
  'Keep playing': 'Weiterspielen',
  'Leave the room? Your curve stops, and someone else becomes the host.': 'Den Raum verlassen? Deine Kurve hält an, und jemand anders wird Host.',
  'Leave the room? Your curve stops.': 'Den Raum verlassen? Deine Kurve hält an.',
  'Yes, leave': 'Ja, verlassen',
  'End the game at this keyboard?': 'Das Spiel an dieser Tastatur beenden?',
  'End the game': 'Spiel beenden',
  '{name} can end the game.': '{name} kann das Spiel beenden.',
  'General': 'Allgemein',
  'System': 'System',
  'Sounds': 'Töne',
  'Coming up': 'Als Nächstes',
  'Steer': 'Lenken',
  'Your line never stops. ← → or A D turn it; on a phone held sideways, hold the left or the right half of the screen.': 'Deine Linie hält nie an. ← → oder A D lenken; am quer gehaltenen Handy hältst du die linke oder rechte Bildschirmhälfte.',
  'Stay clear': 'Bleib frei',
  'Touch a line or the wall and your round is over, your own line too. At the start you see where you’re heading for a moment before the lines begin.': 'Berührst du eine Linie oder die Wand, ist deine Runde vorbei, auch bei deiner eigenen. Zu Beginn siehst du kurz, wohin du fährst, bevor die Linien anfangen.',
  'Slip through': 'Schlüpf durch',
  'Every line leaves short gaps now and then. Drive through one to get out of a tight spot.': 'Jede Linie lässt ab und zu kurze Lücken. Fahr durch eine, um aus der Enge zu kommen.',
  'Drive over a disc to take it. Green ones are for you, red ones hit everyone else, blue ones change the field for all.': 'Fahr über eine Scheibe, um sie zu nehmen. Grüne sind für dich, rote treffen alle anderen, blaue ändern das Feld für alle.',
  'Win': 'Gewinnen',
  'When a curve crashes, everyone still driving gets a point. First to the target, two points clear, wins the game.': 'Crasht eine Kurve, bekommt jeder, der noch fährt, einen Punkt. Wer zuerst das Ziel erreicht, mit zwei Punkten Vorsprung, gewinnt.',
  'Tap yourself to change your seal, colour or team, someone else to take them out of the room.': 'Tipp auf dich, um Siegel, Farbe oder Team zu ändern, auf jemand anderen, um ihn aus dem Raum zu nehmen.',
  'Take {name} out of the room? They can’t come back into it.': '{name} aus dem Raum nehmen? Dann geht es für sie nicht mehr in diesen Raum zurück.',
  'Take them out': 'Rausnehmen',
  'The host took you out of the room.': 'Der Host hat dich aus dem Raum genommen.',
  'That room is gone.': 'Den Raum gibt es nicht mehr.',
  'The room is open in another tab.': 'Der Raum ist in einem anderen Tab offen.',
  'Pillars': 'Säulen',
  'Ice and mud': 'Eis und Schlamm',
  'Shape': 'Form',
  'Size': 'Größe',
  'Round and square, nothing gets through.': 'Rund und eckig, nichts kommt durch.',
  'On ice a turn is wider, in mud you’re slower.': 'Auf Eis wird eine Kurve weiter, im Schlamm bist du langsamer.',
  'Arena': 'Arena',
  'How often powerups appear: ×1 is the usual pace, ×4 four times as often.': 'Wie oft Powerups erscheinen: ×1 ist das übliche Tempo, ×4 viermal so oft.',
  'Admin': 'Admin',
  'Admin tools are on': 'Admin-Werkzeuge sind an',
  'The Tune panel and the feel in the room show on this device.': 'Das Feintuning und das Fahrgefühl im Raum zeigen sich auf diesem Gerät.',
  'Turn off': 'Ausschalten',
  'Admin code': 'Admin-Code',
  'Unlock': 'Freischalten',
  'That’s not the code.': 'Das ist nicht der Code.',
  'Square': 'Quadrat',
  'Circle': 'Kreis',
  'Hexagon': 'Sechseck',
  'Ring': 'Ring',
  'Cross': 'Kreuz',
  'Small': 'Klein',
  'Normal': 'Normal',
  'Large': 'Groß',
  'Player 1': 'Spieler 1',
  'Player 2': 'Spieler 2',
  'Player 3': 'Spieler 3',
  'Player 4': 'Spieler 4',
  'Red': 'Rot',
  'Orange': 'Orange',
  'Yellow': 'Gelb',
  'Lime': 'Limette',
  'Green': 'Grün',
  'Cyan': 'Cyan',
  'Blue': 'Blau',
  'Violet': 'Violett',
  'Pink': 'Pink',
  'White': 'Weiß',
};

export function t(text: string, vars?: Record<string, string | number>) {
  let out = i18n.lang === 'de' ? (DE[text] ?? text) : text;
  if (vars) for (const [k, v] of Object.entries(vars)) out = out.replaceAll(`{${k}}`, String(v));
  return out;
}
