'use client'

import { createContext, useContext, useEffect, useState } from 'react'

export type Lang = 'en' | 'fr'

const translations = {
  en: {
    // nav
    'nav.independent': 'Independently run · Not affiliated with the University of Ottawa',
    'nav.maintainedBy': 'is maintained by',

    // home
    'home.schedule.title': 'Build Your Own Schedule',
    'home.schedule.desc': 'Browse every uOttawa section, filter by time and professor, detect conflicts, and export your timetable.',
    'home.schedule.cta': 'Get started →',
    'home.guess.title': 'Play uoguessr',
    'home.guess.desc': 'Guess where on campus each photo was taken. Drop a pin, score points for accuracy, beat your friends.',
    'home.guess.cta': 'Play now →',
    'home.opps.title': 'Find Student Opportunities',
    'home.opps.desc': 'Live-updated TA postings, scholarships, and academic opportunities scraped for uOttawa students.',
    'home.opps.cta': 'Explore now →',

    // schedule
    'schedule.breadcrumb': 'Schedule',
    'schedule.term.label': 'Term',
    'schedule.term.summer.short': 'Sum',
    'schedule.term.fall.short': 'Fall',
    'schedule.term.winter.short': 'Win',
    'schedule.term.summer': "Summer '26",
    'schedule.term.fall': "Fall '26",
    'schedule.term.winter': "Winter '27",
    'schedule.search.placeholder': 'Search by code or name…',
    'schedule.mySchedule': 'My Schedule',
    'schedule.loading': 'Loading courses…',
    'schedule.noResults': 'No results for "{query}"',
    'schedule.empty': 'Search for a course',
    'schedule.hint': 'Try CSI, MAT, ENG, ITI, or CEG',
    'schedule.grades': 'Grades',
    'schedule.conflict.label': 'conflict',
    'schedule.conflict.with': 'Conflicts with {label}',
    'schedule.pickLab': 'Pick a lab section',
    'schedule.conflict.section': '{section} conflicts with your schedule',

    // opportunities
    'opps.title': 'Student Opportunities',
    'opps.subtitle': 'Live-updated listings for uOttawa students',
    'opps.updated': 'Updated {date}',
    'opps.taJobs': 'TA Jobs',
    'opps.scholarships': 'Scholarships',
    'opps.search.placeholder': 'Search by course, faculty, or professor...',
    'opps.sort.recent': 'Most Recent',
    'opps.sort.deadline': 'By Deadline',
    'opps.sort.pay': 'By Pay Rate',
    'opps.filter.all': 'All',
    'opps.filter.ta': 'Teaching Asst',
    'opps.filter.ra': 'Research Asst',
    'opps.positionSingular': 'position',
    'opps.positionPlural': 'positions',
    'opps.matching': 'matching',
    'opps.noPositions': 'No positions found',
    'opps.scraperNote': 'The scraper may not have run yet, or a Supabase read policy is needed.',
    'opps.viewDetails': 'View details →',
    'opps.supervisor': 'Supervisor: {name}',
    'opps.noDescription': 'No description available.',
    'opps.applyWorkday': 'Apply on Workday →',
    'opps.comingSoon': 'Coming soon',
    'opps.role.ta': 'Teaching Asst',
    'opps.role.ra': 'Research Asst',
    'opps.role.aptpuo': 'Part-time Prof',
    'opps.role.other': 'Staff',

    // guess
    'guess.uottawa': 'University of Ottawa',
    'guess.tagline': 'Can you find your way around uOttawa?',
    'guess.uomapPresents': 'uomap presents',
    'guess.solo': 'Solo',
    'guess.party': 'Party',
    'guess.back': '← back',
    'guess.timePerRound': 'Time per round',
    'guess.noTimer': 'None',
    'guess.start': 'Start →',
    'guess.round': 'Round',
    'guess.score': 'Score',
    'guess.placePin': 'PLACE YOUR PIN ON THE MAP',
    'guess.guess': 'GUESS',
    'guess.finalScore': 'Final score',
    'guess.outOf': 'out of {max} points',
    'guess.noGuess': 'no guess',
    'guess.playAgain': 'Play again',
    'guess.backHome': 'Back home',
    'guess.result.perfect': 'Perfect!',
    'guess.result.impressive': 'Impressive!',
    'guess.result.nice': 'Nice one!',
    'guess.result.warmer': 'Getting warmer…',
    'guess.result.far': 'Were you even on campus?',
    'guess.distanceFrom': 'Your guess was {dist} from the correct location',
    'guess.noPin': 'No pin placed, 0 points this round',
    'guess.timeRanOut': 'Time ran out',
    'guess.nextRound': 'NEXT ROUND',
    'guess.viewResults': 'VIEW RESULTS',
    'guess.pts': 'pts',
    'guess.mapToggle.map': 'Map',
    'guess.mapToggle.satellite': 'Satellite',

    // party hub
    'party.multiplayer': 'Multiplayer',
    'party.newRoom': 'New Room',
    'party.joinRoom': 'Join Room',
    'party.mode.duel': 'Duel',
    'party.mode.duelDesc': '1v1, HP bars. First to zero loses.',
    'party.mode.ffa': 'FFA',
    'party.mode.ffaDesc': '2 to 5 players. Most points wins.',
    'party.mode.duos': 'Duos',
    'party.mode.duosDesc': '2v2 teams. Combined score wins.',
    'party.noLimit': 'No limit',
    'party.namePlaceholder': 'YOUR NAME',
    'party.codePlaceholder': 'ROOM CODE',
    'party.creating': 'Creating…',
    'party.create': 'Create →',
    'party.joining': 'Joining…',
    'party.join': 'Join →',
    'party.error.enterName': 'Enter your name',
    'party.error.enterCode': 'Enter a 6-character code',
    'party.error.notFound': 'Room not found',
    'party.error.inProgress': 'Game already in progress',
    'party.error.full': 'Room is full',
    'party.backGuess': '← uoguessr',

    // party room
    'room.loading': 'Loading…',
    'room.roomCode': 'Room code',
    'room.tapToCopy': 'tap to copy',
    'room.copied': 'copied!',
    'room.copyLink': 'copy invite link',
    'room.rounds': '{n} rounds',
    'room.noTimer': 'no timer',
    'room.host': 'host',
    'room.you': 'you',
    'room.team': 'Team {n}',
    'room.waitingMoreOne': 'Waiting for 1 more player…',
    'room.waitingMoreMany': 'Waiting for {n} more players…',
    'room.start': 'Start →',
    'room.waitingHost': 'Waiting for host to start…',
    'room.theEnd': 'The end',
    'room.gameOver': 'Game over',
    'room.wins': '{name} wins!',
    'room.playAgain': 'Play again',
    'room.waitingNewGame': 'Waiting for host to start a new game…',
    'room.backToParty': 'Back to party',
    'room.round': 'Round',
    'room.players': 'Players',
    'room.roundResults': 'Round {n} results',
    'room.guessLockedIn': 'GUESS LOCKED IN',
    'room.waitingForHost': 'Waiting for host…',
    'room.backParty': '← Party',
    'room.joinRoom': 'Join room {code}',
    'room.displayName': 'Display name',
    'room.joinGame': 'Join',
    'room.joiningGame': 'Joining…',
    'room.error.enterName': 'Enter your name',
    'room.error.gameStarted': 'Game already started',
    'room.error.notFound': 'Room not found.',
    'room.modeLabel.ffa': 'Free for All',
    'room.modeLabel.duel': 'Duel',
    'room.modeLabel.duos': 'Duos',
    'room.noPin': 'no pin',
  },
  fr: {
    // nav
    'nav.independent': "Géré indépendamment · Non affilié à l'Université d'Ottawa",
    'nav.maintainedBy': 'est maintenu par',

    // home
    'home.schedule.title': 'Construisez votre horaire',
    'home.schedule.desc': "Parcourez toutes les sections de l'uOttawa, filtrez par horaire et professeur, détectez les conflits et exportez votre emploi du temps.",
    'home.schedule.cta': 'Commencer →',
    'home.guess.title': 'Jouer à uoguessr',
    'home.guess.desc': 'Devinez où chaque photo a été prise sur le campus. Posez une épingle, obtenez des points, battez vos amis.',
    'home.guess.cta': 'Jouer →',
    'home.opps.title': 'Trouver des opportunités étudiantes',
    'home.opps.desc': "Postes d'AT, bourses et opportunités académiques mis à jour en direct pour les étudiants de l'uOttawa.",
    'home.opps.cta': 'Explorer →',

    // schedule
    'schedule.breadcrumb': 'Horaire',
    'schedule.term.label': 'Session',
    'schedule.term.summer.short': 'Été',
    'schedule.term.fall.short': 'Aut',
    'schedule.term.winter.short': 'Hiv',
    'schedule.term.summer': "Été '26",
    'schedule.term.fall': "Automne '26",
    'schedule.term.winter': "Hiver '27",
    'schedule.search.placeholder': 'Rechercher par code ou nom…',
    'schedule.mySchedule': 'Mon horaire',
    'schedule.loading': 'Chargement des cours…',
    'schedule.noResults': 'Aucun résultat pour « {query} »',
    'schedule.empty': 'Rechercher un cours',
    'schedule.hint': 'Essayez CSI, MAT, ENG, ITI ou CEG',
    'schedule.grades': 'Notes',
    'schedule.conflict.label': 'conflit',
    'schedule.conflict.with': 'Conflit avec {label}',
    'schedule.pickLab': 'Choisir un lab',
    'schedule.conflict.section': '{section} est en conflit avec votre horaire',

    // opportunities
    'opps.title': 'Opportunités étudiantes',
    'opps.subtitle': "Offres mises à jour en direct pour les étudiants de l'uOttawa",
    'opps.updated': 'Mis à jour le {date}',
    'opps.taJobs': "Postes d'AT",
    'opps.scholarships': 'Bourses',
    'opps.search.placeholder': 'Rechercher par cours, faculté ou professeur...',
    'opps.sort.recent': 'Plus récent',
    'opps.sort.deadline': 'Par date limite',
    'opps.sort.pay': 'Par salaire',
    'opps.filter.all': 'Tous',
    'opps.filter.ta': "Assistant d'ens.",
    'opps.filter.ra': 'Assistant de rech.',
    'opps.positionSingular': 'poste',
    'opps.positionPlural': 'postes',
    'opps.matching': 'correspondant',
    'opps.noPositions': 'Aucun poste trouvé',
    'opps.scraperNote': "Le scraper n'a peut-être pas encore été exécuté, ou une politique de lecture Supabase est requise.",
    'opps.viewDetails': 'Voir les détails →',
    'opps.supervisor': 'Superviseur : {name}',
    'opps.noDescription': 'Aucune description disponible.',
    'opps.applyWorkday': 'Postuler sur Workday →',
    'opps.comingSoon': 'Bientôt disponible',
    'opps.role.ta': 'Asst d\'ens.',
    'opps.role.ra': 'Asst de rech.',
    'opps.role.aptpuo': 'Prof. partiel',
    'opps.role.other': 'Personnel',

    // guess
    'guess.uottawa': "Université d'Ottawa",
    'guess.tagline': 'Sauriez-vous vous repérer sur le campus ?',
    'guess.uomapPresents': 'uomap présente',
    'guess.solo': 'Solo',
    'guess.party': 'Party',
    'guess.back': '← retour',
    'guess.timePerRound': 'Temps par manche',
    'guess.noTimer': 'Aucun',
    'guess.start': 'Jouer →',
    'guess.round': 'Manche',
    'guess.score': 'Score',
    'guess.placePin': 'PLACEZ VOTRE ÉPINGLE SUR LA CARTE',
    'guess.guess': 'DEVINER',
    'guess.finalScore': 'Score final',
    'guess.outOf': 'sur {max} points',
    'guess.noGuess': 'sans réponse',
    'guess.playAgain': 'Rejouer',
    'guess.backHome': "Retour à l'accueil",
    'guess.result.perfect': 'Parfait !',
    'guess.result.impressive': 'Impressionnant !',
    'guess.result.nice': 'Pas mal !',
    'guess.result.warmer': 'Vous vous rapprochez…',
    'guess.result.far': 'Étiez-vous sur le campus ?',
    'guess.distanceFrom': 'Votre réponse était à {dist} du bon endroit',
    'guess.noPin': 'Aucune épingle posée, 0 point cette manche',
    'guess.timeRanOut': 'Temps écoulé',
    'guess.nextRound': 'MANCHE SUIVANTE',
    'guess.viewResults': 'VOIR LES RÉSULTATS',
    'guess.pts': 'pts',
    'guess.mapToggle.map': 'Carte',
    'guess.mapToggle.satellite': 'Satellite',

    // party hub
    'party.multiplayer': 'Multijoueur',
    'party.newRoom': 'Nouvelle salle',
    'party.joinRoom': 'Rejoindre',
    'party.mode.duel': 'Duel',
    'party.mode.duelDesc': '1c1, barres de vie. Le premier à zéro perd.',
    'party.mode.ffa': 'FFA',
    'party.mode.ffaDesc': '2 à 5 joueurs. Le plus de points gagne.',
    'party.mode.duos': 'Duos',
    'party.mode.duosDesc': 'Équipes de 2. Le score combiné gagne.',
    'party.noLimit': 'Sans limite',
    'party.namePlaceholder': 'VOTRE NOM',
    'party.codePlaceholder': 'CODE DE SALLE',
    'party.creating': 'Création…',
    'party.create': 'Créer →',
    'party.joining': 'Connexion…',
    'party.join': 'Rejoindre →',
    'party.error.enterName': 'Entrez votre nom',
    'party.error.enterCode': 'Entrez un code de 6 caractères',
    'party.error.notFound': 'Salle introuvable',
    'party.error.inProgress': 'Partie déjà en cours',
    'party.error.full': 'Salle pleine',
    'party.backGuess': '← uoguessr',

    // party room
    'room.loading': 'Chargement…',
    'room.roomCode': 'Code de salle',
    'room.tapToCopy': 'appuyez pour copier',
    'room.copied': 'copié !',
    'room.copyLink': "copier le lien d'invitation",
    'room.rounds': '{n} manches',
    'room.noTimer': 'sans minuterie',
    'room.host': 'hôte',
    'room.you': 'vous',
    'room.team': 'Équipe {n}',
    'room.waitingMoreOne': "En attente d'un joueur supplémentaire…",
    'room.waitingMoreMany': 'En attente de {n} joueurs supplémentaires…',
    'room.start': 'Démarrer →',
    'room.waitingHost': "En attente de l'hôte…",
    'room.theEnd': 'Fin de partie',
    'room.gameOver': 'Partie terminée',
    'room.wins': '{name} gagne !',
    'room.playAgain': 'Rejouer',
    'room.waitingNewGame': "En attente de l'hôte pour une nouvelle partie…",
    'room.backToParty': 'Retour au salon',
    'room.round': 'Manche',
    'room.players': 'Joueurs',
    'room.roundResults': 'Résultats — Manche {n}',
    'room.guessLockedIn': 'RÉPONSE VERROUILLÉE',
    'room.waitingForHost': "En attente de l'hôte…",
    'room.backParty': '← Salon',
    'room.joinRoom': 'Rejoindre la salle {code}',
    'room.displayName': "Nom d'affichage",
    'room.joinGame': 'Rejoindre',
    'room.joiningGame': 'Connexion…',
    'room.error.enterName': 'Entrez votre nom',
    'room.error.gameStarted': 'Partie déjà commencée',
    'room.error.notFound': 'Salle introuvable.',
    'room.modeLabel.ffa': 'Libre pour tous',
    'room.modeLabel.duel': 'Duel',
    'room.modeLabel.duos': 'Duos',
    'room.noPin': 'sans épingle',
  },
} as const

type TranslationKey = keyof typeof translations.en

interface LanguageContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: (key: TranslationKey, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => key,
})

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en')

  useEffect(() => {
    const stored = localStorage.getItem('lang') as Lang | null
    if (stored === 'en' || stored === 'fr') setLangState(stored)
  }, [])

  const setLang = (l: Lang) => {
    setLangState(l)
    localStorage.setItem('lang', l)
  }

  const t = (key: TranslationKey, vars?: Record<string, string | number>): string => {
    const template = (translations[lang][key] ?? translations.en[key] ?? key) as string
    if (!vars) return template
    return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`))
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  return useContext(LanguageContext)
}
