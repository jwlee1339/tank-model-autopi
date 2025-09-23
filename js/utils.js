// utils.js
// 2023-07-15

export class Utils {

    /** 台灣時區 UTC+8 (小時) */ 
    static Taiwan_UTC = +8; // UTC+8 in hours

    /**
     * Calculates the Root Mean Square Error (RMSE).
     * @param {number[]} observed - Array of observed values.
     * @param {number[]} simulated - Array of simulated values.
     * @returns {number | null} The RMSE value, or null if calculation is not possible.
     */
    static calculateRMSE(observed, simulated) {
        if (!observed || !simulated || observed.length !== simulated.length || observed.length === 0) {
            return null;
        }

        const validPairs = [];
        for (let i = 0; i < observed.length; i++) {
            // Only consider pairs where observed value is valid (e.g., not negative)
            if (observed[i] >= 0 && simulated[i] !== null && simulated[i] !== undefined) {
                validPairs.push({ obs: observed[i], sim: simulated[i] });
            }
        }

        if (validPairs.length === 0) {
            return null;
        }

        const n = validPairs.length;
        const sumOfSquares = validPairs.reduce((sum, pair) => {
            return sum + Math.pow(pair.sim - pair.obs, 2);
        }, 0);

        return Math.sqrt(sumOfSquares / n);
    }

    /**
     * Calculates the Nash-Sutcliffe Efficiency (NSE) coefficient.
     * @param {number[]} observed - Array of observed values.
     * @param {number[]} simulated - Array of simulated values.
     * @returns {number | null} The NSE value, or null if calculation is not possible.
     */
    static calculateNSE(observed, simulated) {
        if (!observed || !simulated || observed.length !== simulated.length || observed.length === 0) {
            return null;
        }

        const validPairs = [];
        for (let i = 0; i < observed.length; i++) {
            // Only consider pairs where observed value is valid (e.g., not negative)
            if (observed[i] >= 0 && simulated[i] !== null && simulated[i] !== undefined) {
                validPairs.push({ obs: observed[i], sim: simulated[i] });
            }
        }

        if (validPairs.length < 2) { // Need at least 2 points to calculate variance
            return null;
        }

        const n = validPairs.length;
        const meanObs = validPairs.reduce((sum, pair) => sum + pair.obs, 0) / n;

        let numerator = 0;
        let denominator = 0;

        for (const pair of validPairs) {
            numerator += Math.pow(pair.obs - pair.sim, 2);
            denominator += Math.pow(pair.obs - meanObs, 2);
        }

        if (denominator === 0) {
            return numerator === 0 ? 1.0 : -Infinity;
        }

        return 1 - (numerator / denominator);
    }

    /**
     * 檢查日期時間字串是否有效
     * @param {string} dateString ex."2022-10-16 15:00"
     * @returns {boolean}
     */
    static IsValidDateTime(dateString) {
        let date = new Date(dateString);
        let res = date instanceof Date && !isNaN(date.valueOf());
        // console.log(`IsValidDateTime(${dateString}):`,res);
        return res;
    }

    /**
     * 尋找二維陣列中第二個元素的最小值和最大值
     * @param {number[][]} array - e.g. [[tm, value], [tm, value], ...]
     * @returns {number[]} [min, max]
         */
    static FindMinMax(array) {
        let min = 9999;
        let max = -9999;

        for (let i = 0; i < array.length; i++) {
            min = Math.min(min, array[i][1]);
            max = Math.max(max, array[i][1]);
        }
        return [min, max];
    }

    /**
     * 尋找二維陣列中第二個元素的最小值
     * @param {[number, number][]} array - e.g. [[tm, value], [tm, value], ...]
     * @returns {{min: number, index: number}} 包含最小值和其索引的物件
     */
    static FindMin(array) {
        let min = Number.MAX_VALUE;
        let index = -1;

        if (array === null || array.length === 0) return { min, index };

        for (let i = 0; i < array.length; i++) {
            if (min > +array[i][1]) {
                min = +array[i][1];
                index = i;
            }
        }
        return { min, index };
    };

    /**
     * 尋找二維陣列中第二個元素的最大值
     * @param {[number, number][]} array - e.g. [[tm, value], [tm, value], ...]
     * @returns {[number, number]} [maxvalue, index]
     */
    static FindMax = (array) => {
        if (array === null || array.length === 0)
            return [-999.9, -999.9];
        let maxvalue = -999.9;
        let index = -1;
        for (let i = 0; i < array.length; i++) {
            if (maxvalue < array[i][1]) {
                maxvalue = array[i][1];
                index = i;
            }
        }
        return [maxvalue, index];
    };

    /**
     * 在指定日期上增加分鐘
     * @param {Date} date
     * @param {number} m 分鐘數
     * @returns {Date}
     */
    static addMinutes(date, m) {
        let copiedDate = new Date(date.getTime());
        copiedDate.setMinutes(copiedDate.getMinutes() + m);
        return copiedDate;
    }
    /**
     * 在指定日期上增加小時
     * @param {Date} date 
     * @param {number} h 
     * @returns {Date}
     */
    static addHours(date, h) {
        var copiedDate = new Date(date.getTime());
        copiedDate.setHours(copiedDate.getHours() + h);
        return copiedDate;
    }

    /**
     * 將日期字串 "YYYY-MM-DD HH:MM" 轉換為 "YYYYMMDDHH"
     * @param {string} date_string
     * @returns {string}
     */
    static StrToYYYYMMDDHH(date_string) {
        console.log(date_string)
        let date = Utils.StringToDateTime(date_string);
        console.log({ date })
        // @ts-ignore
        let YYYYMMDDHH = Utils.DateToYYYYMMDDHHMM(date);
        return YYYYMMDDHH;
    }

    /**
     * 將日期字串 "YYYY-MM-DD HH:MM" 轉換為 "YYYYMMDDHH00"
     * @param {string } date_string
     * @returns {string}
     */
    static StrToYYYYMMDDHH00(date_string) {
        // console.log(date_string)
        let date = Utils.StringToDateTime(date_string);
        // console.log({date})
        // @ts-ignore
        let YYYYMMDDHH00 = `${Utils.DateToYYYYMMDDHH(date)}`;
        return YYYYMMDDHH00;
    }
    /**
     * 將 Date 物件轉換為 "YYYYMMDDHHMM" 格式字串
     * @param date 
     * @returns string
     */
    static DateToYYYYMMDDHHMM(date) {
        // date to yyyymmddhhmm
        let yyyy = date.getFullYear();
        let mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        let dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        let min = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
        let res = `${yyyy}${mm}${dd}${hh}${min}`;
        return res;
    }
    /**
     * 將 Date 物件轉換為 "YYYYMMDDHH00" 格式字串
     * @param date 
     * @returns string
     */
    static DateToYYYYMMDDHH00(date) {
        // date to yyyymmddhhmm
        let yyyy = date.getFullYear();
        let mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        let dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        let min = "00";
        let res = `${yyyy}${mm}${dd}${hh}${min}`;
        return res;
    }
    /**
     * 將 Date 物件轉換為 "YYYY-MM-DD HH:MM" 格式字串
     * @param date 
     * @returns string
     */
    static DateToYYYYMMDDHHMM_Dash(date) {
        // date to yyyymmddhhmm
        let yyyy = date.getFullYear();
        let mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        let dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        let min = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
        let res = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        return res;
    }
    /**
     * 將 Date 物件轉換為 "YYYY-MM-DD HH:M0" 格式字串 (分鐘數捨去個位數)
     * @param date 
     * @returns string
     */
    static DateToYYYYMMDDHHM0_Dash(date) {
        // date to yyyymmddhhmm
        let yyyy = date.getFullYear();
        let mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        let dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        let t = date.getMinutes();

        t = Math.floor(t / 10) * 10;

        let min = t < 10 ? "0" + t : t;
        let res = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        return res;
    }
    /**
     * 將 Date 物件轉換為 "MM-DD HH:MM" 格式字串
     * @param date 
     * @returns string
     */
    static DateToMMDDHHMM_Dash(date) {
        // date to yyyymmddhhmm
        let yyyy = date.getFullYear();
        let mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        let dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        let min = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
        let res = `${mm}-${dd} ${hh}:${min}`;
        return res;
    }

    /**
     * 將 Date 物件轉換為 "YYYY-MM-DD" 格式字串
     * @param date 
     * @returns string
     */
    static DateToYYYYMMDD_Dash(date) {
        let yyyy = date.getFullYear();
        let mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        let dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let res = `${yyyy}-${mm}-${dd}`;
        return res;
    }

    /**
     * 將 Date 物件轉換為 "YYYY-MM-DD HH:MM:SS" 格式字串
     * @param date 
     * @returns string
     */
    static DateToYYYYMMDDHHMMSS_Dash(date) {
        // date to yyyymmddhhmm
        let yyyy = date.getFullYear();
        let mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        let dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        let min = date.getMinutes() < 10 ? "0" + date.getMinutes() : date.getMinutes();
        let sec = date.getSeconds() < 10 ? "0" + date.getSeconds() : date.getSeconds();
        let res = `${yyyy}-${mm}-${dd} ${hh}:${min}:${sec}`;
        return res;
    }

    /**
     * 將 Date 物件轉換為 "YYYY-MM-DD HH:00" 格式字串
     * @param date 
     * @returns string
     */
    static DateToYYYYMMDDHH00_Dash(date) {
        // date to yyyymmddhhmm
        let yyyy = date.getFullYear();
        let mm = date.getMonth() < 9 ? "0" + (date.getMonth() + 1) : (date.getMonth() + 1); // getMonth() is zero-based
        let dd = date.getDate() < 10 ? "0" + date.getDate() : date.getDate();
        let hh = date.getHours() < 10 ? "0" + date.getHours() : date.getHours();
        let min = "00";
        let res = `${yyyy}-${mm}-${dd} ${hh}:${min}`;
        return res;
    }

    /**
     * 在 Flot 圖表上添加註記
     * @param {any} plot Flot plot 物件
     * @param {JQuery} placeholder 圖表的容器
     * @param {number} tm 時間戳 (x 座標)
     * @param {number} maxValue y 座標
     * @param {string} text 註記文字
     * @ignore
     */
    static AddStageAnnotation = function (plot, placeholder, tm, maxValue, text) {
        var o = plot.pointOffset({ x: tm, y: maxValue });
        // let text = "�[��";
        let ctx = plot.getCanvas().getContext("2d"); // get the context
        // let metrics = ctx.measureText(text);
        // let top = o.top - metrics.height;
        let top = o.top - 15;

        placeholder.append("<div style='position:absolute;left:" +
            (o.left) +
            "px;top:" +
            top +
            `px;color:#000;font-size:smaller'>${text}</div>`);
        // drawing
        ctx.beginPath();

    };
    
    /**
     * 將 "YYYY-MM-DD HH:MM" 格式的字串轉換為 Date 物件
     * @param {string} dateTimeString 日期時間字串
     * @returns {Date}
     */
    static StringToDateTime = function (dateTimeString) {
        //console.log(`StringToDateTime(), dateTimeString=${dateTimeString}`);
        function RemoveLeadingZero(numberInStringType) {
            let i = 0;
            while (true) {
                if (numberInStringType[i] === '0' && i !== numberInStringType.length - 1)
                    numberInStringType = numberInStringType.substring(1);
                else
                    return numberInStringType;
            }
        }
        let dateTimeSplit = dateTimeString.split(/[\s-:]/);
        let year = parseInt(dateTimeSplit[0]);
        let month = parseInt(RemoveLeadingZero(dateTimeSplit[1])) - 1;
        let date = parseInt(RemoveLeadingZero(dateTimeSplit[2]));
        let hours = parseInt(RemoveLeadingZero(dateTimeSplit[3]));
        let minutes = parseInt(RemoveLeadingZero(dateTimeSplit[4]));
        let datetime = new Date(year, month, date, hours, minutes);
        return datetime;
    };
    /** FetchData(): 讀取資料 
     * @param {string} URL - API網址及參數
     * @param {number} timeout - 時間限制(秒)
     * @returns {Promise<["OK"|"NG", any]>} 回傳一個陣列，第一個元素是狀態 ("OK" 或 "NG")，第二個是資料或 null
     */
    static async FetchData(URL, timeout) {
        // 創建一個 AbortController 物件
        const controller = new AbortController();

        // 設置一個 5 秒的超時計時器
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        // 檔案位置相對於網頁HTML
        try {
            // 使用 await 等待 fetch 函數的返回值
            const response = await fetch(URL, { signal: controller.signal });
            if (!response.ok) {
                console.error('Network response was not ok');
                return ["NG", null];
            }
            // 使用 await 等待 json () 方法的返回值
            const data = await response.json();
            console.log(data);
            // 回傳 JSON 數據
            return ["OK", data];
        } catch (error) {
            console.error('There was a problem with the fetch operation:', error);
        }
        return ["NG", null];
    }
}