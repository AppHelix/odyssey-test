import fs from 'fs';
import path from 'path';
import xlsx from 'xlsx';
import { NavigationRow } from '../models/navigation-model';

function parseCsv(content: string): any[] {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim());
    const item: Record<string, string> = {};
    headers.forEach((header, index) => {
      item[header] = values[index] || '';
    });
    return item;
  });
}

function extractLevelColumns(raw: any[]): { columnNames: string[]; totalLevels: number } {
  if (raw.length === 0) {
    return { columnNames: [], totalLevels: 0 };
  }

  const firstRow = raw[0];
  const levelRegex = /^level[_\s]?(\d+)$/i;
  
  const levelColumns: { name: string; index: number }[] = [];
  
  for (const key of Object.keys(firstRow)) {
    const match = key.toLowerCase().match(levelRegex);
    if (match) {
      const levelNum = parseInt(match[1], 10);
      levelColumns.push({ name: key, index: levelNum });
    }
  }

  // Sort by level number
  levelColumns.sort((a, b) => a.index - b.index);
  
  return {
    columnNames: levelColumns.map((c) => c.name),
    totalLevels: levelColumns.length,
  };
}

export async function readExcel(filePath: string): Promise<NavigationRow[]> {
  let resolved = path.resolve(process.cwd(), filePath);
  if (!fs.existsSync(resolved)) {
    const csvAlt = resolved.replace(/\.xlsx?$/i, '.csv');
    if (fs.existsSync(csvAlt)) {
      resolved = csvAlt;
    } else {
      throw new Error(`Navigation input file not found at ${resolved}`);
    }
  }

  const ext = path.extname(resolved).toLowerCase();
  let raw: any[] = [];

  if (ext === '.csv') {
    const content = fs.readFileSync(resolved, 'utf8');
    raw = parseCsv(content);
  } else {
    const workbook = xlsx.readFile(resolved);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    raw = xlsx.utils.sheet_to_json(sheet, { defval: '' });
  }

  // Extract level columns dynamically
  const { columnNames: levelColumnNames, totalLevels } = extractLevelColumns(raw);
  
  if (totalLevels === 0) {
    throw new Error(`No level columns found in the input file. Expected columns like: level_1, level_2, level_3, etc.`);
  }

  const rows: NavigationRow[] = raw.map((r) => {
    const levels: string[] = [];
    for (const levelCol of levelColumnNames) {
      const value = String(r[levelCol] || '').trim();
      levels.push(value);
    }

    // Calculate actual levels: count non-empty levels from the start
    let actualLevels = 0;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i].length > 0) {
        actualLevels = i + 1;
      }
    }

    return {
      label: String(r['label'] || r['Label'] || '').trim(),
      levels,
      actualLevels,
      sourceIndex: 0,
    };
  });

  // Filter: label must exist, and at least the first level column must be non-empty
  // (Subsequent levels can be empty, representing leaf nodes at that level)
  return rows.filter((r) => r.label && r.levels.length > 0 && r.levels[0].length > 0);
}
