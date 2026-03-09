import { TestCase, TestStyle } from './gemini';

export interface HistoryRecord {
  id: string;
  timestamp: number;
  mode: 'matrix' | 'xmind' | 'analysis';
  style: TestStyle;
  fileName: string;
  testCases?: TestCase[];
  xmindContent?: string;
  analysisReport?: string;
  revisedDocument?: string;
}

const HISTORY_KEY = 'test_gen_history';
const MAX_HISTORY = 10;

export const historyService = {
  save(record: Omit<HistoryRecord, 'id' | 'timestamp'>): HistoryRecord {
    const history = this.getAll();
    const newRecord: HistoryRecord = {
      ...record,
      id: Math.random().toString(36).substring(2, 11),
      timestamp: Date.now(),
    };

    const updatedHistory = [newRecord, ...history].slice(0, MAX_HISTORY);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
    return newRecord;
  },

  getAll(): HistoryRecord[] {
    const data = localStorage.getItem(HISTORY_KEY);
    if (!data) return [];
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse history', e);
      return [];
    }
  },

  delete(id: string): void {
    const history = this.getAll();
    const updatedHistory = history.filter(r => r.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updatedHistory));
  },

  clear(): void {
    localStorage.removeItem(HISTORY_KEY);
  }
};
