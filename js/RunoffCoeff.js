// RunoffCoeff.js
// 2025-03-10
// 計算逕流係數

/**
 * 計算逕流係數
 * @param {number} Area 集水區面積(km^2)
 * @param {number[]} rain 觀測雨量串列(mm)
 * @param {number[]} Qobs 觀測流量串列(cms)
 * @param {number} T 時間間距(秒)
 * @returns {number} 逕流係數 Co. 如果總雨量為0，則回傳 -1。
 */
export function RunoffCoeff(Area, rain, Qobs, T)
{
    let rainsum = 0.0, ObsRunoffVol = 0.0;

    for (let i = 0; i < rain.length; i++)
    {
        let q = Qobs[i] > 0.0 ? Qobs[i] : 0;
        ObsRunoffVol += q;
        rainsum += rain[i];
    }

    let RainVolume = rainsum * Area / 1000.0;
    let ObsRunoffVolume = ObsRunoffVol * T;
    let Co=-1;
    if (RainVolume > 0)
    {
        Co = ObsRunoffVolume / 1000000 / RainVolume;
    }
    return Co;
}