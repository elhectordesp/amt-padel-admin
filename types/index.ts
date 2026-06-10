export type Gender             = "M" | "F";
export type SponsorScope       = "CIRCUIT" | "TOURNAMENT" | "REGIONAL";
export type SponsorTier        = "TITLE" | "OFFICIAL" | "PARTNER";
export type CategoryLevel      = "1a" | "2a" | "3a" | "4a" | "5a" | "6a" | "iniciacion";
export type TournamentStatus   = "DRAFT" | "OPEN" | "DRAW" | "SCHEDULED" | "ONGOING" | "FINISHED" | "CANCELLED";
export type TournamentTier     = "PLATINUM" | "GOLD" | "SILVER" | "BRONZE";
export type RegistrationStatus = "PENDING" | "CONFIRMED" | "WAITLIST" | "CANCELLED";
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
  scoringFormat?:   string;
  roundFormats?:        Record<string, string> | null;
  prizeChampion?:       string;
  prizeRunnerUp?:       string;
  prizeConsolation?:    string;
  hasConsolation?:      boolean;
  format?:              string | null;
  schedulePublishedAt?: string | null;
}

export interface TournamentScheduleDay {
  id:                 string;
  label:              string;
  slots:              string[];
  maxUnavailableHours:number;
  isFinal?:           boolean;
}

export interface Club {
  id:            string;
  name:          string;
  city:          string;
  address?:      string | null;
  phone?:        string | null;
  website?:      string | null;
  instagram?:    string | null;
  logoUrl?:      string | null;
  contactEmail?: string | null;
  isAmtPartner?: boolean;
  active?:       boolean;
  tournamentCount?: number;
  lat?:          number | null;
  lng?:          number | null;
}

export interface CourtBlock {
  id:        string;
  courtId:   string;
  startDate: string;       // "YYYY-MM-DD"
  endDate:   string;       // "YYYY-MM-DD"
  startTime?: string | null; // "HH:MM"
  endTime?:   string | null;
  reason?:    string | null;
  createdAt:  string;
}

export interface Court {
  id:        string;
  clubId:    string;
  name:      string;
  isIndoor:  boolean;
  isCentral: boolean;
  order:     number;
  active:    boolean;
  blocks?:   CourtBlock[];
}

export interface TournamentCourt {
  id:          string;
  tournamentId: string;
  courtId:     string;
  court:       Court;
}

export interface Tournament {
  id:          string;
  name:        string;
  startDate:   string;
  endDate:     string;
  club:        Club;
  prize?:       string;
  status:       TournamentStatus;
  tier?:       TournamentTier;   // DB enum — usado por el admin
  spaTier?:    string;            // Clave SPA traducida — usado por la app móvil
  categories:  TournamentCategory[];
  schedule?:   TournamentScheduleDay[];
  hasShirts?:  boolean;
  useSeeding?: boolean;
  imageUrl?:   string;
  format?:     string;
  scoringSystem?: string;
  registrationDeadline?: string;
  courts?:     string[];
  matchDuration?: number;
  elimMatchDuration?: number | null;
  maxMatchesPerPlayerPerDay?: number | null;
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
    BRONZE:   number;
    SILVER:   number;
    GOLD:     number;
    PLATINUM: number;
    // aliases internos usados por el motor SPA
    open:     number;
    silver:   number;
    gold:     number;
    platinum: number;
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

export interface AdminRegistrationUser {
  name:          string;
  email:         string;
  phone?:        string | null;
  categoryLevel?: string | null;
  spaPoints?:    number | null;
}

export interface AdminRegistration {
  id:           string;
  tournamentId: string;
  categoryId:   string;
  userId:       string;
  partnerId?:   string | null;
  user:         AdminRegistrationUser;
  partner?:     AdminRegistrationUser | null;
  category:     { gender: string; level: string; price: number };
  status:       RegistrationStatus;
  paid:         boolean;
  createdAt:    string;
  availability?: { sat: string; sun: string };
}

export interface Player {
  id:             string;
  name:           string;
  spa?:           SpaProfile;
  firstName?:     string;
  lastName?:      string;
  email?:         string | null;
  phone?:         string | null;
  city?:          string | null;
  partner?:       string;
  partnerId?:     string | null;
  bio?:           string | null;
  photoUrl?:      string | null;
  gender:         Gender;
  level:          CategoryLevel;
  played:         number;
  wins:           number;
  points:         number;
  trend:          "up" | "down" | "stable";
  isMe?:          boolean;
  status?:        "active" | "inactive" | "suspended";
  createdAt?:     string;
  globalRank?:    number;
  categoryRank?:  number;
  matches?:       PlayerMatch[];
  managedByAdmin?: boolean;
  invitedAt?:     string | null;
}

export interface CreatePlayerPayload {
  firstName:     string;
  lastName:      string;
  gender:        Gender;
  email?:        string;
  phone?:        string;
  city?:         string;
  categoryLevel?: CategoryLevel;
  position?:     "reves" | "drive" | "indiferente";
  hand?:         "diestro" | "zurdo" | "ambidiestro";
  playsMasc?:    boolean;
  playsFem?:     boolean;
  bio?:          string;
}

export interface UpdatePlayerPayload {
  firstName?:    string;
  lastName?:     string;
  gender?:       Gender;
  email?:        string;
  phone?:        string;
  city?:         string;
  categoryLevel?: CategoryLevel;
  position?:     "reves" | "drive" | "indiferente";
  hand?:         "diestro" | "zurdo" | "ambidiestro";
  playsMasc?:    boolean;
  playsFem?:     boolean;
  bio?:          string;
}

export interface PlayerMatch {
  id:         string;
  date:       string | null;
  tournament: string;
  category:   string;
  isWinner:   boolean;
  team1:      string[];
  team2:      string[];
  sets1:      number[];
  sets2:      number[];
}

export interface MatchResult {
  id:            string;
  tournament:    string;
  tournamentId?: string;
  categoryId?:   string;
  phase:         string;
  date:          string;
  court:         string;
  team1:         string[];
  team2:         string[];
  isResult:      boolean;
  sets1?:        number[];
  sets2?:        number[];
  winner?:       "team1" | "team2";
  referee?:      string;
  scoringFormat?: "BEST_OF_3" | "BEST_OF_2_SUPERTB";
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
  byTournament?: { tournamentId: string; name: string; revenue: number; registrations: number }[];
}

export interface CategoryChange {
  id:        string;
  date:      string;
  from:      CategoryLevel;
  to:        CategoryLevel;
  reason:    string;
  adminName: string;
}

export interface GrowthStats {
  season:               number;
  weeklyRegistrations:  { week: string; count: number }[];
  conversion: {
    confirmed: number;
    total:     number;
    rate:      number;
  };
  cancellationRate: number;
  players: {
    total:         number;
    newThisSeason: number;
    newPct:        number;
  };
  highDemandCategories: {
    tournamentName: string;
    gender:         string;
    level:          string;
    totalSpots:     number;
    registered:     number;
    overflow:       number;
  }[];
}

export interface ActivityItem {
  id:      string;
  type:    "registration" | "result" | "player" | "tournament" | "payment";
  message: string;
  href?:   string;
  time:    string;
}

export interface Sponsor {
  id:           string;
  name:         string;
  logoUrl?:     string | null;
  bannerUrl?:   string | null;
  websiteUrl?:  string | null;
  tagline?:     string | null;
  scope:        SponsorScope;
  tier:         SponsorTier;
  tournamentId?:string | null;
  city?:        string | null;
  displayOrder: number;
  active:       boolean;
  clickCount:   number;
  validFrom?:   string | null;
  validUntil?:  string | null;
  createdAt:    string;
  tournament?:  { id: string; name: string } | null;
}

// Form types for creating a tournament
export interface CreateTournamentPayload {
  name:        string;
  clubId:      string;
  startDate:   string;
  endDate:     string;
  prize?:      string;
  tier:        TournamentTier;
  format?:     string;
  scoringSystem?: string;
  registrationDeadline?: string;
  hasShirts?:  boolean;
  useSeeding?: boolean;
  matchDuration?: number;
  maxMatchesPerPlayerPerDay?: number | null;
  categories:  {
    gender:          Gender;
    level:           CategoryLevel;
    totalSpots:      number;
    price:           number;
    prizeChampion?:   string;
    prizeRunnerUp?:   string;
    prizeConsolation?:string;
    hasConsolation?:  boolean;
  }[];
  schedule?: {
    date:   string;
    blocks: {
      start: string;
      end:   string;
    }[];
  }[];
}

// ── AppConfig sections ────────────────────────────────────────────────────────

export interface AppConfigGeneral {
  circuitName:        string;
  supportWhatsapp:    string;
  contactEmail:       string;
  reglamentoUrl:      string;
  privacyPolicyUrl:   string;
  announcementBanner: { enabled: boolean; text: string; type: "info" | "warning" | "error" };
  maintenanceMode:    { enabled: boolean; message: string };
}

export interface AppConfigCircuit {
  bestNResults:          number;
  allowDoubleCategory:   boolean;
  tiebreaker:            "wins" | "points" | "head2head";
  rankingFreezeDate:     string | null;
  showCurrentSeasonOnly: boolean;
}

export interface AppConfigSeason {
  currentSeason: number;
  startDate:     string;
  endDate:       string;
  status:        "ACTIVE" | "CLOSED";
}

export interface AppConfigEmail {
  fromName:                       string;
  replyTo:                        string;
  enableRegistrationConfirmation: boolean;
  enableResultNotification:       boolean;
  enableCategoryChange:           boolean;
  enableInviteEmail:              boolean;
  enablePasswordReset:            boolean;
  enableWelcomeEmail:             boolean;
}

export interface AppConfigPush {
  enableMatchScheduled:        boolean;
  enableResultRecorded:        boolean;
  enableTournamentPublished:   boolean;
  enableMatchReminder:         boolean;
  enableRegistrationConfirmed: boolean;
  enableCategoryChange:        boolean;
}

export interface AppConfigTournamentDefaults {
  matchDuration:            number;
  scoringSystem:            string;
  registrationDeadlineDays: number;
  defaultFormat:            string;
  hasShirtsDefault:         boolean;
  useSeedingDefault:        boolean;
  defaultCourts:            string[];
}

export interface FaqEntry {
  q: string;
  a: string;
}

export interface FaqCategory {
  category: string;
  faqs:     FaqEntry[];
}

export interface AppConfigFaqs {
  categories: FaqCategory[];
}

export interface AppConfigAll {
  general:            AppConfigGeneral;
  circuit:            AppConfigCircuit;
  season:             AppConfigSeason;
  email:              AppConfigEmail;
  push:               AppConfigPush;
  tournamentDefaults: AppConfigTournamentDefaults;
  faqs:               AppConfigFaqs;
}

export interface AdminMember {
  id:             string;
  name:           string;
  email:          string;
  role:           "ADMIN" | "SUPERADMIN";
  createdAt:      string;
  managedByAdmin: boolean;
}

export type SupportStatus = "NEW" | "READ" | "RESOLVED";

export interface AuditLogEntry {
  id:          string;
  adminName:   string;
  action:      string;
  resource:    string;
  resourceId?: string | null;
  details?:    Record<string, unknown> | null;
  oldValue?:   Record<string, unknown> | null;
  newValue?:   Record<string, unknown> | null;
  createdAt:   string;
}

export interface SupportMessage {
  id:        string;
  subject:   string;
  message:   string;
  status:    SupportStatus;
  createdAt: string;
  user: {
    id:        string;
    firstName: string;
    lastName:  string;
    email:     string;
  };
}
