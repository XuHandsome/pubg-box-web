import request from '../utils/request';
import type { PlayerResponse, MatchListResponse, MatchFilter } from '../types';

export const getPlayerInfo = (name: string): Promise<PlayerResponse> => {
  return request.get(`player/${name}`);
};

export const getPlayerMatches = (name: string, limit = 20, offset = 0, filter?: MatchFilter): Promise<MatchListResponse> => {
  return request.get(`player/${name}/matches`, {
    params: { limit, offset, ...filter },
  });
};

export const getSystemStats = (): Promise<{ players: number, matches: number }> => {
  return request.get('system/stats');
};

export const getMatchTelemetry = (matchId: string): Promise<any[]> => {
  return request.get(`matches/${matchId}/telemetry`, {
    timeout: 60000 // 遥测数据较大，设置 60s 超时
  });
};

export const getMatchDetails = (matchId: string, playerName?: string): Promise<any> => {
  return request.get(`matches/${matchId}`, {
    params: { player: playerName }
  });
};
