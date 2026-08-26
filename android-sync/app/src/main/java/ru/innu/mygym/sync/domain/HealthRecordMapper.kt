package ru.innu.mygym.sync.domain

import java.math.BigDecimal
import java.math.RoundingMode
import java.time.Duration
import java.time.ZoneId

class HealthRecordMapper(private val zoneId: ZoneId) {
    fun dailySummary(source: DailyAggregateSource): HealthDailySummary = HealthDailySummary(
        date = source.date,
        steps = source.steps?.takeIf { it >= 0 },
        activeCaloriesKcal = source.activeCaloriesKcal.normalizedNonNegative(),
        sleepMinutes = source.sleepMinutes?.takeIf { it >= 0 },
        weightKg = source.weightKg.normalizedNonNegative(),
        bodyFatPercent = source.bodyFatPercent.normalizedPercent(),
        heartRateAvgBpm = source.heartRateAvgBpm.normalizedNonNegative(),
        heartRateMinBpm = source.heartRateMinBpm?.takeIf { it >= 0 },
        heartRateMaxBpm = source.heartRateMaxBpm?.takeIf { it >= 0 },
        oxygenSaturationAvgPercent = source.oxygenSaturationAvgPercent.normalizedPercent(),
    )

    fun workout(source: WorkoutSource): HealthWorkout = HealthWorkout(
        externalId = "hc:${source.providerId}",
        start = source.start,
        end = source.end,
        durationMinutes = Duration.between(source.start, source.end).toMinutes().coerceAtLeast(0),
        timezone = zoneId.id,
        exerciseType = source.exerciseType,
        title = source.title?.trim()?.takeIf { it.isNotEmpty() },
        activeCaloriesKcal = source.activeCaloriesKcal.normalizedNonNegative(),
    )
}

private fun Double?.normalizedNonNegative(): Double? = this
    ?.takeIf { it.isFinite() && it >= 0.0 }
    ?.let { BigDecimal.valueOf(it).setScale(2, RoundingMode.HALF_UP).toDouble() }

private fun Double?.normalizedPercent(): Double? = normalizedNonNegative()?.takeIf { it <= 100.0 }
