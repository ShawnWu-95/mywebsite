// Configuration for GMV and ROI intervals
// GMV intervals are in ten thousands (万元)
// ROI intervals are ratios
const config = {
    gmvIntervals: [
        { min: 0, max: 30, label: "< 30", repValue: 15 },
        { min: 30, max: 50, label: "30 - 50", repValue: 40 },
        { min: 50, max: 100, label: "50 - 100", repValue: 75 },
        { min: 100, max: Infinity, label: "> 100", repValue: 120 }
    ],
    roiIntervals: [
        { min: 0, max: 1.0, label: "< 1.0", repValue: 0.8 },
        { min: 1.0, max: 1.5, label: "1.0 - 1.5", repValue: 1.25 },
        { min: 1.5, max: 2.0, label: "1.5 - 2.0", repValue: 1.75 },
        { min: 2.0, max: Infinity, label: "> 2.0", repValue: 2.5 }
    ],
    // Matrix: rows correspond to GMV, cols correspond to ROI
    // Values are commission rates (percentage)
    matrix: [
        [0.5, 0.8, 1.0, 1.5], // GMV < 30
        [0.8, 1.0, 1.5, 2.0], // GMV 30 - 50
        [1.0, 1.5, 2.0, 2.5], // GMV 50 - 100
        [1.2, 1.8, 2.5, 3.0]  // GMV > 100
    ],
    // People distribution matrix (same dimensions as commission matrix)
    people: [
        [1, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ]
};

document.addEventListener('DOMContentLoaded', () => {
    const marginInput = document.getElementById('margin');
    const marketCostInput = document.getElementById('market-cost');
    const baseSalaryInput = document.getElementById('base-salary');
    const calculateBtn = document.getElementById('calculate-btn');
    const addColBtn = document.getElementById('add-col-btn');
    const addRowBtn = document.getElementById('add-row-btn');

    const totalPeopleDisplay = document.getElementById('total-people');
    const weightedRoiDisplay = document.getElementById('weighted-roi');
    const totalNetGmvDisplay = document.getElementById('total-net-gmv');
    const grossProfitDisplay = document.getElementById('gross-profit');
    const remainingProfitDisplay = document.getElementById('remaining-profit');

    const totalMarketingSpendDisplay = document.getElementById('total-marketing-spend');
    const marketLaborCostDisplay = document.getElementById('market-labor-cost-display');
    const salesFixedSalaryDisplay = document.getElementById('sales-fixed-salary-display');
    const totalCommissionDisplay = document.getElementById('total-commission');

    const roi1Display = document.getElementById('roi1');
    const roi2Display = document.getElementById('roi2');
    const salesCommRateDisplay = document.getElementById('sales-comm-rate');
    const salesCostRateDisplay = document.getElementById('sales-cost-rate');

    const matrixBody = document.getElementById('matrix-body');
    const matrixHeaderRow = document.querySelector('.matrix-header-row');

    // --- Helper Functions ---

    // Parse Range String (e.g., "30-50", ">100", "<30")
    function parseRange(text) {
        text = text.trim();
        let min = 0, max = Infinity, repValue = 0;

        if (text.startsWith('<')) {
            max = parseFloat(text.substring(1));
            min = 0;
            repValue = max / 2;
        } else if (text.startsWith('>')) {
            min = parseFloat(text.substring(1));
            max = Infinity;
            repValue = min * 1.2;
        } else if (text.includes('-')) {
            const parts = text.split('-');
            min = parseFloat(parts[0]);
            max = parseFloat(parts[1]);
            repValue = (min + max) / 2;
        } else {
            // Fallback for single number or invalid
            const val = parseFloat(text);
            if (!isNaN(val)) {
                min = val;
                max = val;
                repValue = val;
            }
        }

        if (isNaN(repValue)) repValue = 0;

        return { min, max, label: text, repValue };
    }

    // --- Matrix Manipulation ---

    function addColumn() {
        // Add new ROI interval (default)
        const lastRoi = config.roiIntervals[config.roiIntervals.length - 1];
        const newMin = lastRoi.max !== Infinity ? lastRoi.max : lastRoi.min + 0.5;
        const newLabel = `>${newMin}`;
        config.roiIntervals.push(parseRange(newLabel));

        // Update Matrix and People
        config.matrix.forEach(row => row.push(0));
        config.people.forEach(row => row.push(0));

        initMatrix();
    }

    function addRow() {
        // Add new GMV interval (default)
        const lastGmv = config.gmvIntervals[config.gmvIntervals.length - 1];
        const newMin = lastGmv.max !== Infinity ? lastGmv.max : lastGmv.min + 50;
        const newLabel = `>${newMin}`;
        config.gmvIntervals.push(parseRange(newLabel));

        // Update Matrix and People
        const newRowMatrix = new Array(config.roiIntervals.length).fill(0);
        const newRowPeople = new Array(config.roiIntervals.length).fill(0);
        config.matrix.push(newRowMatrix);
        config.people.push(newRowPeople);

        initMatrix();
    }

    function removeColumn(index) {
        if (config.roiIntervals.length <= 1) return;
        config.roiIntervals.splice(index, 1);
        config.matrix.forEach(row => row.splice(index, 1));
        config.people.forEach(row => row.splice(index, 1));
        initMatrix();
    }

    function removeRow(index) {
        if (config.gmvIntervals.length <= 1) return;
        config.gmvIntervals.splice(index, 1);
        config.matrix.splice(index, 1);
        config.people.splice(index, 1);
        initMatrix();
    }

    function updateHeader(type, index, value) {
        const parsed = parseRange(value);
        if (type === 'gmv') {
            config.gmvIntervals[index] = parsed;
        } else {
            config.roiIntervals[index] = parsed;
        }
        calculate();
    }

    // --- UI Rendering ---

    function initMatrix() {
        // Reset Header Row
        matrixHeaderRow.innerHTML = '';

        // Corner Cell
        const corner = document.createElement('div');
        corner.className = 'matrix-cell header-cell corner';
        corner.textContent = 'GMV \\ ROI';
        matrixHeaderRow.appendChild(corner);

        // Render ROI Headers
        config.roiIntervals.forEach((interval, index) => {
            const cell = document.createElement('div');
            cell.className = 'matrix-cell header-cell';

            const input = document.createElement('input');
            input.className = 'header-input';
            input.value = interval.label;
            input.addEventListener('change', (e) => updateHeader('roi', index, e.target.value));

            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = () => removeColumn(index);

            cell.appendChild(input);
            cell.appendChild(deleteBtn);
            matrixHeaderRow.appendChild(cell);
        });

        // Add Column Button
        matrixHeaderRow.appendChild(addColBtn);

        // Total Header (Column Stats)
        const totalHeader = document.createElement('div');
        totalHeader.className = 'matrix-cell header-cell total-cell';
        totalHeader.textContent = '行统计';
        matrixHeaderRow.appendChild(totalHeader);

        // Render Body (GMV Rows)
        matrixBody.innerHTML = '';
        config.gmvIntervals.forEach((gmvInterval, rowIndex) => {
            const row = document.createElement('div');
            row.className = 'matrix-row';

            // Row Header (GMV Label)
            const headerCell = document.createElement('div');
            headerCell.className = 'matrix-cell header-cell';

            const input = document.createElement('input');
            input.className = 'header-input';
            input.value = gmvInterval.label;
            input.addEventListener('change', (e) => updateHeader('gmv', rowIndex, e.target.value));

            const deleteBtn = document.createElement('div');
            deleteBtn.className = 'delete-btn';
            deleteBtn.textContent = '×';
            deleteBtn.onclick = () => removeRow(rowIndex);

            headerCell.appendChild(input);
            headerCell.appendChild(deleteBtn);
            row.appendChild(headerCell);

            // Data Cells
            config.roiIntervals.forEach((roiInterval, colIndex) => {
                const cell = document.createElement('div');
                cell.className = 'matrix-cell';
                cell.dataset.row = rowIndex;
                cell.dataset.col = colIndex;

                // Rate Input Row
                const rateRow = document.createElement('div');
                rateRow.className = 'input-row';
                const rateLabel = document.createElement('label');
                rateLabel.textContent = '提点%';
                const rateInput = document.createElement('input');
                rateInput.type = 'number';
                rateInput.step = '0.1';
                rateInput.value = config.matrix[rowIndex][colIndex];
                rateInput.addEventListener('change', (e) => {
                    const val = parseFloat(e.target.value);
                    if (!isNaN(val)) {
                        config.matrix[rowIndex][colIndex] = val;
                        calculate();
                    }
                });
                rateRow.appendChild(rateLabel);
                rateRow.appendChild(rateInput);

                // People Input Row
                const peopleRow = document.createElement('div');
                peopleRow.className = 'input-row';
                const peopleLabel = document.createElement('label');
                peopleLabel.textContent = '人数';
                const peopleInput = document.createElement('input');
                peopleInput.type = 'number';
                peopleInput.step = '1';
                peopleInput.className = 'people-input';
                peopleInput.value = config.people[rowIndex][colIndex];
                peopleInput.addEventListener('change', (e) => {
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                        config.people[rowIndex][colIndex] = val;
                        calculate();
                    }
                });
                peopleRow.appendChild(peopleLabel);
                peopleRow.appendChild(peopleInput);

                cell.appendChild(rateRow);
                cell.appendChild(peopleRow);
                row.appendChild(cell);
            });

            // Row Total Cell
            const rowTotalCell = document.createElement('div');
            rowTotalCell.className = 'matrix-cell total-cell';
            rowTotalCell.id = `row-total-${rowIndex}`;
            rowTotalCell.innerHTML = `
                <div class="stat-item"><span class="stat-label">人数:</span> <span class="stat-value people">0</span></div>
                <div class="stat-item"><span class="stat-label">均GMV:</span> <span class="stat-value gmv">0</span></div>
            `;
            row.appendChild(rowTotalCell);

            matrixBody.appendChild(row);
        });

        // Column Total Row
        const totalRow = document.createElement('div');
        totalRow.className = 'matrix-row total-row';

        // Total Row Header
        const totalRowHeader = document.createElement('div');
        totalRowHeader.className = 'matrix-cell header-cell';
        totalRowHeader.textContent = '列统计';
        totalRow.appendChild(totalRowHeader);

        // Column Total Cells
        config.roiIntervals.forEach((_, colIndex) => {
            const colTotalCell = document.createElement('div');
            colTotalCell.className = 'matrix-cell total-cell';
            colTotalCell.id = `col-total-${colIndex}`;
            colTotalCell.innerHTML = `
                <div class="stat-item"><span class="stat-label">人数:</span> <span class="stat-value people">0</span></div>
                <div class="stat-item"><span class="stat-label">均ROI:</span> <span class="stat-value roi">0</span></div>
            `;
            totalRow.appendChild(colTotalCell);
        });

        // Grand Total Cell (Bottom Right)
        const grandTotalCell = document.createElement('div');
        grandTotalCell.className = 'matrix-cell total-cell corner';
        grandTotalCell.id = 'grand-total';
        grandTotalCell.innerHTML = `
            <div class="stat-item"><span class="stat-label">总人数:</span> <span class="stat-value people">0</span></div>
        `;
        totalRow.appendChild(grandTotalCell);

        matrixBody.appendChild(totalRow);

        // Recalculate to update stats
        calculate();
    }

    // Format Currency
    function formatCurrency(value) {
        return new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' }).format(value);
    }

    // Calculate
    function calculate() {
        const marginPercent = parseFloat(marginInput.value) || 0;
        const marketCost = parseFloat(marketCostInput.value) || 0;
        const baseSalary = parseFloat(baseSalaryInput.value) || 0;

        let totalPeople = 0;
        let totalNetGmv = 0; // in Yuan
        let totalCommission = 0; // in Yuan
        let totalMarketingSpend = 0; // in Yuan
        let weightedRoiSum = 0;

        // Stats Arrays
        const rowStats = config.gmvIntervals.map(() => ({ people: 0, gmvSum: 0 }));
        const colStats = config.roiIntervals.map(() => ({ people: 0, roiSum: 0 }));

        // Iterate through matrix
        for (let r = 0; r < config.gmvIntervals.length; r++) {
            for (let c = 0; c < config.roiIntervals.length; c++) {
                const count = config.people[r][c];
                if (count > 0) {
                    const rate = config.matrix[r][c];
                    const repNetGmv = config.gmvIntervals[r].repValue * 10000; // Convert to Yuan (Treated as Net GMV)
                    const repRoi = config.roiIntervals[c].repValue;

                    const cellTotalNetGmv = count * repNetGmv;
                    const cellTotalCommission = cellTotalNetGmv * (rate / 100);
                    const cellMarketingSpend = repRoi > 0 ? (cellTotalNetGmv / repRoi) : 0;

                    totalPeople += count;
                    totalNetGmv += cellTotalNetGmv;
                    totalCommission += cellTotalCommission;
                    totalMarketingSpend += cellMarketingSpend;
                    weightedRoiSum += (count * repRoi);

                    // Update Stats
                    rowStats[r].people += count;
                    rowStats[r].gmvSum += (count * repNetGmv);

                    colStats[c].people += count;
                    colStats[c].roiSum += (count * repRoi);
                }
            }
        }

        const weightedRoi = totalPeople > 0 ? (weightedRoiSum / totalPeople).toFixed(2) : '--';

        // Advanced Profit Calculation
        // Remaining Profit = Net GMV * Margin - Marketing Spend - Market Labor - Fixed Salary - Commission
        const totalFixedSalary = totalPeople * baseSalary;
        const grossProfit = totalNetGmv * (marginPercent / 100);
        const remainingProfit = grossProfit - totalMarketingSpend - marketCost - totalFixedSalary - totalCommission;

        // Ratios
        const salesCommRate = totalNetGmv > 0 ? ((totalCommission / totalNetGmv) * 100).toFixed(2) : '0.00';
        const salesCostRate = totalNetGmv > 0 ? (((totalCommission + totalFixedSalary) / totalNetGmv) * 100).toFixed(2) : '0.00';

        // ROI1 = (Marketing Spend + Market Labor Cost) / Net GMV
        const roi1 = totalNetGmv > 0 ? (((totalMarketingSpend + marketCost) / totalNetGmv) * 100).toFixed(2) : '0.00';

        // ROI2 = (Marketing Spend + Market Labor Cost + Sales Pay) / Net GMV
        const roi2 = totalNetGmv > 0 ? (((totalMarketingSpend + marketCost + totalCommission + totalFixedSalary) / totalNetGmv) * 100).toFixed(2) : '0.00';

        // Update UI
        totalPeopleDisplay.textContent = totalPeople;
        weightedRoiDisplay.textContent = weightedRoi;
        totalNetGmvDisplay.textContent = formatCurrency(totalNetGmv);
        grossProfitDisplay.textContent = formatCurrency(grossProfit);
        totalMarketingSpendDisplay.textContent = formatCurrency(totalMarketingSpend);
        marketLaborCostDisplay.textContent = formatCurrency(marketCost);
        salesFixedSalaryDisplay.textContent = formatCurrency(totalFixedSalary);
        totalCommissionDisplay.textContent = formatCurrency(totalCommission);

        roi1Display.textContent = roi1;
        roi2Display.textContent = roi2 + '%';
        salesCommRateDisplay.textContent = salesCommRate + '%';
        salesCostRateDisplay.textContent = salesCostRate + '%';
        remainingProfitDisplay.textContent = formatCurrency(remainingProfit);

        // Update Row Stats UI
        rowStats.forEach((stat, index) => {
            const cell = document.getElementById(`row-total-${index}`);
            if (cell) {
                const avgGmv = stat.people > 0 ? (stat.gmvSum / stat.people / 10000).toFixed(1) : '0';
                cell.querySelector('.people').textContent = stat.people;
                cell.querySelector('.gmv').textContent = avgGmv + '万';
            }
        });

        // Update Col Stats UI
        colStats.forEach((stat, index) => {
            const cell = document.getElementById(`col-total-${index}`);
            if (cell) {
                const avgRoi = stat.people > 0 ? (stat.roiSum / stat.people).toFixed(2) : '0';
                cell.querySelector('.people').textContent = stat.people;
                cell.querySelector('.roi').textContent = avgRoi;
            }
        });

        // Update Grand Total UI
        const grandTotalEl = document.getElementById('grand-total');
        if (grandTotalEl) {
            grandTotalEl.querySelector('.people').textContent = totalPeople;
        }
    }

    // Event Listeners
    calculateBtn.addEventListener('click', calculate);
    marginInput.addEventListener('change', calculate);
    marketCostInput.addEventListener('change', calculate);
    baseSalaryInput.addEventListener('change', calculate);
    addColBtn.addEventListener('click', addColumn);
    addRowBtn.addEventListener('click', addRow);

    initMatrix();
});
