/* Chart2.js
 
 */

"use strict";
import { Utils } from "./utils.js";
import { RunoffCoeff } from "./RunoffCoeff.js";


/**
 * @class Chart2
 * @description 繪製降雨逕流歷線圖。
 * 接收包含時間、雨量、逕流的資料，並使用 Flot.js 繪製歷線圖。
 */
export class Chart2 {
    /**
     * Chart2 的建構函式
     * @param {{DateTime:string[], Rain:number[], Runoff:number[], SimulatedRunoff?: number[]}} json 包含日期時間、雨量和逕流資料的物件
     * @param {string} dom html id, ex. "#chart-id"
     * @param {number} timeInterv 資料的時間間隔(分鐘), ex.10 or 60
     * @param {number} basinArea 集水區面積(km^2)
     */
    constructor(json, dom, timeInterv, basinArea) {
        this.json = json;
        this.DOM = dom;
        // 10min rain or 1h rain
        this.timeInterv = timeInterv;  // default 10min 
        this.basinArea = basinArea;
        // 將mm/h轉換為mm
        this.timeIntervFactor = Math.floor(60.0 / timeInterv);  // 6(10min) or 1 (hourly)
        this.nse = null;
        this.rmse = null;
        this.peakFlowError = null;
        this.timeToPeakError = null;
        this.volumeError = null;
        this.simRunoffCoeff = null;
        // console.log('timeIntervFactor=',this.timeIntervFactor)
    }
    /**
     * 顯示子結果表格
     */
    ShowSubResultsTable() {
        // 表格內容
        let tr = this.GenSubResultsTable();
        $("#data-table-body").html(tr);

        // 根據是否有模擬資料來顯示/隱藏對應的表頭
        if (this.json.SimulatedRunoff) {
            $(".sim-runoff-header").show();
        } else {
            $(".sim-runoff-header").hide();
        }
    };

    /**
     * 產生子結果表格的 HTML 內容
     * @returns {string} HTML string for table rows
     */
    GenSubResultsTable() {
        let tr = "";
        if (!this.json || !this.json.DateTime || this.json.DateTime.length === 0) {
            const colspan = this.json.SimulatedRunoff ? 4 : 3;
            return `<tr><td colspan="${colspan}" class="text-center">沒有資料</td></tr>`;
        }

        const n = this.json.DateTime.length;
        const hasSimulatedData = this.json.SimulatedRunoff && this.json.SimulatedRunoff.length === n;

        for (let i = 0; i < n; i++) {
            const time = this.json.DateTime[i].replace('T', ' ');
            const rain = (+this.json.Rain[i]).toFixed(2);
            const runoff = (+this.json.Runoff[i]).toFixed(2);
            
            let row = `<tr><td>${time}</td><td>${rain}</td><td>${runoff}</td>`;
            if (hasSimulatedData) {
                const simRunoff = (+this.json.SimulatedRunoff[i]).toFixed(2);
                row += `<td>${simRunoff}</td>`;
            }
            row += `</tr>`;
            tr += row;
        }
        return tr;
    }

    /**
     * 準備雨量資料以供繪圖
     * @returns {[number, number][]} - Flot 使用的資料格式 [[timestamp, value], ...]
     */
    PrepareRainfallData() {
        let array = [];

        if (this.json !== null && this.json.Rain.length > 0) {
            let n = this.json.Rain.length;
            for (let i = 0; i < n; i++) {

                let s = this.json.DateTime[i].replace('T', ' ')
                let tm = Utils.StringToDateTime(s);
                tm = Utils.addHours(tm, Utils.Taiwan_UTC);

                // rainfall
                let rain = +this.json.Rain[i] / this.timeIntervFactor; // mm/hr -> mm
                array.push([tm, rain]);
            }
        }
        return array;
    }

    /**
     * 準備逕流資料以供繪圖
     * @returns {[number, number][]} - Flot 使用的資料格式 [[timestamp, value], ...]
     */
    PrepareRunoffData() {
        let array = [];

        if (this.json !== null && this.json.Runoff.length > 0) {
            let n = this.json.Runoff.length;
            for (let i = 0; i < n; i++) {
                let s = this.json.DateTime[i].replace('T', ' ')
                let tm = Utils.StringToDateTime(s);
                tm = Utils.addHours(tm, Utils.Taiwan_UTC);

                // runoff
                let runoff = this.json.Runoff[i];
                array.push([tm, +runoff]);
            }
        }
        return array;
    }

    /**
     * 準備模擬逕流資料以供繪圖
     * @returns {[number, number][]} - Flot 使用的資料格式 [[timestamp, value], ...]
     */
    PrepareSimulatedRunoffData() {
        let array = [];

        if (this.json !== null && this.json.SimulatedRunoff && this.json.SimulatedRunoff.length > 0) {
            let n = this.json.SimulatedRunoff.length;
            for (let i = 0; i < n; i++) {
                let s = this.json.DateTime[i].replace('T', ' ')
                let tm = Utils.StringToDateTime(s);
                tm = Utils.addHours(tm, Utils.Taiwan_UTC);

                // runoff
                let runoff = this.json.SimulatedRunoff[i];
                array.push([tm, +runoff]);
            }
        }
        return array;
    }

    /**
     * 尋找陣列中的最小值和最大值
     * @param {number[]} array 
     * @returns {number[]} [min, max]
     */
    static FindMinMax(array) {
        let min = 9999;
        let max = -9999;

        for (let i = 0; i < array.length; i++) {
            min = Math.min(min, array[i]);
            max = Math.max(max, array[i]);
        }
        return [min, max];
    }


    /**
     * 繪製降雨逕流歷線圖
     */
    plotRainfallRunoff() {

        // console.log('plotRainfallRunoff() : ', this.json);

        let rain = [];
        let runoff = [];
        let simRunoff = [];

        let QcacMax = undefined;
        // prepare rainfall runoff data
        rain = this.PrepareRainfallData();
        runoff = this.PrepareRunoffData();

        // 尋找最大觀測逕流量
        let [maxRunoff, maxRunoffIndex] = Utils.FindMax(runoff);
        let maxRunoffTime = (runoff.length > 0 && maxRunoffIndex >= 0) ? runoff[maxRunoffIndex][0] : 0;

        if (this.json.SimulatedRunoff) {
            simRunoff = this.PrepareSimulatedRunoffData();
            // Calculate NSE for the entire period
            this.nse = Utils.calculateNSE(this.json.Runoff, this.json.SimulatedRunoff);
            // Calculate RMSE for the entire period
            this.rmse = Utils.calculateRMSE(this.json.Runoff, this.json.SimulatedRunoff);

            // --- 計算其他評估指標 ---
            const [simMax, simMaxIndex] = Utils.FindMax(simRunoff);
            const simMaxTime = (simRunoff.length > 0 && simMaxIndex >= 0) ? simRunoff[simMaxIndex][0] : 0;

            // 1. 尖峰流量誤差 (%)
            if (maxRunoff > 0) {
                this.peakFlowError = ((simMax - maxRunoff) / maxRunoff) * 100;
            }

            // 2. 尖峰時間差 (小時)
            if (maxRunoffTime > 0 && simMaxTime > 0) {
                this.timeToPeakError = (simMaxTime - maxRunoffTime) / (1000 * 60 * 60);
            }

            // 3. 總量體積誤差 (%)
            const timeIntervSeconds = this.timeInterv * 60;
            const obsVolume = this.json.Runoff.reduce((sum, val) => sum + (val > 0 ? val : 0), 0) * timeIntervSeconds;
            const simVolume = this.json.SimulatedRunoff.reduce((sum, val) => sum + (val > 0 ? val : 0), 0) * timeIntervSeconds;
            if (obsVolume > 0) {
                this.volumeError = ((simVolume - obsVolume) / obsVolume) * 100;
            }

            // 4. 計算逕流係數
            if (this.basinArea) {
                this.simRunoffCoeff = RunoffCoeff(this.basinArea, this.json.Rain, this.json.SimulatedRunoff, timeIntervSeconds);
            }
        }
        
        let obsRunoffRange = Chart2.FindMinMax(this.json.Runoff);
        let Ymin = obsRunoffRange[0];
        let Ymax = obsRunoffRange[1];

        if (simRunoff.length > 0) {
            const simMax = Utils.FindMax(simRunoff)[0];
            Ymax = Math.max(Ymax, simMax);
        }
        // 計算流量的最大值與最小值
        if (QcacMax !== undefined) {
            Ymax = Math.max(Ymax, QcacMax[1])
        }
        //console.log('min = ', Ymin, '  max = ', Ymax);
        let Ygold = (Ymax - Ymin) / 0.618;
        let Ymax_Gold = Ymin + Ygold;

        // 3600000 * 0.1 -> for hourly (426h 剛好, 85h 太鬆), 600000 * 0.8 -> for 10min.
        // 426 -> 0.1, 85 -> 0.5 47 ->0.9
        // y=-0.00211 * (x - 47)+ 0.9
        let barFactor = 0.9 - 0.00211 * (this.json.Runoff.length - 47);
        // BarWidth for 10min rain
        // let BarWidth = this.timeIntervFactor === 6 ? 600000 * 0.8 : 3600000 * barFactor;
        // BarWidth for hour rain
        let BarWidth =  3600000 *0.7;

        //-----雨量最小值、最大值
        let r = Chart2.FindMinMax(this.json.Rain);
        // 計算總雨量
        let totalRainfall = this.json.Rain.reduce((acc, val) => acc + (val > 0 ? val : 0), 0);


        // RainAxisMax : 降雨軸最大值
        let RainAxisMax = r[1] * 1.0;
        RainAxisMax = this.timeIntervFactor === 6 ? Math.max(RainAxisMax, 80) : Math.max(RainAxisMax * 2, 120);
        // console.log({ BarWidth }, "this.timeIntervFactor:", this.timeIntervFactor, " RainAxisMax=", RainAxisMax);

        let dataset = [
            {
                label: "觀測流量",
                color: "#0033ff",  // Blue
                data: runoff,
                yaxis: 1,
                points: { show: true },
                lines: {
                    show: true,
                    lineWidth: 2,
                },
            },

            {
                label: "降雨",
                color: "#005548",  // Green
                yaxis: 2,
                bars: {
                    show: true,
                    align: "#009688",
                    barWidth: BarWidth,
                    fillColor: { colors: [{ opacity: 0.5 }, { opacity: 1 }] },
                    lineWidth: 1
                },
                data: rain
            }
        ];
      
        // Add simulated runoff to dataset if it exists
        if (simRunoff.length > 0) {
            dataset.unshift({ // Use unshift to draw it behind observed runoff
                label: "模擬流量",
                color: "#ff0000", // Red
                data: simRunoff,
                yaxis: 1,
                points: { show: false },
                lines: {
                    show: true,
                    lineWidth: 2,
                    dashes: [5, 5] // Dashed line
                },
            });
        }

        let barOptions = {
            series: {},
            xaxis: {
                mode: "time",
                axisLabel: "日期時間",
                timeformat: "%m/%d %h:%M",
                minTickSize: [1, "hour"],
            },
            yaxes: [
                {
                    position: "left",
                    min: Ymin,
                    max: Ymax_Gold,
                    axisLabel: "逕流量(cms)",
                },
                {
                    position: "right",
                    clolor: "black",
                    min: 0.0,
                    max: RainAxisMax,
                    // tickSize: userTickSize,
                    axisLabel: "降雨(mm)",
                    transform: function (v) {
                        return -v;
                    },
                    inverseTransform: function (v) {
                        return -v;
                    },
                    axisLabelUseCanvas: true,
                    axisLabelFontSizePixels: 12,
                    axisLabelFontFamily: "Verdana, Arial",
                    axisLabelPadding: 3,
                },
            ],
            grid: {
                hoverable: true
            },
            selection: {
                mode: "x"
            },

            legend: {
                position: "nw",
                noColumns: 5,
                margin: [0, -22],
                show: true,
            },
            tooltip: false,
            tooltipOpts: {
                content: "(%x, %y.2)",
            }
        };

        let placeholder = $(this.DOM);
        this.plot = $.plot(this.DOM, dataset, barOptions);
        $(this.DOM).UseTooltip();

        const updateAnnotation = (totalRain, peakFlow, nseValue) => {
            placeholder.find(".chart-annotation").remove();

            // Only show annotation if there is something to show
            if (totalRain <= 0 && peakFlow <= 0) return;

            const plotOffset = this.plot.getPlotOffset();
            const boxY = plotOffset.top + 10; // 離頂部 10px
            const boxXFromRight = plotOffset.right + 10; // 離圖表右側邊界 10px

            let annotationHtml = `<div class="chart-annotation" style="position:absolute; right:${boxXFromRight}px; top:${boxY}px; border: 1px solid #999; padding: 5px; background-color: rgba(255, 255, 255, 0.85); font-size:12px; font-weight:bold; text-align: left;">`;

            if (totalRain > 0) {
                annotationHtml += `<div style="color:green; margin-bottom: 5px;">選取範圍總雨量: ${totalRain.toFixed(1)} mm</div>`;
            }
            if (peakFlow > 0) {
                annotationHtml += `<div style="color:blue;">選取範圍最大流量: ${peakFlow.toFixed(2)} cms</div>`;
            }
            if (nseValue !== null) {
                annotationHtml += `<div style="color:red; margin-top: 5px;">選取範圍 NSE: ${nseValue.toFixed(3)}</div>`;
            }

            annotationHtml += `</div>`;
            placeholder.append(annotationHtml);
        };

        // Initially, no annotation is shown. It appears on selection.

        // 處理選取事件
        placeholder.bind("plotselected", (event, ranges) => {
            let sumRain = 0;
            let peakRunoff = 0;

            const from = ranges.xaxis.from;
            const to = ranges.xaxis.to;
            const obsInWindow = [];
            const simInWindow = [];

            // 遍歷原始數據來計算統計值
            for (let i = 0; i < this.json.DateTime.length; i++) {
                let s = this.json.DateTime[i].replace('T', ' ')
                let tm = Utils.StringToDateTime(s);
                tm = Utils.addHours(tm, Utils.Taiwan_UTC).getTime();

                if (tm >= from && tm <= to) {
                    const rainVal = +this.json.Rain[i];
                    if (rainVal > 0) {
                        sumRain += rainVal;
                    }
                    const runoffVal = +this.json.Runoff[i];
                    if (runoffVal >= 0) {
                        if (runoffVal > peakRunoff) {
                            peakRunoff = runoffVal;
                        }
                        if (this.json.SimulatedRunoff) {
                            obsInWindow.push(runoffVal);
                            simInWindow.push(+this.json.SimulatedRunoff[i]);
                        }
                    }
                }
            }

            let selectedNse = null;
            if (this.json.SimulatedRunoff) {
                selectedNse = Utils.calculateNSE(obsInWindow, simInWindow);
            }

            updateAnnotation(sumRain, peakRunoff, selectedNse);
        });

        // 處理取消選取事件 (點擊圖表)
        placeholder.bind("plotunselected", (event) => {
            placeholder.find(".chart-annotation").remove();
        });


    }; // end of function

}


/**
 * 顯示 Flot 圖表的提示框
 * @param {number} x 提示框的 x 座標
 * @param {number} y 提示框的 y 座標
 * @param {string} contents 提示框的 HTML 內容
 */
function showTooltip(x, y, contents) {
    $('<div id="tooltip">' + contents + '</div>').css({
        position: 'absolute',
        display: 'none',
        top: y + 5,
        left: x + 20,
        border: '2px solid #4572A7',
        padding: '1px',
        'font-size': '9px',
        'background-color': '#fff',
        opacity: 0.80
    }).appendTo("body").fadeIn(200);
}


/**
 * @function
 * @name UseTooltip
 * @memberof jQuery.fn
 * @description 為 Flot 圖表啟用滑鼠懸停提示框功能
 */
$.fn.UseTooltip = function () {
    var previousPoint = null;
    var Taiwan_UTC = 8 * 3600 * 1000;

    $(this).bind("plothover", function (event, pos, item) {

        if (item) {
            if (previousPoint !== item.dataIndex) {
                previousPoint = item.dataIndex;

                $("#tooltip").remove();

                var x = item.datapoint[0];
                var y = item.datapoint[1];

                var time = new Date(x - Taiwan_UTC);
                let timeStr = Utils.DateToYYYYMMDDHHMM_Dash(time);
                let seriesLabel = item.series.label;
                let html = "";

                if (seriesLabel === "觀測流量" || seriesLabel === "模擬流量") {
                    const plot = $(this).data("plot");
                    if (!plot) return; // 安全檢查，如果找不到 plot 物件則直接返回

                    const allSeries = plot.getData();
                    const obsSeries = allSeries.find(s => s.label === "觀測流量");
                    const simSeries = allSeries.find(s => s.label === "模擬流量");

                    html = `<div class='fs-6 text-start'><strong>${timeStr}</strong><br/>`;
                    
                    if (obsSeries && obsSeries.data[item.dataIndex]) {
                        const obsVal = obsSeries.data[item.dataIndex][1].toFixed(2);
                        html += `觀測流量: ${obsVal} cms<br/>`;
                    }
                    
                    if (simSeries && simSeries.data[item.dataIndex]) {
                        const simVal = simSeries.data[item.dataIndex][1].toFixed(2);
                        html += `模擬流量: ${simVal} cms`;
                    }
                    html += `</div>`;
                } else { // For rainfall
                    let yy = parseFloat(y).toFixed(2);
                    html = `<div class='fs-6'><strong>${seriesLabel}<br>${timeStr}<br>${yy} mm</strong></div>`;
                }

                showTooltip(item.pageX, item.pageY, html);
            }
        }
        else {
            $("#tooltip").remove();
            previousPoint = null;
        }
    });
}