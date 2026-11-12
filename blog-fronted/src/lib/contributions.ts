export interface ContributionDay { date: string; count: number; level: number }
export interface ContributionSource { status: 'ok' | 'stale' | 'unavailable'; total: number; days: ContributionDay[] }
export interface ContributionsData { github: ContributionSource; gitee: ContributionSource }
