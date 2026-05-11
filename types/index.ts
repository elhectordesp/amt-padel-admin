export type Gender          = "M" | "F";
export type CategoryLevel   = "1a" | "2a" | "3a" | "4a" | "5a" | "6a" | "iniciacion";
export type TournamentStatus = "open" | "ongoing" | "finished";
export type RegistrationStatus = "pending" | "confirmed" | "waitlist";

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
}

export interface Tournament {
  id:         string;
  name:       string;
  dates:      string;
  venue:      string;
  prize?:     string;
  status:     TournamentStatus;
  categories: TournamentCategory[];
}

export interface RankingPlayer {
  id:        string;
  name:      string;
  partner?:  string;
  partnerId?: string | null;
  bio?:      string;
  gender:    Gender;
  level:     CategoryLevel;
  played:    number;
  wins:      number;
  points:    number;
  trend:     "up" | "down" | "stable";
  isMe:      boolean;
}

export interface Registration {
  id:           string;
  tournamentId: string;
  categoryId:   string;
  playerId:     string;
  playerName:   string;
  partnerId?:   string;
  partnerName?: string;
  status:       RegistrationStatus;
  createdAt:    string;
}

export interface MatchDetailData {
  id:         string;
  tournament: string;
  tournamentId?: string;
  categoryId?: string;
  phase:      string;
  date:       string;
  court:      string;
  team1:      string[];
  team2:      string[];
  isResult:   boolean;
  sets1?:     number[];
  sets2?:     number[];
  winner?:    "team1" | "team2";
  referee?:   string;
}
