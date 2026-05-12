export type Gender             = "M" | "F";
export type CategoryLevel      = "1a" | "2a" | "3a" | "4a" | "5a" | "6a" | "iniciacion";
export type TournamentStatus   = "open" | "ongoing" | "finished";
export type TournamentTier     = "open" | "silver" | "gold";
export type RegistrationStatus = "pending" | "confirmed" | "waitlist";
export type RankingType        = "spa" | "circuit";

export interface AdminStats {
  activeTournaments: number;
  registeredPlayers: number;
  scheduledMatches:  number;
}

export interface TournamentCategory {
  id:               string;
  gender:           Gender;
  level:            CategoryLevel;
  currentPhase:     string;
  currentPhaseLabel?: string;
  totalSpots:       number;
  registeredCount:  number;
  myTeamRegistered: boolean;
  price?:           number;
  minPairs?:        number;
  maxPairs?:        number;
}

export interface TournamentScheduleDay {
  id:                 string;
  label:              string;
  slots:              string[];
  maxUnavailableHours:number;
  isFinal?:           boolean;
}

export interface Tournament {
  id:          string;
  name:        string;
  dates:       string;
  startDate?:  string;
  endDate?:    string;
  venue:       string;
  city?:       string;
  prize?:      string;
  status:      TournamentStatus;
  tier?:       TournamentTier;
  spaTier?:    TournamentTier;
  categories:  TournamentCategory[];
  schedule?:   TournamentScheduleDay[];
  hasShirts?:  boolean;
  imageUrl?:   string;
  format?:     string;
  scoringSystem?: string;
  registrationDeadline?: string;
  courts?:     string[];
  season?:     number;
}

export interface SpaProfile {
  spaPoints:      number;
  spaLevel:       CategoryLevel;
  spaProgression: number;
  spaReliability: number;
  spaMatches:     number;
  isCalibrating:  boolean;
}

export interface SpaConfig {
  starting_spa:        number;
  calibration_matches: number;
  k_factors: {
    calibrating: number;
    settling:    number;
    stable:      number;
  };
  round_multipliers: {
    groups:       number;
    r16:          number;
    quarterfinal: number;
    semifinal:    number;
    final:        number;
  };
  tier_multipliers: {
    open:   number;
    silver: number;
    gold:   number;
  };
  circuit_base_points: {
    winner:       number;
    finalist:     number;
    semifinal:    number;
    quarterfinal: number;
    r16:          number;
    groups:       number;
  };
  thresholds: Record<CategoryLevel, [number, number]>;
}

export interface AdminRegistration {
  id:           string;
  tournamentId: string;
  categoryId:   string;
  categoryDisplay: string;
  player1Id:    string;
  player1Name:  string;
  player2Id?:   string;
  player2Name?: string;
  status:       RegistrationStatus;
  paid:         boolean;
  createdAt:    string;
  availability?: { sat: string; sun: string };
}

export interface Player {
  id:          string;
  name:        string;
  firstName?:  string;
  lastName?:   string;
  email?:      string;
  phone?:      string;
  city?:       string;
  partner?:    string;
  partnerId?:  string | null;
  bio?:        string;
  photoUrl?:   string;
  gender:      Gender;
  level:       CategoryLevel;
  played:      number;
  wins:        number;
  points:      number;
  trend:       "up" | "down" | "stable";
  isMe?:       boolean;
  status?:     "active" | "inactive" | "suspended";
  createdAt?:  string;
}

export interface MatchResult {
  id:          string;
  tournament:  string;
  tournamentId?: string;
  categoryId?: string;
  phase:       string;
  date:        string;
  court:       string;
  team1:       string[];
  team2:       string[];
  isResult:    boolean;
  sets1?:      number[];
  sets2?:      number[];
  winner?:     "team1" | "team2";
  referee?:    string;
  status:      "pending" | "finished";
}

export interface AdminAlert {
  id:      string;
  type:    "match" | "player" | "registration" | "payment" | "system";
  message: string;
  href?:   string;
}

export interface FinanceStats {
  period: "month" | "year";
  revenue: {
    registrations: number;
    sponsorships:  number;
    merchandise:   number;
    total:         number;
  };
  costs: {
    operational: number;
    total:       number;
  };
  profit: {
    gross:     number;
    net:       number;
    vatAmount: number;
  };
  chart: { month: string; revenue: number; profit: number }[];
}

export interface CategoryChange {
  id:        string;
  date:      string;
  from:      CategoryLevel;
  to:        CategoryLevel;
  reason:    string;
  adminName: string;
}

export interface ActivityItem {
  id:      string;
  type:    "registration" | "result" | "player" | "tournament" | "payment";
  message: string;
  href?:   string;
  time:    string;
}

// Form types for creating a tournament
export interface CreateTournamentPayload {
  name:        string;
  venue:       string;
  city:        string;
  startDate:   string;
  endDate:     string;
  prize?:      string;
  tier:        TournamentTier;
  format?:     string;
  scoringSystem?: string;
  registrationDeadline?: string;
  courts?:     string[];
  categories:  {
    gender:     Gender;
    level:      CategoryLevel;
    totalSpots: number;
    price:      number;
  }[];
}
