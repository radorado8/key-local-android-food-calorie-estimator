// Health Connect service — wraps expo-health-connect with safe fallbacks
// This module is always importable; methods return gracefully if HC is unavailable.

let HC = null;
try {
    HC = require('expo-health-connect');
} catch {
    // expo-health-connect not installed or not linked — all methods will no-op
}

export async function isHealthConnectAvailable() {
    try {
        if (!HC || !HC.isAvailable) return false;
        return await HC.isAvailable();
    } catch {
        return false;
    }
}

export async function requestHealthPermissions() {
    try {
        if (!HC || !HC.requestPermission) return false;
        const granted = await HC.requestPermission([
            { accessType: 'read', recordType: 'ActiveCaloriesBurned' },
            { accessType: 'write', recordType: 'ActiveCaloriesBurned' },
        ]);
        return granted && granted.length > 0;
    } catch (e) {
        console.warn('Health Connect permission error:', e);
        return false;
    }
}

/**
 * Read burned calories for a date range.
 * Returns total kcal burned (number).
 */
export async function readBurnedCalories(startDate, endDate) {
    try {
        if (!HC || !HC.readRecords) return 0;
        const result = await HC.readRecords('ActiveCaloriesBurned', {
            timeRangeFilter: {
                operator: 'between',
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
            },
        });
        if (!result || !result.records) return 0;
        return result.records.reduce((sum, r) => sum + (Number(r.energy?.inKilocalories || r.value) || 0), 0);
    } catch (e) {
        console.warn('Health Connect read error:', e);
        return 0;
    }
}

/**
 * Read burned calories per day for a date range.
 * Returns Map<dateKey, kcal>
 */
export async function readBurnedCaloriesPerDay(startDate, endDate) {
    const dailyMap = {};
    try {
        if (!HC || !HC.readRecords) return dailyMap;
        const result = await HC.readRecords('ActiveCaloriesBurned', {
            timeRangeFilter: {
                operator: 'between',
                startTime: startDate.toISOString(),
                endTime: endDate.toISOString(),
            },
        });
        if (!result || !result.records) return dailyMap;
        result.records.forEach(r => {
            const d = new Date(r.startTime || r.time);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            const kcal = Number(r.energy?.inKilocalories || r.value) || 0;
            dailyMap[key] = (dailyMap[key] || 0) + kcal;
        });
    } catch (e) {
        console.warn('Health Connect read per-day error:', e);
    }
    return dailyMap;
}

/**
 * Write burned calories.
 */
export async function writeBurnedCalories(calories, startTime, endTime) {
    try {
        if (!HC || !HC.insertRecords) return false;
        await HC.insertRecords([
            {
                recordType: 'ActiveCaloriesBurned',
                energy: { unit: 'kilocalories', value: calories },
                startTime: startTime.toISOString(),
                endTime: endTime.toISOString(),
            },
        ]);
        return true;
    } catch (e) {
        console.warn('Health Connect write error:', e);
        return false;
    }
}
