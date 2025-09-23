// js/TankModel.js

/**
 * Runs the tank model simulation.
 * @param {number[]} rainData - Array of rainfall values (mm/hr).
 * @param {object} tankpm - The tank model parameters.
 * @param {number} timeIntervSeconds - The time interval in seconds for each data point.
 * @returns {number[]} - Array of simulated runoff values (cms).
 */
export function runTankModel(rainData, tankpm, timeIntervSeconds) {
    const {
        area, h1, h2, a1, a2, a3,
        h3, b1, b2, b3,
    } = tankpm;

    let HTank1 = tankpm.HTank1; // Initial water level in upper tank (mm)
    let HTank2 = tankpm.HTank2; // Initial water level in lower tank (mm)

    const simulatedRunoff = [];

    for (const rain_mm_hr of rainData) {
        // Rainfall for this time step (mm)
        // The input rain is mm/hr, and time step is 1 hour, so rain_mm_hr is equivalent to rain_mm.
        const P = rain_mm_hr;

        // --- Upper Tank ---
        HTank1 += P;

        let Q1 = 0, Q2 = 0, Q3 = 0;

        // Surface runoff
        if (HTank1 > h1) {
            Q1 = a1 * (HTank1 - h1);
        }
        // Intermediate runoff
        if (HTank1 > h2) {
            Q2 = a2 * (HTank1 - h2);
        }
        // Infiltration to lower tank
        if (HTank1 > 0) {
            Q3 = a3 * HTank1;
        }

        // Total outflow from upper tank for this step
        const upperOutflow = Q1 + Q2 + Q3;
        if (HTank1 < upperOutflow) {
            // Adjust outflows proportionally if they exceed available water
            const ratio = upperOutflow > 0 ? HTank1 / upperOutflow : 0;
            Q1 *= ratio;
            Q2 *= ratio;
            Q3 *= ratio;
        }
        
        HTank1 -= (Q1 + Q2 + Q3);
        if (HTank1 < 0) HTank1 = 0;

        const Q_upper = Q1 + Q2;

        // --- Lower Tank ---
        HTank2 += Q3;

        let Q4 = 0, Q5 = 0, Q6 = 0;

        // Sub-surface runoff
        if (HTank2 > h3) {
            Q4 = b1 * (HTank2 - h3);
        }
        // Baseflow
        if (HTank2 > 0) {
            Q5 = b2 * HTank2;
        }
        // Deep percolation (loss)
        if (HTank2 > 0) {
            Q6 = b3 * HTank2;
        }
        
        const lowerOutflow = Q4 + Q5 + Q6;
        if (HTank2 < lowerOutflow) {
            // Adjust outflows proportionally
            const ratio = lowerOutflow > 0 ? HTank2 / lowerOutflow : 0;
            Q4 *= ratio;
            Q5 *= ratio;
            Q6 *= ratio;
        }

        HTank2 -= (Q4 + Q5 + Q6);
        if (HTank2 < 0) HTank2 = 0;

        const Q_lower = Q4 + Q5;

        // --- Total Runoff ---
        const totalRunoff_mm = Q_upper + Q_lower;

        // Convert runoff from mm over the catchment area to CMS
        const runoff_cms = (totalRunoff_mm / 1000) * (area * 1e6) / timeIntervSeconds;

        simulatedRunoff.push(runoff_cms);
    }

    return simulatedRunoff;
}