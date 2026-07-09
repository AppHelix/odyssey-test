export interface NavigationRow {
  label: string;
  levels: string[]; // Dynamically stores level_1, level_2, ..., level_n
  actualLevels: number; // Number of non-empty levels (actual navigation depth)
  [key: string]: any; // Allow dynamic level_N properties
  sourceIndex: number;
}

export interface LevelNode {
  url: string;
  children: LevelNode[];
  rows: NavigationRow[];
  level: number; // Which level this node represents (1, 2, 3, etc.)
}

export interface LabelNode {
  label: string;
  root: LevelNode;
}

export interface NavigationPlan {
  rows: NavigationRow[];
  labels: LabelNode[];
  totalLevels: number; // Total number of levels detected
}

export interface NavigationReportRow extends NavigationRow {
  levelStatuses: {
    [key: string]: {
      componentExists: 'Y' | 'N';
      statusCode?: number | string;
      status: 'PASS' | 'FAIL' | 'PENDING';
    };
  };
  failureReason?: string;
  screenshotPath?: string;
}
