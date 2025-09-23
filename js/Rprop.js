// js/Rprop.js
// Converted from C# RPROP implementation

/**
 * A class for parameter optimization using the RPROP algorithm.
 */
export class Rprop {
    /**
     * @param {function(number[]): number} objectiveFunction The function to minimize. It takes an array of UN-NORMALIZED parameters and returns a single error value.
     * @param {number[]} xmin Lower bounds for each parameter.
     * @param {number[]} xmax Upper bounds for each parameter.
     */
    constructor(objectiveFunction, xmin, xmax) {
        this.f = objectiveFunction;
        this.xmin = [...xmin];
        this.xmax = [...xmax];
        this.nParams = xmin.length;
    }

    /**
     * Normalizes a set of parameters from their real-world range to the [0, 1] range.
     * @param {number[]} x_unnormalized - Array of un-normalized parameters.
     * @returns {number[]} - Array of normalized parameters.
     */
    normalize(x_unnormalized) {
        const x_normalized = new Array(this.nParams);
        for (let i = 0; i < this.nParams; i++) {
            const range = this.xmax[i] - this.xmin[i];
            if (Math.abs(range) > 1e-9) {
                x_normalized[i] = (x_unnormalized[i] - this.xmin[i]) / range;
            } else {
                x_normalized[i] = 0.5; // Default for zero-range params
            }
        }
        return x_normalized;
    }

    /**
     * Converts a set of parameters from the normalized [0, 1] range back to their real-world range.
     * @param {number[]} x_normalized - Array of normalized parameters.
     * @returns {number[]} - Array of un-normalized parameters.
     */
    unNormalize(x_normalized) {
        const x_unnormalized = new Array(this.nParams);
        for (let i = 0; i < this.nParams; i++) {
            const range = this.xmax[i] - this.xmin[i];
            x_unnormalized[i] = this.xmin[i] + x_normalized[i] * range;
        }
        return x_unnormalized;
    }

    /**
     * Calculates the gradient of the objective function at a given point using finite differences.
     * @param {number[]} x_normalized - The point (normalized parameters) at which to calculate the gradient.
     * @returns {number[]} - The calculated gradient.
     */
    grad_f(x_normalized) {
        const grad = new Array(this.nParams);
        const f_current = this.f(this.unNormalize(x_normalized));
        const epsilon = 1e-5; // Small step for finite difference

        for (let i = 0; i < this.nParams; i++) {
            const x_temp = [...x_normalized];
            const h = epsilon;
            
            // Ensure we don't step out of bounds [0, 1]
            if (x_temp[i] + h > 1.0) {
                x_temp[i] -= h; // step backwards
                const f_new = this.f(this.unNormalize(x_temp));
                grad[i] = (f_current - f_new) / h;
            } else {
                x_temp[i] += h;
                const f_new = this.f(this.unNormalize(x_temp));
                grad[i] = (f_new - f_current) / h;
            }
        }
        return grad;
    }

    /**
     * Calculates the Euclidean norm of a vector.
     * @param {number[]} g - The vector.
     * @returns {number} - The norm.
     */
    static norm(g) {
        let sum = 0;
        for (let i = 0; i < g.length; i++) {
            sum += g[i] * g[i];
        }
        return Math.sqrt(sum);
    }

    /**
     * Constrains a value to be within a min and max.
     * @param {number} x - The value.
     * @param {number} min - The minimum.
     * @param {number} max - The maximum.
     * @returns {number} - The capped value.
     */
    static cap(x, min, max) {
        if (x < min) return min;
        if (x > max) return max;
        return x;
    }

    /**
     * Runs the RPROP optimization algorithm.
     * @param {number[]} x_initial - Initial guess for parameters (un-normalized).
     * @param {object} options - RPROP options.
     * @param {number} [options.initialStep=0.1] - Initial step size.
     * @param {number} [options.maxIter=100] - Maximum number of iterations.
     * @param {number} [options.minF=1e-6] - Tolerance for objective function value.
     * @param {number} [options.minFChange=1e-6] - Tolerance for change in objective function value.
     * @param {function(object): void} [options.onProgress] - Callback for progress updates.
     * @returns {Promise<{params: number[], value: number, iterations: number, message: string}>} - A promise that resolves with the optimization result.
     */
    async run(x_initial, options = {}) {
        const {
            initialStep = 0.1,
            maxIter = 100,
            minF = 1e-6,
            minFChange = 1e-6,
            onProgress
        } = options;

        let x0 = this.normalize(x_initial);

        let alpha = new Array(this.nParams).fill(initialStep);
        let g_prev = new Array(this.nParams).fill(0);

        let f_prev = this.f(this.unNormalize(x0));
        let f_current = f_prev;
        let f_change = 0;
        let exitCode = 0;
        let iter = 0;

        for (iter = 0; iter < maxIter; iter++) {
            const g_current = this.grad_f(x0);
            
            // RPROP update logic
            for (let j = 0; j < this.nParams; j++) {
                const signChange = g_prev[j] * g_current[j];

                if (signChange > 0) { // No sign change
                    alpha[j] = Math.min(alpha[j] * 1.2, 50);
                } else if (signChange < 0) { // Sign change
                    alpha[j] = Math.max(alpha[j] * 0.5, 1e-6);
                    g_current[j] = 0; // Force stagnation in next iteration's check
                }
                
                const delta = -Math.sign(g_current[j]) * alpha[j];
                x0[j] += delta;

                // Keep parameters within normalized bounds [0, 1]
                x0[j] = Rprop.cap(x0[j], 0.0, 1.0);
            }
            
            g_prev = [...g_current];
            
            f_current = this.f(this.unNormalize(x0));
            f_change = Math.abs(f_current - f_prev);

            if (onProgress) {
                // Yield to the event loop to keep UI responsive
                await new Promise(resolve => setTimeout(resolve, 0));
                onProgress({
                    iteration: iter + 1,
                    params: this.unNormalize(x0),
                    value: f_current,
                    change: f_change
                });
            }
            f_prev = f_current;

            // Check stopping conditions
            if (f_current < minF) { exitCode = 1; break; }
            if (f_change < minFChange && iter > 0) { exitCode = 3; break; }
        }

        let message = "停止條件: ";
        switch (exitCode) {
            case 0: message += `已達最大疊代次數 (${maxIter})。`; break;
            case 1: message += `目標函數值 (${f_current.toExponential(4)}) 小於容許值 (${minF.toExponential(4)})。`; break;
            case 3: message += `目標函數值變化量 (${f_change.toExponential(4)}) 小於容許值 (${minFChange.toExponential(4)})。`; break;
            default: message += "未知。"; break;
        }

        return {
            params: this.unNormalize(x0),
            value: f_current,
            iterations: iter + 1,
            message: message
        };
    }
}