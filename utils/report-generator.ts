import fs from 'fs';
import path from 'path';
import { NavigationReportRow } from '../models/navigation-model';

export async function generateHtmlReport(rows: NavigationReportRow[], outDir = 'reports') {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const screenshotsDir = path.join(outDir, 'screenshots');
  if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true });

  const total = rows.length;
  
  // Dynamically determine the highest level status for pass/fail calculation
  const passed = rows.filter((row) => {
    const statuses = Object.values(row.levelStatuses || {});
    return statuses.length > 0 && statuses[statuses.length - 1]?.status === 'PASS';
  }).length;
  
  const failed = total - passed;
  const percent = total ? Math.round((passed / total) * 100) : 0;

  // Get the maximum number of levels across all rows based on actualLevels
  const maxLevels = rows.length > 0 ? Math.max(...rows.map(r => r.actualLevels || 0)) : 0;

  // Group rows by label
  const labelMap = new Map<string, NavigationReportRow[]>();
  for (const row of rows) {
    const label = row.label || 'Unknown';
    if (!labelMap.has(label)) {
      labelMap.set(label, []);
    }
    labelMap.get(label)!.push(row);
  }

  const sortedLabels = Array.from(labelMap.keys()).sort();

  // Generate label navigation panel
  const labelLinks = sortedLabels
    .map((label, index) => {
      const labelId = label.replace(/\s+/g, '-').toLowerCase();
      const labelCount = labelMap.get(label)?.length || 0;
      const labelPassed = labelMap.get(label)?.filter(r => {
        const statuses = Object.values(r.levelStatuses || {});
        return statuses.length > 0 && statuses[statuses.length - 1]?.status === 'PASS';
      }).length || 0;
      const isActive = index === 0 ? 'active' : '';
      return `
        <div class="label-nav-item ${isActive}" data-label="${labelId}" onclick="showLabel('${labelId}')">
          <div class="label-name">${label}</div>
          <div class="label-stats">
            <span class="stat-passed">${labelPassed}</span>
            <span class="stat-separator">/</span>
            <span class="stat-total">${labelCount}</span>
          </div>
        </div>`;
    })
    .join('\n');

  // Generate table headers dynamically
  const tableHeaders = Array.from({ length: maxLevels }, (_, i) => {
    const levelNum = i + 1;
    return `
      <th>Level_${levelNum}</th>
      <th>Status</th>`;
  }).join('\n');

  // Generate content panels for each label
  const contentPanels = sortedLabels
    .map((label, index) => {
      const labelId = label.replace(/\s+/g, '-').toLowerCase();
      const labelRows = labelMap.get(label) || [];
      const isActive = index === 0 ? 'active' : '';
      
      const tableRows = labelRows
        .map((row, rowIndex) => {
          // Determine color based on final level status
          const statuses = Object.values(row.levelStatuses || {});
          const finalStatus = statuses.length > 0 ? statuses[statuses.length - 1]?.status : 'SKIPPED';
          const rowClass = finalStatus === 'PASS' ? 'status-pass' : 'status-fail';
          
          const levelCells = Array.from({ length: maxLevels }, (_, i) => {
            const levelNum = i + 1;
            const levelKey = `level${levelNum}`;
            
            // If this level is beyond the row's actual levels, show empty cell
            if (levelNum > row.actualLevels) {
              return `
            <td class="url-cell">-</td>
            <td class="status-cell">-</td>`;
            }
            
            const levelStatus = row.levelStatuses[levelKey] || {
              componentExists: 'N',
              status: 'SKIPPED',
              statusCode: '',
            };
            
            const url = row.levels[i] || '';
            const displayUrl = url.length > 50 ? url.substring(0, 47) + '...' : url;
            const urlLink = url ? `<a href="${url}" target="_blank" rel="noopener noreferrer" class="url-link" title="${url}">🔗 ${displayUrl}</a>` : '-';
            const statusClass = `status-${levelStatus.status?.toLowerCase() || 'skipped'}`;
            const displayStatus = levelStatus.status || 'SKIPPED';
            const tooltip = displayStatus === 'SKIPPED' ? 'title="Skipped because of previous level failure"' : '';
            
            return `
            <td class="url-cell">${urlLink}</td>
            <td class="status-cell ${statusClass}" ${tooltip}>${displayStatus}</td>`;
          }).join('\n');

          const failureText = row.failureReason ? `<span class="failure-reason">${row.failureReason}</span>` : '';

          return `
          <tr class="data-row ${rowClass}">
            <td class="sno-cell">${rowIndex + 1}</td>
            <td class="label-cell"><span class="label-badge">${row.label}</span></td>
            ${levelCells}
            <td class="reason-cell">${failureText}</td>
          </tr>`;
        })
        .join('\n');

      const passCount = labelRows.filter(r => {
        const statuses = Object.values(r.levelStatuses || {});
        return statuses.length > 0 && statuses[statuses.length - 1]?.status === 'PASS';
      }).length;
      const failCount = labelRows.length - passCount;

      return `
      <div id="${labelId}" class="content-panel ${isActive}">
        <div class="panel-header">
          <div class="header-left">
            <h2>${label}</h2>
          </div>
          <div class="header-right">
            <div class="panel-stats">
              <div class="stat-box">
                <div class="stat-number">${labelRows.length}</div>
                <div class="stat-label">Total</div>
              </div>
              <div class="stat-box passed">
                <div class="stat-number">${passCount}</div>
                <div class="stat-label">Passed</div>
              </div>
              <div class="stat-box failed">
                <div class="stat-number">${failCount}</div>
                <div class="stat-label">Failed</div>
              </div>
            </div>
          </div>
        </div>
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th class="sno-header">S.No</th>
                <th class="label-header">Label</th>
                ${tableHeaders}
                <th class="reason-header">Failure Reason</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>
      </div>`;
    })
    .join('\n');

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Navigation Validation Report</title>
    <style>
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }

      html, body {
        height: 100%;
      }

      body {
        font-family: Arial, sans-serif;
        background: #fff;
        color: #000;
        line-height: 1;
      }

      .header {
        background: #333;
        color: white;
        padding: 8px 16px;
        box-shadow: none;
      }

      .header-content {
        max-width: 1600px;
        margin: 0 auto;
      }

      .header h1 {
        font-size: 16px;
        font-weight: 700;
        margin-bottom: 4px;
        letter-spacing: 0;
      }

      .summary-stats {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
        gap: 8px;
        margin-bottom: 0;
      }

      .summary-stat {
        background: #444;
        border: none;
        border-radius: 0;
        padding: 6px 10px;
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .summary-stat-label {
        font-size: 9px;
        font-weight: 600;
        opacity: 1;
        text-transform: uppercase;
        letter-spacing: 0;
      }

      .summary-stat-value {
        font-size: 14px;
        font-weight: 700;
      }

      .success-rate {
        color: #fff;
        font-size: 14px;
      }

      .main-container {
        display: flex;
        height: calc(100vh - 120px);
        max-width: 1600px;
        margin: 8px auto;
        gap: 8px;
        padding: 0 8px;
      }

      .left-panel {
        width: 180px;
        background: white;
        border-radius: 0;
        overflow-y: auto;
        padding: 6px;
        box-shadow: none;
        flex-shrink: 0;
      }

      .left-panel::-webkit-scrollbar {
        width: 4px;
      }

      .left-panel::-webkit-scrollbar-track {
        background: #f0f0f0;
        border-radius: 0;
      }

      .left-panel::-webkit-scrollbar-thumb {
        background: #ccc;
        border-radius: 0;
      }

      .left-panel::-webkit-scrollbar-thumb:hover {
        background: #999;
      }

      .label-nav-item {
        padding: 8px 10px;
        margin-bottom: 6px;
        background: #f5f5f5;
        border: 1px solid #ddd;
        border-radius: 0;
        cursor: pointer;
        transition: none;
        border-left: 3px solid #ccc;
      }

      .label-nav-item:hover {
        background: #eee;
        border-color: #999;
        box-shadow: none;
      }

      .label-nav-item.active {
        background: #e8e8e8;
        border-color: #333;
        border-left-color: #333;
        box-shadow: none;
      }

      .label-name {
        font-weight: 700;
        color: #000;
        margin-bottom: 2px;
        font-size: 11px;
      }

      .label-stats {
        font-size: 9px;
        color: #666;
        font-weight: 600;
        display: flex;
        align-items: center;
        gap: 2px;
      }

      .stat-passed {
        color: #000;
      }

      .stat-total {
        color: #000;
      }

      .stat-separator {
        color: #999;
      }

      .right-panel {
        flex: 1;
        background: white;
        border-radius: 0;
        overflow: hidden;
        box-shadow: none;
        display: flex;
        flex-direction: column;
      }

      .content-panel {
        display: none;
        flex: 1;
        overflow-y: auto;
        flex-direction: column;
      }

      .content-panel.active {
        display: flex;
      }

      .panel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 4px 8px;
        border-bottom: 1px solid #ccc;
        background: #f5f5f5;
        flex-shrink: 0;
        flex-wrap: wrap;
        gap: 4px;
      }

      .header-left h2 {
        font-size: 11px;
        color: #000;
        font-weight: 700;
      }

      .header-right {
        display: flex;
        gap: 12px;
      }

      .panel-stats {
        display: flex;
        gap: 8px;
      }

      .stat-box {
        background: #f0f0f0;
        border: 1px solid #ccc;
        border-radius: 0;
        padding: 3px 6px;
        text-align: center;
        min-width: 70px;
        box-shadow: none;
      }

      .stat-box.passed {
        border-color: #ccc;
        background: #f0f0f0;
      }

      .stat-box.failed {
        border-color: #ccc;
        background: #f0f0f0;
      }

      .stat-number {
        font-size: 12px;
        font-weight: 700;
        color: #000;
        line-height: 1;
      }

      .stat-box.passed .stat-number {
        color: #000;
      }

      .stat-box.failed .stat-number {
        color: #000;
      }

      .stat-label {
        font-size: 7px;
        color: #333;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0;
        margin-top: 1px;
        line-height: 1;
      }

      .table-wrapper {
        flex: 1;
        overflow: auto;
        padding: 0;
      }

      .table-wrapper::-webkit-scrollbar {
        width: 6px;
        height: 6px;
      }

      .table-wrapper::-webkit-scrollbar-track {
        background: #f1f1f1;
      }

      .table-wrapper::-webkit-scrollbar-thumb {
        background: #cbd5e0;
        border-radius: 3px;
      }

      .table-wrapper::-webkit-scrollbar-thumb:hover {
        background: #a0aec0;
      }

      .data-table {
        width: 100%;
        border-collapse: collapse;
        border-spacing: 0;
        font-size: 11px;
        line-height: 1;
      }

      .data-table thead {
        position: sticky;
        top: 0;
        z-index: 10;
      }

      .data-table th {
        background: #333;
        color: white;
        font-weight: 600;
        padding: 2px 4px;
        text-align: left;
        border-bottom: 1px solid #333;
        font-size: 10px;
        line-height: 1;
        height: 18px;
      }

      .sno-header, .reason-header {
        min-width: 80px;
      }

      .label-header {
        min-width: 90px;
      }

      .data-table td {
        padding: 2px 4px;
        border-bottom: 1px solid #ddd;
        vertical-align: middle;
        height: 16px;
        line-height: 1;
      }

      .data-row {
      }

      .status-pass {
        background-color: #90EE90;
      }

      .status-fail {
        background-color: #FFB6C6;
      }

      .sno-cell {
        font-weight: 600;
        min-width: 40px;
        font-size: 10px;
        padding: 2px 4px !important;
      }

      .label-cell {
        font-weight: 600;
        padding: 2px 4px !important;
      }

      .label-badge {
        padding: 1px 4px;
        font-weight: 600;
        font-size: 9px;
      }

      .url-cell {
        max-width: 180px;
        padding: 2px 4px !important;
      }

      .url-link {
        color: #0066cc;
        text-decoration: underline;
        display: inline;
        font-size: 9px;
        word-break: break-word;
      }

      .url-link:hover {
        text-decoration: underline;
      }

      .status-cell {
        font-weight: 700;
        text-align: center;
        min-width: 70px;
        padding: 2px 4px !important;
        font-size: 9px;
        line-height: 1;
      }

      .status-pass {
        color: #000;
        background: #90EE90;
      }

      .status-fail {
        color: #000;
        background: #FFB6C6;
      }

      .status-skipped {
        color: #000;
        background: #FFFFE0;
        cursor: help;
      }

      .reason-cell {
        color: #333;
        font-size: 9px;
        max-width: 250px;
        padding: 2px 4px !important;
      }

      .failure-reason {
        color: #000;
        padding: 1px 2px;
        font-size: 8px;
      }

      .footer {
        background: white;
        border-top: 1px solid #ddd;
        padding: 6px 12px;
        font-size: 10px;
        color: #666;
        text-align: center;
        margin-top: auto;
      }

      @media (max-width: 1400px) {
        .main-container {
          flex-direction: column;
          height: auto;
          max-height: calc(100vh - 150px);
        }

        .left-panel {
          width: 100%;
          max-height: 100px;
          display: flex;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 4px;
        }

        .label-nav-item {
          flex: 0 0 auto;
          min-width: 120px;
          margin-right: 6px;
          margin-bottom: 0;
        }

        .right-panel {
          height: auto;
        }

        .panel-header {
          flex-direction: column;
          align-items: flex-start;
          gap: 4px;
          padding: 4px 8px;
        }

        .header-right {
          width: 100%;
          flex-direction: row;
          flex-wrap: wrap;
        }

        .panel-stats {
          width: 100%;
          flex-wrap: wrap;
        }

        .stat-box {
          flex: 0 1 60px;
          min-width: 60px;
        }

        .data-table {
          font-size: 10px;
        }

        .data-table th,
        .data-table td {
          padding: 2px 3px;
        }
      }

      @media (max-width: 768px) {
        .header {
          padding: 6px 10px;
        }

        .header h1 {
          font-size: 13px;
          margin-bottom: 3px;
        }

        .summary-stats {
          grid-template-columns: repeat(2, 1fr);
          gap: 6px;
        }

        .summary-stat {
          padding: 4px 6px;
        }

        .data-table {
          font-size: 9px;
        }

        .data-table th,
        .data-table td {
          padding: 2px 3px;
        }

        .url-link {
          font-size: 8px;
        }

        .url-cell {
          max-width: 120px;
        }
      }
    </style>
  </head>
  <body>
    <div class="header">
      <div class="header-content">
        <h1>🧭 Navigation Validation Report</h1>
        <div class="summary-stats">
          <div class="summary-stat">
            <div class="summary-stat-label">Total Tests</div>
            <div class="summary-stat-value">${total}</div>
          </div>
          <div class="summary-stat">
            <div class="summary-stat-label">Passed</div>
            <div class="summary-stat-value" style="color: #4ade80;">${passed}</div>
          </div>
          <div class="summary-stat">
            <div class="summary-stat-label">Failed</div>
            <div class="summary-stat-value" style="color: #f87171;">${failed}</div>
          </div>
          <div class="summary-stat">
            <div class="summary-stat-label">Success Rate</div>
            <div class="summary-stat-value success-rate">${percent}%</div>
          </div>
          <div class="summary-stat">
            <div class="summary-stat-label">Levels Tested</div>
            <div class="summary-stat-value">${maxLevels}</div>
          </div>
        </div>
      </div>
    </div>

    <div class="main-container">
      <div class="left-panel">
        ${labelLinks}
      </div>
      <div class="right-panel">
        ${contentPanels}
      </div>
    </div>

    <div class="footer">
      <p>📊 Report generated on <strong>${new Date().toLocaleString()}</strong> | Navigation Validation Framework</p>
    </div>

    <script>
      function showLabel(labelId) {
        // Hide all panels
        document.querySelectorAll('.content-panel').forEach(panel => {
          panel.classList.remove('active');
        });

        // Remove active class from all nav items
        document.querySelectorAll('.label-nav-item').forEach(item => {
          item.classList.remove('active');
        });

        // Show selected panel
        const panel = document.getElementById(labelId);
        if (panel) {
          panel.classList.add('active');
        }

        // Mark nav item as active
        document.querySelector(\`[data-label="\${labelId}"]\`)?.classList.add('active');
      }

      // Show first label on load
      const firstLabel = document.querySelector('.label-nav-item');
      if (firstLabel) {
        firstLabel.click();
      }

      // Allow URLs to open in new tabs
      document.querySelectorAll('.url-link').forEach(link => {
        link.addEventListener('click', function(e) {
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            window.open(this.href, '_blank');
          }
        });
      });
    </script>
  </body>
</html>`;

  const outPath = path.join(outDir, 'navigation-report.html');
  fs.writeFileSync(outPath, html, 'utf8');
  return outPath;
}
