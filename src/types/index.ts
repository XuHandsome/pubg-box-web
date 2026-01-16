export interface PlayerResponse {
  accountId: string;
  shardId: string;
  clanId: string;
  name: string;
  updatedAt: string;
}

export interface PlayerMatchStatsResponse {
  dbnos: number;
  headshotKills: number;
  killStreaks: number;
  killPlace: number;
  teamKills: number;
  deathType: string;
  heals: number;
  boosts: number;
  revives: number;
  timeSurvived: number;
  walkDistance: number;
  rideDistance: number;
  swimDistance: number;
  longestKill: number;
  roadKills: number;
  vehicleDestroys: number;
  teamId: number;
}

export interface PlayerMatchResponse {
  matchId: string;
  createdAt: string;
  duration: number;
  gameMode: string;
  mapName: string;
  matchType: string;
  isCustomMatch: boolean;
  rank: number;
  won: boolean;
  kills: number;
  assists: number;
  damageDealt: number;
  winPlace: number;
  stats: PlayerMatchStatsResponse;
}

export interface MatchListResponse {
  current_page: number;
  has_next: boolean;
  limit: number;
  matches: PlayerMatchResponse[];
  offset: number;
  total: number;
  total_pages: number;
}

export interface MatchFilter {
  won?: boolean;
  startTime?: string;
  endTime?: string;
  sortField?: string;
  sortOrder?: 'asc' | 'desc';
}
