// for ObsRainRunoff.html
// 2025-09-23
// 2025-09-24
// code with GEMINI Code Assist

import { ReadData } from "./js/ReadData.js";
import { ReadResInflow } from "./js/ReadResInflow.js";
import { Chart2 } from "./js/Chart2.js";
import { RunoffCoeff } from "./js/RunoffCoeff.js";
import { Utils } from "./js/utils.js";
import { runTankModel } from "./js/TankModel.js";
import { Rprop } from "./js/Rprop.js";
import { tankpm as defaultTankParams } from "./js/05_tankpm.js";

"use strict";

//-----Global
let TimeInterv = 3600.0; // seconds
//-----

/**
 * 取出指定key的資料，轉換資料格式提供降雨逕流繪圖元件使用
 * @param {{AreaNo:string, ObsTime:Date, Value:number}[]} RainData 
 * @param {{AreaNo:string, ObsTime:Date, Value:number}[]} ResInfData 
 * @returns {{DateTime:string[], Rain:number[], Runoff:number[]}} 繪圖元件所需的資料格式
 */
function ToChartData(RainData, ResInfData) {
    // console.log(data);
    let res = {};

    let d = [];
    let r = [];
    let runoff = [];

    for (let i = 0; i < RainData.length; i++) {
        // 轉換為字串
        let s = Utils.DateToYYYYMMDDHHMM_Dash(RainData[i].ObsTime);
        d.push(s);
        r.push(RainData[i].Value);
        // 觀測流量(CMS)
        try {
            runoff.push(ResInfData[i].Value);
        } catch {
            runoff.push(-1)
        }
    }
    // {DateTime:string[], Rain:number[], Runoff:number[]}
    res['DateTime'] = d;
    res['Rain'] = r;
    res['Runoff'] = runoff;
    return res;
}

/**
 * (未使用) 根據鍵值產生 HTML select options
 * @param {string[]} Keys - e.g., ["key1$label1", "key2$label2"]
 * @returns {string} HTML <option> 字串
 */
function GenOptions(Keys) {
    let options = "";
    Keys.forEach(x => {
        let s = x.split('$');
        options += `<option value=${x}>${s[0]}</option>`;
    });
    return options;
}

/**
 * 降雨逕流繪圖元件入口
 * @param {{DateTime:string[], Rain:number[], Runoff:number[], SimulatedRunoff?: number[]}} PlotData 繪圖元件所需的資料
 * @param {string} ResId 水庫ID
 */
function DrawChart(PlotData, ResId) {
    // console.log(PlotData);
    const BasinArea = ReservoirDict[ResId].BasinArea;

    // 繪製降雨逕流歷線圖
    let chart2 = new Chart2(PlotData, "#Chart_Hydrograph", 60, BasinArea);
    chart2.plotRainfallRunoff();
    chart2.ShowSubResultsTable();

    // --- 更新模擬結果摘要表格 ---
    const summaryContainer = document.getElementById("simulation-summary-container");
    const summaryTableBody = document.getElementById("simulation-summary-table-body");
    if (!summaryContainer || !summaryTableBody) return chart2;

    summaryTableBody.innerHTML = ''; // 清空舊內容

    if (BasinArea === undefined){
        console.error(`DrawChart(),集水區面積不可為undefined!`)
        return chart2;
    }

    const obsRunoffCoeff = RunoffCoeff(BasinArea, PlotData.Rain, PlotData.Runoff, TimeInterv);

    // 建立一個指標陣列，方便管理和生成表格
    const metrics = [
        // { label: '觀測逕流係數', value: obsRunoffCoeff, format: (v) => v.toFixed(3) },
        // { label: '模擬逕流係數', value: chart2.simRunoffCoeff, format: (v) => v.toFixed(3) },
        { label: '納什效率係數 (NSE)', value: chart2.nse, format: (v) => v.toFixed(3) },
        { label: '均方根誤差 (RMSE)', value: chart2.rmse, format: (v) => v.toFixed(3) + ' cms' },
        { label: '總量體積誤差', value: chart2.volumeError, format: (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + ' %' },
        { label: '尖峰流量誤差', value: chart2.peakFlowError, format: (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + ' %' },
        { label: '尖峰時間差', value: chart2.timeToPeakError, format: (v) => (v >= 0 ? '+' : '') + v.toFixed(1) + ' hr' },
    ];

    let tableHtml = '';
    let hasSimulatedData = false;

    metrics.forEach(metric => {
        if (metric.value !== null && metric.value !== undefined) {
            if (['納什', '均方根', '總量', '尖峰'].some(k => metric.label.includes(k))) {
                hasSimulatedData = true;
            }
            tableHtml += `
                <tr>
                    <th class="text-nowrap" style="width: 150px;">${metric.label}</th>
                    <td>${metric.format(metric.value)}</td>
                </tr>
            `;
        }
    });

    const summaryFooter = document.getElementById('chart-summary');

    // --- 更新圖表註腳 ---
    let footerHtml = `<span>觀測逕流係數=${obsRunoffCoeff.toFixed(2)}</span>`;
    if (chart2.simRunoffCoeff !== null) {
        footerHtml += `<span class="ms-3">模擬逕流係數=${chart2.simRunoffCoeff.toFixed(2)}</span>`;
    }

    // 如果有模擬資料，才顯示整個摘要區塊
    if (hasSimulatedData) {
        summaryTableBody.innerHTML = tableHtml;
        summaryContainer.style.display = 'block';
    } else {
        summaryContainer.style.display = 'none';
    }

    if (summaryFooter) {
        summaryFooter.innerHTML = footerHtml;
    }

    // 根據 checkbox 狀態顯示或隱藏摘要圖層
    const showOverlay = document.getElementById('toggle-summary-overlay').checked;
    chart2.displaySummaryOverlay(showOverlay);

    return chart2;
}
/**
 * 過濾取得指定日期時間區間的資料
 * @param {*} data 
 * @param {({AreaNo:string, ObsTime:Date, Value:number})[]} data 
 * @param {string} startDateStr 開始日期字串
 * @param {string} endDateStr 結束日期字串
 * @returns {({AreaNo:string, ObsTime:Date, Value:number})[]} 過濾後的資料
 */
function GetDataByDate(data, startDateStr, endDateStr) {
    // console.log({startDateStr})
    // console.log({endDateStr})
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    const startTime = startDate.getTime();
    const endTime = endDate.getTime();

    const filteredData = data.filter(item => {
        const itemTime = (item.ObsTime instanceof Date) ? item.ObsTime.getTime() : new Date(item.ObsTime).getTime();
        return (itemTime >= startTime && itemTime < endTime);
    });
    return filteredData;
}

/** 水庫名稱與子集水區編號、集水區面積(平方公里) */
let ReservoirDict = {
    "RFETS": {
        AreaNo: "09",
        BasinArea: 303
    },
    "RSHME": {
        AreaNo:"05",
        BasinArea: 756
    }
};

/**
 * 讀取集水區平均雨量以及水庫入流量時間序列
 * @param {string} year 西元年
 * @param {string} ResId 水庫名稱, ex. "RFETS", "RSHME"
 * @returns {Promise<{rain: any[], runoff: any[]} | null>} 包含雨量和逕流資料的物件，或在失敗時回傳 null
 */
async function ReadDataFromURL(year, ResId) {
    if (ResId === undefined) {
        console.error(`ReadDataFromURL(),缺少水庫名稱!,ResId=${ResId}`);
        return null;
    }
    console.log("---讀取時間序列,year=", year, " ResId=", ResId);
    try {
        const AreaNo = ReservoirDict[ResId].AreaNo;
        // console.log({ AreaNo });
        if (AreaNo === undefined) {
            console.error(`ReadDataFromURL(),找不到水庫集水區名稱!,ResId=${ResId}`);
            return null;
        }
        const RainDataURL = `./data/${year}/${AreaNo}_TimeSeries.txt`;
        // Reservoir Inflow Data
        const ResInfDataURL = `./data/${year}/${ResId}_TimeSeries.txt`;

        // Use Promise.all to fetch both files concurrently
        const [rain, runoff] = await Promise.all([
            ReadData(RainDataURL),
            ReadResInflow(ResInfDataURL)
        ]);

        return { rain, runoff };
    } catch (e) {
        console.error(`ReadDataFromURL(),error=${e}`);
        return null;
    }
}

/**
 * 對逕流量數據進行線性內插，補上小於0的缺值。
 * 如果一個缺值區塊的兩端都有有效值，則在兩點間進行線性內插。
 * 如果只在單側有有效值（發生在資料序列的起點或終點），則用最近的有效值填充。
 * @param {({AreaNo:string, ObsTime:Date, Value:number})[]} runoffData 原始逕流資料
 * @returns {{interpolatedData: ({AreaNo:string, ObsTime:Date, Value:number})[], count: number}} 包含內插後資料和計數的物件
 */
const interpolateRunoff = (runoffData) => {
    if (!runoffData || runoffData.length === 0) {
        return { interpolatedData: [], count: 0 };
    }

    let interpolatedCount = 0;
    // 進行深拷貝以避免修改原始數據，並確保Date物件被正確還原
    const data = JSON.parse(JSON.stringify(runoffData)).map(d => ({...d, ObsTime: new Date(d.ObsTime)}));
    const n = data.length;
    let i = 0;

    while (i < n) {
        if (data[i].Value < 0) {
            const startIndex = i;
            let endIndex = i;
            while (endIndex + 1 < n && data[endIndex + 1].Value < 0) {
                endIndex++;
            }
            interpolatedCount += (endIndex - startIndex + 1);

            let prevIndex = -1;
            for (let j = startIndex - 1; j >= 0; j--) {
                if (data[j].Value >= 0) {
                    prevIndex = j;
                    break;
                }
            }

            let nextIndex = -1;
            for (let j = endIndex + 1; j < n; j++) {
                if (data[j].Value >= 0) {
                    nextIndex = j;
                    break;
                }
            }

            if (prevIndex !== -1 && nextIndex !== -1) {
                const prevPoint = data[prevIndex];
                const nextPoint = data[nextIndex];
                const prevTime = prevPoint.ObsTime.getTime();
                const nextTime = nextPoint.ObsTime.getTime();
                const prevValue = prevPoint.Value;
                const nextValue = nextPoint.Value;

                if (nextTime > prevTime) {
                    for (let k = startIndex; k <= endIndex; k++) {
                        const currentTime = data[k].ObsTime.getTime();
                        const interpolatedValue = prevValue + (currentTime - prevTime) * (nextValue - prevValue) / (nextTime - prevTime);
                        data[k].Value = interpolatedValue;
                    }
                } else {
                    for (let k = startIndex; k <= endIndex; k++) {
                        data[k].Value = prevValue;
                    }
                }
            } else {
                const fillValue = prevIndex !== -1 ? data[prevIndex].Value : (nextIndex !== -1 ? data[nextIndex].Value : 0);
                for (let k = startIndex; k <= endIndex; k++) {
                    data[k].Value = fillValue;
                }
            }
            i = endIndex + 1;
        } else {
            i++;
        }
    }
    return { interpolatedData: data, count: interpolatedCount };
};

// ------------------------------------------- start here ----------------------------------
/**
 * 頁面載入完成後執行的主要邏輯
 */
window.onload = () => {
    const dataCache = {};
    let currentChart = null;
    let currentDisplayData = null; // 用於儲存當前圖表上的資料
    let originalDataBeforeEdit = null; // 用於儲存編輯前的資料備份
    let calibrationHistory = []; // 用於儲存自動校正歷程
    let selectedObjectiveFunction = 'RMSE'; // Default objective function

    const TANK_PARAMS_KEY = 'tankModelUserParams';

    /**
     * 載入水筒模式參數，若 localStorage 中無設定則使用預設值
     */
    const loadTankParams = () => {
        try {
            const storedParams = localStorage.getItem(TANK_PARAMS_KEY);
            if (storedParams) {
                const parsed = JSON.parse(storedParams);
                // 合併預設值以防舊的儲存格式缺少某些鍵
                return { ...defaultTankParams, ...parsed };
            }
        } catch (e) {
            console.error("無法從 localStorage 載入水筒模式參數:", e);
        }
        return { ...defaultTankParams }; // Return a copy
    };

    // 用於儲存當前有效的水筒模式參數
    let activeTankParams = loadTankParams();

    /**
     * 儲存水筒模式參數至 localStorage
     */
    const saveTankParams = (paramsToSave) => {
        try {
            localStorage.setItem(TANK_PARAMS_KEY, JSON.stringify(paramsToSave));
            activeTankParams = paramsToSave; // 更新當前有效的參數
        } catch (e) {
            console.error("無法儲存水筒模式參數至 localStorage:", e);
        }
    };

    const RPROP_SETTINGS_KEY = 'tankModelRpropSettings';
    const RPROP_DEFAULTS = {
        maxIter: 100,
        initialStep: 0.1,
        minFChange: 1e-7,
        minF: 1e-6,
    };

    /**
     * 載入 RPROP 設定，若 localStorage 中無設定則使用預設值
     */
    const loadRpropSettings = () => {
        try {
            const storedSettings = localStorage.getItem(RPROP_SETTINGS_KEY);
            if (storedSettings) {
                const parsed = JSON.parse(storedSettings);
                // 合併預設值以防舊的儲存格式缺少某些鍵
                return { ...RPROP_DEFAULTS, ...parsed };
            }
        } catch (e) {
            console.error("無法從 localStorage 載入 RPROP 設定:", e);
        }
        return { ...RPROP_DEFAULTS }; // Return a copy
    };

    // RPROP 校正參數設定
    let rpropSettings = loadRpropSettings();

    /**
     * 儲存 RPROP 設定至 localStorage
     */
    const saveRpropSettings = () => {
        try {
            localStorage.setItem(RPROP_SETTINGS_KEY, JSON.stringify(rpropSettings));
        } catch (e) {
            console.error("無法儲存 RPROP 設定至 localStorage:", e);
        }
    };

    // 將參數設定移至此處，以便在多個函式中共用
    const paramConfig = {
        id: { label: "水庫ID", editable: false, description: "水庫的唯一識別碼" },
        code: { label: "代碼", editable: false, description: "水庫的代碼" },
        cname: { label: "名稱", editable: false, description: "水庫的中文名稱" },
        area: { label: "面積 (km²)", editable: false, description: "集水區面積 (平方公里)" },
        h1: { label: "h1 (mm)", editable: true, keyLabel: 'h1', min: 50, max: 200, description: "上層水筒第一個出水口高度，控制表面逕流。" },
        h2: { label: "h2 (mm)", editable: true, keyLabel: 'h2', min: 10, max: 100, description: "上層水筒第二個出水口高度，控制中間流。" },
        a1: { label: "a1", editable: true, keyLabel: 'a1', min: 0, max: 1, step: 0.01, description: "上層水筒第一個出水口的流出係數。" },
        a2: { label: "a2", editable: true, keyLabel: 'a2', min: 0, max: 1, step: 0.01, description: "上層水筒第二個出水口的流出係數。" },
        a3: { label: "a3", editable: true, keyLabel: 'a3', min: 0, max: 1, step: 0.01, description: "上層水筒滲漏至下層水筒的滲漏係數。" },
        h3: { label: "h3 (mm)", editable: true, keyLabel: 'h3', min: 5, max: 20, description: "下層水筒第一個出水口高度，控制地下水出流。" },
        b1: { label: "b1", editable: true, keyLabel: 'b1', min: 0, max: 1, step: 0.01, description: "下層水筒第一個出水口的流出係數。" },
        b2: { label: "b2", editable: true, keyLabel: 'b2', min: 0, max: 1, step: 0.01, description: "下層水筒第二個出水口的流出係數。" },
        b3: { label: "b3", editable: true, keyLabel: 'b3', min: 0, max: 1, step: 0.01, description: "下層水筒滲漏至深層地下水的滲漏係數 (損失)。" },
        HTank1: { label: "上層初始水位 (mm)", editable: true, keyLabel: 'H1', min: 1, max: 50, description: "模擬開始時，上層水筒的初始水深。" },
        HTank2: { label: "下層初始水位 (mm)", editable: true, keyLabel: 'H2', min: 1, max: 50, description: "模擬開始時，下層水筒的初始水深。" },
    };

    /**
     * 顯示水筒模式參數
     * @param {object} params - The tank model parameters object.
     */
    const displayTankParameters = (params) => {
        const container = document.getElementById('tank-parameters-container');
        const contentDiv = document.getElementById('tank-parameters-content');
        if (!contentDiv || !container) return;

        let html = '';

        for (const key in paramConfig) {
            if (Object.hasOwnProperty.call(params, key)) {
                const config = paramConfig[key];
                const value = params[key];
                const title = config.description || config.label;
                
                if (!config.editable) {
                    html += `<div class="col"><div class="p-2 border bg-white rounded" title="${title}"><small class="text-muted d-block">${config.label}</small><strong class="d-block">${value}</strong></div></div>`;
                } else {
                    const min = config.min !== undefined ? `min="${config.min}"` : '';
                    const max = config.max !== undefined ? `max="${config.max}"` : '';
                    const step = config.step !== undefined ? `step="${config.step}"` : 'step="any"';
                    // 將可編輯參數的數值格式化到小數點下四位
                    const formattedValue = Number(value).toFixed(4);
                    html += `
                        <div class="col">
                            <div class="input-group input-group-sm" title="${title}">
                                <span class="input-group-text" style="width: 45px; font-size: 0.8em; justify-content: center;">${config.keyLabel}</span>
                                <input type="number" class="form-control" id="param-${key}" value="${formattedValue}" ${step} ${min} ${max}>
                            </div>
                        </div>`;
                }
            }
        }

        contentDiv.innerHTML = html;
        container.style.display = 'block';
    };

    /**
     * 根據年份和水庫ID獲取資料，如果快取中沒有，則從伺服器讀取。
     */
    const fetchAndCacheData = async (newYear, newResId) => {
        const cacheKey = `${newYear}-${newResId}`;

        if (dataCache[cacheKey]) {
            console.log(`Using cached data for ${cacheKey}`);
            return dataCache[cacheKey];
        } else {
            // Show loading indicator
            document.getElementById('Chart_Hydrograph').innerHTML = `
                <div class="d-flex justify-content-center align-items-center h-100">
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Loading...</span>
                    </div>
                    <strong class="ms-2">讀取中...</strong>
                </div>`;
            document.getElementById('chart-summary').innerHTML = '';
            document.getElementById('data-table-body').innerHTML = '';

            const fetchedData = await ReadDataFromURL(newYear, newResId);
            if (!fetchedData) {
                // Show error message in chart area
                document.getElementById('Chart_Hydrograph').innerHTML = '<p class="text-danger text-center">無法讀取資料，請確認檔案是否存在。</p>';
                document.getElementById('chart-summary').innerHTML = '';
                document.getElementById('data-table-body').innerHTML = '<tr><td colspan="3" class="text-center text-danger">資料讀取失敗</td></tr>';
                return null;
            }

            // 對水庫入流量資料進行內插，處理小於0的缺值
            if (fetchedData.runoff) {
                // 儲存一份原始逕流資料，用於後續計算顯示範圍內的缺值數量
                fetchedData.originalRunoff = JSON.parse(JSON.stringify(fetchedData.runoff));
                const { interpolatedData, count } = interpolateRunoff(fetchedData.runoff);
                fetchedData.runoff = interpolatedData;
                // 全年總數不再需要儲存於此
            }
            dataCache[cacheKey] = fetchedData;
            console.log(`Fetched and cached data for ${cacheKey}`);
            return fetchedData;
        }
    };

    /**
     * 使用提供的資料繪製圖表
     */
    const drawChartWithData = (fullYearData, startDateStr, newResId, highlightEvent = null) => {
        const days = document.getElementById('days').value;
        const startDate = new Date(startDateStr);
        const enddate = Utils.addHours(startDate, days * 24);
        const endDateStr = Utils.DateToYYYYMMDDHHMM_Dash(enddate);

        // Reset chart title for new data display
        const chartTitle = document.getElementById('chart-title-text');
        if (chartTitle) {
            chartTitle.textContent = '集水區降雨逕流與觀測流量歷線圖';
        }

        // 從完整資料中清除舊的模擬結果，以防日期變更後殘留
        if (fullYearData.SimulatedRunoff) {
            delete fullYearData.SimulatedRunoff;
        }

        // 過濾取得指定日期+日數的資料
        const monthRainData = GetDataByDate(fullYearData.rain, startDateStr, endDateStr);
        const monthResInfData = GetDataByDate(fullYearData.runoff, startDateStr, endDateStr);

        const ChartData = ToChartData(monthRainData, monthResInfData);
        // 繪圖
        currentDisplayData = ChartData;
        currentChart = DrawChart(currentDisplayData, newResId);

        // 從原始(未內插)的資料中，計算當前顯示範圍內有多少筆缺值(<0)
        let interpolatedCount = 0;
        if (fullYearData.originalRunoff) {
            const originalRunoffInWindow = GetDataByDate(fullYearData.originalRunoff, startDateStr, endDateStr);
            interpolatedCount = originalRunoffInWindow.filter(item => item.Value < 0).length;
        }

        if (interpolatedCount > 0) {
            $("#chart-summary").append(`<div class="ms-3 text-muted fw-normal"> (內插補齊 ${interpolatedCount} 筆資料)</div>`);
        }

        // 如果有指定要高亮的事件，則在圖表上標示出來
        if (highlightEvent && currentChart) {
            const runoffSeries = currentChart.plot.getData()[0]; // 流量是第一個 series

            // 將要高亮的事件時間轉換為圖表資料中使用的字串格式
            const targetDateTimeStr = Utils.DateToYYYYMMDDHHMM_Dash(highlightEvent.ObsTime);

            // 在當前顯示的資料中找到該點的索引
            const pointIndex = ChartData.DateTime.findIndex(dt => dt === targetDateTimeStr);

            if (pointIndex !== -1) {
                currentChart.plot.unhighlight(); // 清除先前的高亮
                currentChart.plot.highlight(runoffSeries, pointIndex);
            }
        }
    };

    /**
     * 執行水筒模式模擬並更新圖表與表格
     */
    const runAndDrawSimulation = (title) => {
        if (!currentDisplayData || !currentDisplayData.Rain || currentDisplayData.Rain.length === 0) {
            alert("請先載入降雨資料。");
            return;
        }

        // Set chart title for simulation
        const chartTitle = document.getElementById('chart-title-text');
        if (chartTitle) {
            const newTitle = (typeof title === 'string' && title) ? title : '水筒模式模擬結果圖';
            chartTitle.textContent = newTitle;
        }

        // 從介面讀取當前的水筒模式參數
        const currentTankParams = { ...activeTankParams }; // 從當前有效參數複製一份
        const editableParams = ['h1', 'h2', 'a1', 'a2', 'a3', 'h3', 'b1', 'b2', 'b3', 'HTank1', 'HTank2'];

        let allParamsValid = true;
        editableParams.forEach(key => {
            const inputElement = document.getElementById(`param-${key}`);
            if (inputElement) {
                const value = parseFloat(inputElement.value);
                if (!isNaN(value)) {
                    currentTankParams[key] = value;
                } else {
                    allParamsValid = false;
                    showToast(`參數 "${paramConfig[key].keyLabel}" 的值無效，請檢查。`, '輸入錯誤', 'danger');
                }
            }
        });

        if (!allParamsValid) {
            return; // 如果有參數無效，則中止執行
        }

        // 使用更新後的參數執行水筒模式模擬
        const simulatedRunoff = runTankModel(currentDisplayData.Rain, currentTankParams, TimeInterv);

        // 將模擬資料加入到當前顯示資料中
        currentDisplayData.SimulatedRunoff = simulatedRunoff;

        // 使用新資料重新繪製圖表 (DrawChart 內部會更新表格)
        const resId = "RSHME";
        currentChart = DrawChart(currentDisplayData, resId);
    };

    /**
     * 顯示 Toast 訊息
     * @param {string} message - 訊息內容
     * @param {string} title - 標題
     * @param {string} [level='info'] - 訊息等級 ('success', 'danger', 'warning', 'info')
     */
    const showToast = (message, title, level = 'info') => {
        const toastContainer = document.getElementById('toast-container');
        if (!toastContainer) return;

        const toastId = 'toast-' + Date.now();
        const headerClass = {
            'success': 'bg-success text-white',
            'danger': 'bg-danger text-white',
            'warning': 'bg-warning text-dark',
            'info': 'bg-info text-dark'
        }[level];

        const toastHtml = `
            <div id="${toastId}" class="toast" role="alert" aria-live="assertive" aria-atomic="true">
                <div class="toast-header ${headerClass}">
                    <strong class="me-auto">${title}</strong>
                    <small>現在</small>
                    <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
                </div>
                <div class="toast-body">
                    ${message}
                </div>
            </div>
        `;
        
        toastContainer.insertAdjacentHTML('beforeend', toastHtml);
        
        const toastElement = document.getElementById(toastId);
        const toast = new bootstrap.Toast(toastElement, { delay: 5000 });
        toast.show();
        
        toastElement.addEventListener('hidden.bs.toast', () => {
            toastElement.remove();
        });
    };

    /**
     * 從 UI 讀取當前參數並進行驗證
     * @returns {object|null} 參數物件，或在驗證失敗時返回 null
     */
    const getCurrentParamsFromUI = () => {
        const currentParams = { ...activeTankParams };
        const editableParamKeys = Object.keys(paramConfig).filter(k => paramConfig[k].editable);
        
        for (const key of editableParamKeys) {
            const inputElement = document.getElementById(`param-${key}`);
            if (inputElement) {
                const value = parseFloat(inputElement.value);
                if (isNaN(value)) {
                    alert(`參數 "${key}" 的值無效，請檢查。`);
                    return null;
                }
                currentParams[key] = value;
            }
        }
        return currentParams;
    };

    /**
     * 將參數物件下載為 JSON 檔案
     * @param {object} paramsToDownload 
     */
    const downloadParamsAsJson = (paramsToDownload) => {
        // 產生 JSON 字串 (pretty print)
        const jsonString = JSON.stringify(paramsToDownload, null, 2);

        // 建立 Blob 並觸發下載
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "tank_parameters.json");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    /**
     * 繪製校正歷程的收斂圖
     */
    const drawConvergenceChart = () => {
        if (!calibrationHistory || calibrationHistory.length === 0) {
            document.getElementById('Chart_Convergence').innerHTML = '<p class="text-center">沒有收斂歷程資料可供繪製。</p>';
            return;
        }

        // --- 準備繪圖資料 ---
        const objectiveData = [];
        const nseData = [];
        const changeData = [];
        
        let objFuncLabelForAxis;
        let objFuncLabelForSeries;

        // 根據選擇的目標函數，設定圖表的標籤
        if (selectedObjectiveFunction === 'NSE') {
            objFuncLabelForAxis = "目標函數 ((1-NSE)²) ";
            objFuncLabelForSeries = "目標函數 ((1-NSE)²) ";
        } else {
            objFuncLabelForAxis = `目標函數 (${selectedObjectiveFunction})`;
            objFuncLabelForSeries = `目標函數 (${selectedObjectiveFunction})`;
        }

        calibrationHistory.forEach(record => {
            if (typeof record.iteration !== 'number') return;

            // 1. 準備目標函數資料 (給左邊的對數 Y 軸)
            let objValueForPlot;
            if (selectedObjectiveFunction === 'NSE') {
                // 若目標是 NSE，繪製 (1-NSE)²，這是實際被最小化的值
                if (typeof record.nse === 'number') {
                    objValueForPlot = Math.pow(1 - record.nse, 2);
                }
            } else {
                // 其他目標函數，直接使用紀錄的值
                objValueForPlot = record.objective_function;
            }
            // 對數軸不接受 <= 0 的值，用一個極小值過濾
            if (typeof objValueForPlot === 'number') {
                objectiveData.push([record.iteration, objValueForPlot]);
            }

            // 2. 準備 NSE 資料 (給右邊的線性 Y 軸)
            if (typeof record.nse === 'number') {
                nseData.push([record.iteration, record.nse]);
            }

            // 3. 準備變化量資料 (給左邊的對數 Y 軸)
            if (typeof record.change === 'number') {
                changeData.push([record.iteration, record.change]);
            }
        });

        const dataset = [
            {
                label: objFuncLabelForSeries,
                data: objectiveData,
                color: "#ff0000", // Red
                yaxis: 1,
                lines: { show: true },
                points: { show: true }
            },
            {
                label: "目標函數變化量",
                data: changeData,
                color: "#f28c44", // Orange
                yaxis: 1,
                lines: { show: true, lineWidth: 1.5, dashes: [2, 2] },
                points: { show: true, radius: 2 }
            },
            {
                label: "NSE",
                data: nseData,
                color: "#0033ff", // Blue
                yaxis: 2,
                lines: { show: true, lineWidth: 1, dashes: [5, 5] },
                points: { show: true, radius: 2 }
            }
        ];

        const options = {
            xaxis: {
                axisLabel: "疊代次數",
            },
            yaxes: [
                { 
                    position: "left", 
                    axisLabel: objFuncLabelForAxis, 
                    axisLabelUseCanvas: true, 
                    axisLabelFontSizePixels: 12, 
                    axisLabelFontFamily: "Verdana, Arial", 
                    axisLabelPadding: 10
                },
                { position: "right", axisLabel: "NSE", axisLabelUseCanvas: true, axisLabelFontSizePixels: 12, axisLabelFontFamily: "Verdana, Arial", axisLabelPadding: 5 }
            ],
            grid: {
                hoverable: true,
                clickable: true,
                backgroundColor: { colors: ["#fff", "#f0f0f0"] }
            },
            legend: {
                show: true,
                noColumns: 3, // 將圖例項目排成 3 欄
                position: "ne", // 放置在右上角
                margin: [10, -22] // [x, y] margin, 負 y 值會將圖例向上移動
            },
            tooltip: true,
            tooltipOpts: {
                content: function(label, xval, yval, flotItem) {
                    // 使用疊代次數 (xval) 來找到對應的歷史紀錄，更為可靠
                    const record = calibrationHistory.find(r => r.iteration === xval);
                    if (!record) {
                        return `疊代 ${xval}: ${label} = ${yval.toExponential(4)}`;
                    }

                    // 取得所有可編輯參數的鍵
                    const editableParamKeys = Object.keys(paramConfig).filter(k => paramConfig[k].editable);

                    let paramsHtml = '<table class="table table-sm table-borderless table-hover mb-0 small">';
                    editableParamKeys.forEach(key => {
                        const value = record[key];
                        if (value !== undefined) {
                            paramsHtml += `<tr><td>${paramConfig[key].keyLabel || key}:</td><td class="text-end">${Number(value).toFixed(4)}</td></tr>`;
                        }
                    });
                    paramsHtml += '</table>';

                    // 根據系列決定數值格式
                    let yval_str;
                    if (label === 'NSE') {
                        yval_str = yval.toFixed(4);
                    } else {
                        yval_str = yval.toExponential(4);
                    }
                    const header = `<strong>疊代 ${record.iteration}</strong><br/>${label}: ${yval_str}<hr class="my-1"/>`;
                    
                    return `<div class="p-1" style="min-width: 180px;">${header}${paramsHtml}</div>`;
                }
            }
        };

        $.plot("#Chart_Convergence", dataset, options);
    };

    // --- Data Editing Handlers (Moved Up) ---
    const editDataBtn = document.getElementById('edit-data-btn');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const dataTableBody = document.getElementById('data-table-body');
    let isEditing = false;

    const enterEditMode = () => {
        if (!currentDisplayData) return;
        isEditing = true;
        // 備份當前資料
        originalDataBeforeEdit = JSON.parse(JSON.stringify(currentDisplayData));

        editDataBtn.textContent = '儲存編輯';
        editDataBtn.classList.replace('btn-warning', 'btn-success');
        cancelEditBtn.style.display = 'inline-block';

        const rows = dataTableBody.getElementsByTagName('tr');
        for (const row of rows) {
            // 讓雨量和流量欄位可編輯
            if (row.cells[1]) row.cells[1].contentEditable = 'true';
            if (row.cells[2]) row.cells[2].contentEditable = 'true';
        }
        dataTableBody.parentElement.classList.add('table-editing');
        showToast('表格編輯已啟用。', '編輯模式', 'info');
    };

    const exitEditMode = (saveChanges = false) => {
        if (!isEditing) return;

        if (saveChanges) {
            try {
                const rows = dataTableBody.getElementsByTagName('tr');
                for (let i = 0; i < rows.length; i++) {
                    const rainValue = parseFloat(rows[i].cells[1].textContent);
                    const runoffValue = parseFloat(rows[i].cells[2].textContent);

                    if (!isNaN(rainValue)) currentDisplayData.Rain[i] = rainValue;
                    if (!isNaN(runoffValue)) currentDisplayData.Runoff[i] = runoffValue;
                }
                // 重新繪製圖表以反映變更
                const resId = "RSHME";
                currentChart = DrawChart(currentDisplayData, resId);
                showToast('資料已更新。', '儲存成功', 'success');
            } catch (error) {
                console.error("儲存編輯時發生錯誤:", error);
                showToast('儲存失敗，請檢查輸入的資料格式。', '錯誤', 'danger');
                // 如果儲存失敗，還原資料
                currentDisplayData = originalDataBeforeEdit;
            }
        } else {
            // 取消編輯，還原資料
            if (originalDataBeforeEdit) {
                currentDisplayData = originalDataBeforeEdit;
                currentChart = DrawChart(currentDisplayData, "RSHME"); // 重新繪製以還原
                showToast('編輯已取消。', '提示', 'info');
            }
        }

        isEditing = false;
        originalDataBeforeEdit = null;
        editDataBtn.textContent = '編輯資料';
        editDataBtn.classList.replace('btn-success', 'btn-warning');
        cancelEditBtn.style.display = 'none';
        dataTableBody.parentElement.classList.remove('table-editing');
    };
    
    const redraw = async () => {
        const startDateStr = document.getElementById("obs-date").value;
        const newResId = "RSHME";
        const newYear = startDateStr.substring(0, 4);

        exitEditMode(false); // 如果正在編輯，則取消編輯模式
        // 清空舊的摘要和圖表註腳
        document.getElementById('simulation-summary-container').style.display = 'none';
        document.getElementById('chart-summary').innerHTML = '';

        const fullYearData = await fetchAndCacheData(newYear, newResId);
        if (fullYearData) {
            drawChartWithData(fullYearData, startDateStr, newResId);
        }
    };

    // Initial draw
    // 顯示水筒模式參數 (從 localStorage 或預設值載入)
    displayTankParameters(activeTankParams);
    // 初始繪圖
    redraw();

    // Event handlers
    document.getElementById("obs-date").onchange = redraw;
    document.getElementById("days").onchange = redraw;

    document.getElementById("run-tank-model-btn").addEventListener('click', runAndDrawSimulation);

    document.getElementById("autocal-btn").addEventListener('click', async () => {
        // 1. 檢查資料是否已載入
        if (!currentDisplayData || !currentDisplayData.Rain || currentDisplayData.Rain.length === 0) {
            showToast("請先載入降雨與流量資料以進行校正。", "提示", "warning");
            return;
        }

        // showToast("自動校正已開始，請稍候...", "通知", "info");

        // 2. 顯示讀取中指示
        const autocalBtn = document.getElementById("autocal-btn");
        const otherButtons = ["run-tank-model-btn", "reset-tank-params-btn", "save-tank-params-btn", "download-tank-params-btn"];
        const loadLabel = document.querySelector('label[for="load-tank-params-input"]');

        // 每次校正開始前，清空舊的歷程並隱藏下載按鈕
        calibrationHistory = [];
        document.getElementById("convergence-chart-container").style.display = 'none';
        document.getElementById("download-calib-history-btn").style.display = 'none';
        autocalBtn.disabled = true;
        autocalBtn.textContent = '校正中...';
        otherButtons.forEach(id => document.getElementById(id).disabled = true);
        if (loadLabel) loadLabel.classList.add('disabled');

        // 顯示並重設進度條
        const progressContainer = document.getElementById("autocal-progress-container");
        const progressBar = document.getElementById("autocal-progress-bar");
        const progressText = document.getElementById("autocal-progress-text");
        
        progressContainer.style.display = 'block';
        progressBar.style.width = '0%';
        progressBar.setAttribute('aria-valuenow', 0);
        progressBar.textContent = '0%';
        progressText.textContent = '準備開始校正...';

        try {
            // 宣告一個變數來暫存每次疊代的模擬結果，以便在 onProgress 中計算額外的指標
            let lastSimulatedRunoffForHistory = [];

            // 3. 收集目前的參數與其上下限，作為 RPROP 演算法的初始值
            const editableParamKeys = ['h1', 'h2', 'a1', 'a2', 'a3', 'h3', 'b1', 'b2', 'b3', 'HTank1', 'HTank2'];
            const initialParamsArray = [];
            const paramMins = [];
            const paramMaxs = [];

            editableParamKeys.forEach(key => {
                const inputElement = document.getElementById(`param-${key}`);
                initialParamsArray.push(parseFloat(inputElement.value));
                paramMins.push(paramConfig[key].min);
                paramMaxs.push(paramConfig[key].max);
            });

            // 4. 定義 RPROP 的目標函數
            const objectiveFunction = (paramsArray) => {
                // 從陣列建立參數物件
                const currentParams = { ...activeTankParams }; // 從當前有效參數開始
                editableParamKeys.forEach((key, index) => {
                    currentParams[key] = paramsArray[index];
                });

                // 執行水筒模式
                const simulatedRunoff = runTankModel(currentDisplayData.Rain, currentParams, TimeInterv);

                // 儲存模擬結果，供 onProgress 回呼使用
                lastSimulatedRunoffForHistory = simulatedRunoff;

                // --- 目標函數選擇 ---
                // 您可以在此處切換不同的目標函數。
                // RPROP 演算法會嘗試「最小化」此函數的回傳值。
                switch (selectedObjectiveFunction) {
                    case 'RMSE': {
                        // 均方根誤差 (RMSE)，目標是使其最小化 (趨近於 0)。
                        // RMSE 對較大的誤差值更敏感。
                        const rmse = Utils.calculateRMSE(currentDisplayData.Runoff, simulatedRunoff);
                        if (rmse === null) return Infinity;
                        return rmse;
                    }
                    case 'NSE': {
                        // 效率係數 (NSE)，目標是使其最大化 (趨近於 1.0)。
                        // 因為 RPROP 是最小化演算法，所以我們使用 (1 - NSE)^2 作為目標函數。
                        // 當 NSE 趨近於 1 時，(1 - NSE)^2 趨近於 0。
                        const nse = Utils.calculateNSE(currentDisplayData.Runoff, simulatedRunoff);
                        if (nse === null) return Infinity;
                        return Math.pow(1 - nse, 2);
                    }
                    case 'PeakFlowError': {
                        // 尖峰流量誤差，目標是使其最小化。
                        const obsValues = currentDisplayData.Runoff.filter(v => v >= 0);
                        if (obsValues.length === 0) return Infinity;

                        const obsPeak = Math.max(...obsValues);
                        const simPeak = Math.max(...simulatedRunoff);

                        if (obsPeak <= 1e-6) { // 避免除以零或非常小的值
                            return Math.pow(simPeak - obsPeak, 2); // 若觀測尖峰趨近於零，則退回絕對誤差平方
                        }

                        const relativeError = (simPeak - obsPeak) / obsPeak;
                        // 使用相對誤差的平方作為目標函數
                        return Math.pow(relativeError, 2);
                    }
                    default: // Fallback to RMSE
                        const rmse = Utils.calculateRMSE(currentDisplayData.Runoff, simulatedRunoff);
                        if (rmse === null) return Infinity;
                        return rmse;
                }
            };

            // 5. 初始化並執行 RPROP 最佳化器
            const rprop = new Rprop(objectiveFunction, paramMins, paramMaxs);
            
            const optimizationResult = await rprop.run(initialParamsArray, {
                maxIter: rpropSettings.maxIter,
                initialStep: rpropSettings.initialStep,
                minF: rpropSettings.minF,
                minFChange: rpropSettings.minFChange,
                onProgress: (progress) => {
                    const percent = (progress.iteration / rpropSettings.maxIter) * 100;
                    const percentStr = percent.toFixed(0) + '%';
                    
                    // 更新進度條
                    progressBar.style.width = percentStr;
                    progressBar.setAttribute('aria-valuenow', percent);
                    progressBar.textContent = percentStr;

                    // 計算當前疊代的 NSE 值 (即使目標函數不是 NSE)
                    const currentNse = Utils.calculateNSE(currentDisplayData.Runoff, lastSimulatedRunoffForHistory);

                    // 儲存當前疊代的校正歷程
                    const currentProgress = {
                        iteration: progress.iteration,
                        objective_function: progress.value,
                        nse: currentNse !== null ? currentNse : 'N/A', // 如果計算失敗則顯示 N/A
                        change: progress.change,
                    };
                    // 如果目標函數是 NSE，objective_function 存的是 (1-NSE)^2，這裡直接用計算好的 nse 覆蓋
                    if (selectedObjectiveFunction === 'NSE') {
                        currentProgress.objective_function = currentNse !== null ? currentNse : 'N/A';
                    }

                    editableParamKeys.forEach((key, index) => {
                        // 將參數名稱加入到紀錄中
                        currentProgress[key] = progress.params[index];
                    });
                    calibrationHistory.push(currentProgress);

                    // 更新進度文字 (修正: 使用 progress.change)
                    progressText.textContent = `疊代: ${progress.iteration}/${rpropSettings.maxIter} | 目標函數值: ${progress.value.toExponential(4)} | 變化量: ${progress.change.toExponential(4)}`;
                    // 在開發者控制台中顯示詳細進度
                    console.log(`Iter: ${progress.iteration}/${rpropSettings.maxIter}, Value: ${progress.value.toExponential(4)}, Change: ${progress.change.toExponential(4)}`);
                }
            });

            console.log("自動校正完成:", optimizationResult);
            progressBar.style.width = '100%';
            progressBar.textContent = '完成';
            progressBar.classList.remove('progress-bar-animated');
            progressBar.classList.add('bg-success');
            progressText.textContent = `校正完成，新參數已儲存！ ${optimizationResult.message} 最終目標函數值: ${optimizationResult.value.toExponential(4)}`;

            // 6. 使用最佳化後的參數更新介面並儲存
            const optimizedParamsObject = { ...activeTankParams };
            editableParamKeys.forEach((key, index) => {
                optimizedParamsObject[key] = optimizationResult.params[index];
            });
            displayTankParameters(optimizedParamsObject);
            saveTankParams(optimizedParamsObject);

            // 7. 自動使用新參數執行一次模擬以更新圖表
            const calibTitle = `水筒模式參數自動校正結果圖 (${selectedObjectiveFunction})`;
            runAndDrawSimulation(calibTitle);

            // 8. 顯示相關區塊，然後繪製收斂圖 (必須先顯示容器才能取得寬度)
            document.getElementById("convergence-chart-container").style.display = 'block';
            drawConvergenceChart();
            document.getElementById("download-calib-history-btn").style.display = 'inline-block';

        } catch (error) {
            console.error("自動校正失敗:", error);
            progressBar.style.width = '100%';
            progressBar.textContent = '失敗';
            progressBar.classList.remove('progress-bar-animated');
            progressBar.classList.add('bg-danger');
            progressText.textContent = `自動校正失敗: ${error.message || error}`;
        } finally {
            // 9. 恢復按鈕狀態
            autocalBtn.disabled = false;
            autocalBtn.textContent = '自動校正';
            otherButtons.forEach(id => document.getElementById(id).disabled = false);
            if (loadLabel) loadLabel.classList.remove('disabled');

            // 延遲一段時間後隱藏進度條，讓使用者能看到最終結果
            setTimeout(() => {
                progressContainer.style.display = 'none';
                // 恢復進度條樣式以備下次使用
                progressBar.classList.remove('bg-success', 'bg-danger');
                if (!progressBar.classList.contains('progress-bar-animated')) {
                    progressBar.classList.add('progress-bar-animated');
                }
            }, 5000); // 延遲5秒
        }
    });

    // --- Objective Function Dropdown Handler ---
    const dropdownItems = document.querySelectorAll('#objective-function-dropdown .dropdown-item');
    dropdownItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            
            // Remove active class from all items
            dropdownItems.forEach(i => i.classList.remove('active'));
            
            // Add active class to the clicked item
            e.target.classList.add('active');
            
            // Update the selected function
            selectedObjectiveFunction = e.target.dataset.value;
            
            showToast(`目標函數已切換為: ${selectedObjectiveFunction}`, '設定更新', 'info');
        });
    });

    // --- RPROP 設定 Modal 的事件處理 ---
    const rpropSettingsModal = document.getElementById('rpropSettingsModal');
    if (rpropSettingsModal) {
        const updateModalInputs = (settings) => {
            document.getElementById('rprop-maxIter').value = settings.maxIter;
            document.getElementById('rprop-initialStep').value = settings.initialStep;
            document.getElementById('rprop-minFChange').value = settings.minFChange.toExponential();
            document.getElementById('rprop-minF').value = settings.minF.toExponential();
        };

        rpropSettingsModal.addEventListener('show.bs.modal', () => updateModalInputs(rpropSettings));

        document.getElementById('save-rprop-settings-btn').addEventListener('click', () => {
            const maxIter = parseInt(document.getElementById('rprop-maxIter').value, 10);
            const initialStep = parseFloat(document.getElementById('rprop-initialStep').value);
            const minFChange = parseFloat(document.getElementById('rprop-minFChange').value);
            const minF = parseFloat(document.getElementById('rprop-minF').value);

            if (isNaN(maxIter) || isNaN(initialStep) || isNaN(minFChange) || isNaN(minF)) {
                alert('請輸入有效的數值。');
                return;
            }

            rpropSettings = { maxIter, initialStep, minFChange, minF };
            saveRpropSettings();

            const modalInstance = bootstrap.Modal.getInstance(rpropSettingsModal);
            modalInstance.hide();
            showToast('RPROP 校正設定已儲存。', '成功', 'success');
        });

        document.getElementById('reset-rprop-settings-btn').addEventListener('click', () => {
            if (confirm('您確定要將校正設定恢復為預設值嗎？')) {
                updateModalInputs(RPROP_DEFAULTS);
                showToast('已在表單中填入預設值。點擊「儲存設定」以套用。', '提示', 'info');
            }
        });
    }

    document.getElementById("reset-tank-params-btn").addEventListener('click', () => {
        if (confirm('您確定要將所有參數恢復為預設值嗎？')) {
            displayTankParameters(defaultTankParams);
            saveTankParams(defaultTankParams);
            showToast('參數已恢復為預設值。', '成功', 'success');
        }
    });

    document.getElementById("download-tank-params-btn").addEventListener('click', () => {
        const currentParams = getCurrentParamsFromUI();
        if (currentParams) {
            downloadParamsAsJson(currentParams);
        }
    });

    document.getElementById("save-tank-params-btn").addEventListener('click', () => {
        const currentParams = getCurrentParamsFromUI();
        if (currentParams) {
            saveTankParams(currentParams);
            downloadParamsAsJson(currentParams);
            showToast('參數已儲存至瀏覽器並下載。', '儲存成功', 'success');
        }
    });

    document.getElementById('load-tank-params-input').addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const content = e.target.result;
                const loadedParams = JSON.parse(content);

                // Basic validation to check if it's a valid parameter file
                if (loadedParams && typeof loadedParams.h1 !== 'undefined' && typeof loadedParams.a1 !== 'undefined' && typeof loadedParams.area !== 'undefined') {
                    // Warn the user if the reservoir ID doesn't match
                    if (loadedParams.id !== activeTankParams.id) {
                        if (!confirm(`警告：載入的參數檔案 (ID: ${loadedParams.id}) 與目前的水庫 (ID: ${activeTankParams.id}) 不符。\n您確定要載入嗎？`)) {
                            return;
                        }
                    }
                    // Update the UI and save to localStorage
                    displayTankParameters(loadedParams);
                    saveTankParams(loadedParams);
                    showToast('參數已從檔案載入並儲存。', '載入成功', 'success');
                } else {
                    showToast('錯誤：檔案格式不正確或不是有效的水筒模式參數檔。', '錯誤', 'danger');
                }
            } catch (error) {
                console.error('Error parsing JSON file:', error);
                showToast('錯誤：讀取或解析檔案時發生問題。', '錯誤', 'danger');
            } finally {
                // Reset the input value to allow re-selection of the same file
                event.target.value = null;
            }
        };

        reader.onerror = () => {
            console.error('Error reading file.');
            showToast('錯誤：讀取檔案時發生問題。', '錯誤', 'danger');
            event.target.value = null;
        };

        reader.readAsText(file);
    });

    // Add search functionality to the table
    document.getElementById("table-search").addEventListener('keyup', function () {
        const filter = this.value.toUpperCase();
        const tableBody = document.getElementById("data-table-body");
        const rows = tableBody.getElementsByTagName("tr");

        for (let i = 0; i < rows.length; i++) {
            // Get the first cell (觀測時間)
            let td = rows[i].getElementsByTagName("td")[0];
            if (td) {
                let textValue = td.textContent || td.innerText;
                if (textValue.toUpperCase().indexOf(filter) > -1) {
                    rows[i].style.display = "";
                } else {
                    rows[i].style.display = "none";
                }
            }
        }
    });

    document.getElementById("export-png-btn").addEventListener('click', () => {
        if (currentChart && currentChart.plot) {
            const canvas = currentChart.plot.getCanvas();
            if (canvas) {
                const link = document.createElement('a');
                link.href = canvas.toDataURL('image/png');
                link.download = 'hydrograph.png';
                document.body.appendChild(link); // Required for Firefox
                link.click();
                document.body.removeChild(link);
            }
        } else {
            alert("圖表尚未準備完成，請稍後再試。");
            console.error("Chart or plot object not available for export.");
        }
    });

    document.getElementById("export-csv-btn").addEventListener('click', () => {
        if (!currentDisplayData || !currentDisplayData.DateTime || currentDisplayData.DateTime.length === 0) {
            alert("沒有資料可供匯出。");
            return;
        }

        const header = ["觀測時間", "觀測雨量 (mm/hr)", "水庫入流量 (cms)"];
        let csvRows = [header.join(",")];

        for (let i = 0; i < currentDisplayData.DateTime.length; i++) {
            // Enclose time in quotes to handle potential commas, though not expected here.
            const time = `"${currentDisplayData.DateTime[i].replace('T', ' ')}"`;
            const rain = currentDisplayData.Rain[i];
            const runoff = currentDisplayData.Runoff[i];
            csvRows.push([time, rain, runoff].join(","));
        }

        const csvString = csvRows.join("\r\n");
        // Add BOM for Excel to recognize UTF-8
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });

        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "hydrograph_data.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    document.getElementById("download-calib-history-btn").addEventListener('click', () => {
        if (!calibrationHistory || calibrationHistory.length === 0) {
            showToast("沒有可下載的校正歷程。", "提示", "warning");
            return;
        }

        // 產生 CSV 標頭
        const headers = Object.keys(calibrationHistory[0]);
        let csvRows = [headers.join(",")];

        // 產生 CSV 內容
        for (const row of calibrationHistory) {
            const values = headers.map(header => {
                const value = row[header];
                // 對科學記號的數字做特別處理，避免 Excel 顯示問題
                if (typeof value === 'number' && (Math.abs(value) < 1e-3 || Math.abs(value) > 1e6) && value !== 0) {
                    return `"${value.toExponential(6)}"`;
                }
                return value;
            });
            csvRows.push(values.join(","));
        }

        const csvString = csvRows.join("\r\n");
        // Add BOM for Excel to recognize UTF-8
        const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
        const blob = new Blob([bom, csvString], { type: 'text/csv;charset=utf-8;' });

        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "calibration_history.csv");
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // 當點擊 "搜尋最高流量排行" 按鈕時，動態生成前三名日期的下拉選單
    document.getElementById("rank-flow-btn").addEventListener('click', async () => {
        const currentResId = "RSHME";
        const currentYear = document.getElementById("obs-date").value.substring(0, 4);
        const dropdownMenu = document.getElementById("flow-rank-dropdown");

        dropdownMenu.innerHTML = '<li><a class="dropdown-item" href="#">讀取中...</a></li>';

        const fullYearData = await fetchAndCacheData(currentYear, currentResId);

        if (!fullYearData || !fullYearData.runoff || fullYearData.runoff.length === 0) {
            dropdownMenu.innerHTML = '<li><a class="dropdown-item text-danger" href="#">無法獲取資料</a></li>';
            return;
        }

        // 找出全年流量前三高的事件，且事件之間必須相隔超過6小時
        const sortedRunoff = [...fullYearData.runoff]
            .filter(item => item.Value > 0)
            .sort((a, b) => b.Value - a.Value);

        const top3FlowEvents = [];
        const minTimeDiff = 6 * 60 * 60 * 1000; // 6 hours in milliseconds

        for (const event of sortedRunoff) {
            if (top3FlowEvents.length >= 3) {
                break; // 已經找到3個
            }

            let isTooClose = false;
            for (const topEvent of top3FlowEvents) {
                // new Date() is needed because ObsTime might be a string from JSON
                const timeDiff = Math.abs(new Date(event.ObsTime).getTime() - new Date(topEvent.ObsTime).getTime());
                if (timeDiff < minTimeDiff) {
                    isTooClose = true;
                    break;
                }
            }

            if (!isTooClose) {
                top3FlowEvents.push(event);
            }
        }

        if (top3FlowEvents.length === 0) {
            dropdownMenu.innerHTML = '<li><a class="dropdown-item" href="#">無流量資料</a></li>';
            return;
        }

        // 清空並填充下拉選單
        dropdownMenu.innerHTML = "";
        top3FlowEvents.forEach((event, index) => {
            const dateStr = Utils.DateToYYYYMMDD_Dash(event.ObsTime);
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'dropdown-item';
            link.href = '#';
            link.textContent = `第 ${index + 1} 名: ${dateStr} (${event.Value.toFixed(1)} cms)`;
            // 將完整的事件物件儲存在 dataset 中，以便後續使用
            link.dataset.event = JSON.stringify(event);

            link.addEventListener('click', (e) => {
                e.preventDefault();
                const clickedEvent = JSON.parse(e.target.dataset.event);
                // JSON轉換會將Date物件變成字串，需要還原
                clickedEvent.ObsTime = new Date(clickedEvent.ObsTime);

                // 將日期選擇器的值設定為目標日期的前一天，以便將其顯示在圖表中心
                const targetDate = new Date(clickedEvent.ObsTime);
                targetDate.setDate(targetDate.getDate() - 1); // 往前一天
                const newStartDateStr = Utils.DateToYYYYMMDD_Dash(targetDate);
                document.getElementById("obs-date").value = newStartDateStr;

                // 使用新日期重新繪製圖表，並傳遞要高亮的事件
                drawChartWithData(fullYearData, newStartDateStr, currentResId, clickedEvent);
            });

            listItem.appendChild(link);
            dropdownMenu.appendChild(listItem);
        });
    });

    // 當點擊 "搜尋日雨量排行" 按鈕時，動態生成前三名日期的下拉選單
    document.getElementById("rank-daily-rain-btn").addEventListener('click', async () => {
        const currentResId = "RSHME";
        const currentYear = document.getElementById("obs-date").value.substring(0, 4);
        const dropdownMenu = document.getElementById("daily-rain-rank-dropdown");

        dropdownMenu.innerHTML = '<li><a class="dropdown-item" href="#">讀取中...</a></li>';

        const fullYearData = await fetchAndCacheData(currentYear, currentResId);

        if (!fullYearData || !fullYearData.rain || fullYearData.rain.length === 0) {
            dropdownMenu.innerHTML = '<li><a class="dropdown-item text-danger" href="#">無法獲取資料</a></li>';
            return;
        }

        // 計算每日總雨量
        const dailyRain = {};
        fullYearData.rain.forEach(item => {
            const dateStr = Utils.DateToYYYYMMDD_Dash(item.ObsTime);
            if (!dailyRain[dateStr]) {
                dailyRain[dateStr] = 0;
            }
            dailyRain[dateStr] += item.Value;
        });

        // 排序並選出前三名
        const sortedDailyRain = Object.entries(dailyRain)
            .map(([date, totalRain]) => ({ date, totalRain }))
            .sort((a, b) => b.totalRain - a.totalRain);

        const top3DailyRain = sortedDailyRain.slice(0, 3);

        if (top3DailyRain.length === 0) {
            dropdownMenu.innerHTML = '<li><a class="dropdown-item" href="#">無降雨資料</a></li>';
            return;
        }

        // 清空並填充下拉選單
        dropdownMenu.innerHTML = "";
        top3DailyRain.forEach((event, index) => {
            const listItem = document.createElement('li');
            const link = document.createElement('a');
            link.className = 'dropdown-item';
            link.href = '#';
            link.textContent = `第 ${index + 1} 名: ${event.date} (${event.totalRain.toFixed(1)} mm)`;
            link.dataset.date = event.date;

            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetDateStr = e.target.dataset.date;
                document.getElementById("obs-date").value = targetDateStr;
                drawChartWithData(fullYearData, targetDateStr, currentResId);
            });

            listItem.appendChild(link);
            dropdownMenu.appendChild(listItem);
        });
    });

    editDataBtn.addEventListener('click', () => {
        if (isEditing) {
            exitEditMode(true); // 儲存變更
        } else {
            enterEditMode();
        }
    });

    cancelEditBtn.addEventListener('click', () => {
        if (confirm('您確定要放棄所有變更嗎？')) {
            exitEditMode(false); // 不儲存，直接退出
        }
    });

    // 摘要圖層顯示切換的事件處理
    document.getElementById('toggle-summary-overlay').addEventListener('change', (e) => {
        if (currentChart) {
            currentChart.displaySummaryOverlay(e.target.checked);
        }
    });
    // on window resize, plot chart again!
    // window.onresize = PlotRainfallRunoffMain;
};
