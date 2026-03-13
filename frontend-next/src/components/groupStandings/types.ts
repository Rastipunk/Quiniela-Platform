export type Team = {
  id: string;
  name: string;
  code?: string;
  flag?: string;
};

export type Match = {
  id: string;
  homeTeamId: string;
  awayTeamId: string;
  kickoffUtc: string;
};

export type TeamStanding = {
  teamId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
};
