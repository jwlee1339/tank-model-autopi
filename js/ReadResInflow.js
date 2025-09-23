// ReadData.js
// 2024-06-13

import { Utils } from "./utils.js"

/** 
 * 讀取水庫入流量資料
 * @param {string}  URL 資料來源URL, ex. `../data/2024/RSHME_TimeSeries.txt`
 */
export function ReadResInflow(URL) {
    return new Promise((resolve, reject) => {
        let start = new Date();
        console.log(`ReadResInflow(), URL=${URL}`);
        $.ajax({
            url: URL,
            type: "GET",
            dataType: "text",
            success: function (text) {
                const parsedData = ParseData(text);
                resolve(parsedData);
            },
            error: function (xhr, status, errorThrow) {
                console.error("ReadResInflow() 資料錯誤!");
                console.log("Error : " + errorThrow);
                console.log("Status : " + status);
                console.dir(xhr);
                reject(new Error(`Failed to load ${URL}: ${status}`));
            },
            complete: function () {
                let end = new Date();
                let timeUsed = end.getTime() - start.getTime();
                console.log(`Time Used=${timeUsed / 1000} (s)`);
            },
            timeout: 10000 // 10 seconds
        });
    });
};

/**
 * 解析單行文字為資料物件
 * @param {string} line - "RFETS 2024-05-01T00:00 43.31"
 * @returns {{AreaNo: string, ObsTime: Date, Value: number}}
 */
function ParseLine(line) {
    //    const line = "RFETS 2024-05-01T00:00 43.31";

    // Split the line using a regular expression to handle the different parts
    const parts = line.split(/\s+/);

    // Extract the individual components
    const AreaNo = parts[0];
    let tmp = parts[1];
    // console.log(tmp)
    let s = tmp.replace('T', ' ')
    let ObsTime = Utils.StringToDateTime(s);
    const Value = parseFloat(parts[2]);

    return { AreaNo, ObsTime, Value }
}

/**
 * 解析整個文字檔內容
 * @param {string} text 檔案文字內容
 * @returns {{AreaNo: string, ObsTime: Date, Value: number}[]}
 */
function ParseData(text) {
    let data = [];
    let lines = text.split('\r\n')
    lines.forEach(x => {
        if (x[0] === ';' || (x.trim().length) === 0) {
            console.log('skip line')
        } else {
            let record = ParseLine(x);
            data.push(record);
        }
    });
    return data;
}