/**
 * PUBG 数据翻译字典
 */

// 地图名称对照表
export const MAP_NAME_DICT: Record<string, string> = {
  'Baltic_Main': '艾伦格 (重制版)',
  'Erangel_Main': '艾伦格 (经典版)',
  'Desert_Main': '米拉玛',
  'DihorOtok_Main': '维寒迪',
  'Savage_Main': '萨诺',
  'Summerland_Main': '卡拉金',
  'Range_Main': '训练场',
  'Kiki_Main': '帝斯顿',
  'Tiger_Main': '泰戈',
  'Neon_Main': '荣都',
  'Chimera_Main': '帕拉莫',
};

// 游戏模式对照表
export const GAME_MODE_DICT: Record<string, string> = {
  'solo': '第三人称单排(TPP)',
  'solo-fpp': '第一人称单排(FPP)',
  'duo': '第三人称双排(TPP)',
  'duo-fpp': '第一人称双排(FPP)',
  'squad': '第三人称四排(TPP)',
  'squad-fpp': '第一人称四排(FPP)',
  'normal-solo': '第三人称普通单排(TPP)',
  'normal-solo-fpp': '第一人称普通单排(FPP)',
  'normal-duo': '第三人称普通双排(TPP)',
  'normal-duo-fpp': '第一人称普通双排(FPP)',
  'normal-squad': '第三人称普通四排(TPP)',
  'normal-squad-fpp': '第一人称普通四排(FPP)',
  'conquest-solo': '第三人称阵地战单排(TPP)',
  'conquest-solo-fpp': '第一人称阵地战单排(FPP)',
  'conquest-duo': '第三人称阵地战双排(TPP)',
  'conquest-duo-fpp': '第一人称阵地战双排(FPP)',
  'conquest-squad': '第三人称阵地战四排(TPP)',
  'conquest-squad-fpp': '第一人称阵地战四排(FPP)',
  'esports-solo': '第三人称电竞单排(TPP)',
  'esports-solo-fpp': '第一人称电竞单排(FPP)',
  'esports-duo': '第三人称电竞双排(TPP)',
  'esports-duo-fpp': '第一人称电竞双排(FPP)',
  'esports-squad': '第三人称电竞四排(TPP)',
  'esports-squad-fpp': '第一人称电竞四排(FPP)',
  'war-solo': '第三人称战争模式单排(TPP)',
  'war-solo-fpp': '第一人称战争模式单排(FPP)',
  'war-duo': '第三人称战争模式双排(TPP)',
  'war-duo-fpp': '第一人称战争模式双排(FPP)',
  'war-squad': '第三人称战争模式四排(TPP)',
  'war-squad-fpp': '第一人称战争模式四排(FPP)',
  'zombie-solo': '第三人称僵尸模式单排(TPP)',
  'zombie-solo-fpp': '第一人称僵尸模式单排(FPP)',
  'zombie-duo': '第三人称僵尸模式双排(TPP)',
  'zombie-duo-fpp': '第一人称僵尸模式双排(FPP)',
  'zombie-squad': '第三人称僵尸模式四排(TPP)',
  'zombie-squad-fpp': '第一人称僵尸模式四排(FPP)',
  'lab-tpp': '第三人称实验室模式(TPP)',
  'lab-fpp': '第一人称实验室模式(FPP)',
  'tdm': '第一人称团队淘汰赛(FPP)',
};

// 比赛类型对照表
export const MATCH_TYPE_DICT: Record<string, string> = {
  'official': '官方匹配',
  'competitive': '竞技模式 (排位)',
  'airoyale': 'AI人机赛',
  'arcade': '街机模式',
  'custom': '自定义比赛',
  'event': '活动模式',
  'seasonal': '赛季模式',
  'training': '训练模式',
};

// 死亡原因对照表
export const DEATH_TYPE_DICT: Record<string, string> = {
  'alive': '存活 (获胜)',
  'byplayer': '被玩家击杀',
  'byzone': '被毒圈淘汰',
  'suicide': '自杀 / 意外',
  'logout': '离线 / 退出',
};
