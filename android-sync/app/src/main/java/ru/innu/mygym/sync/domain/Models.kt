package ru.innu.mygym.sync.domain

import java.time.Instant
import java.time.LocalDate

data class DailyAggregateSource(
    val date: LocalDate,
    val steps: Long? = null,
    val activeCaloriesKcal: Double? = null,
    val sleepMinutes: Long? = null,
    val weightKg: Double? = null,
    val bodyFatPercent: Double? = null,
    val heartRateAvgBpm: Double? = null,
    val heartRateMinBpm: Long? = null,
    val heartRateMaxBpm: Long? = null,
    val oxygenSaturationAvgPercent: Double? = null,
)

data class WorkoutSource(
    val providerId: String,
    val start: Instant,
    val end: Instant,
    val exerciseType: Int,
    val title: String?,
    val activeCaloriesKcal: Double?,
)

data class HealthDailySummary(
    val date: LocalDate,
    val steps: Long? = null,
    val activeCaloriesKcal: Double? = null,
    val sleepMinutes: Long? = null,
    val weightKg: Double? = null,
    val bodyFatPercent: Double? = null,
    val heartRateAvgBpm: Double? = null,
    val heartRateMinBpm: Long? = null,
    val heartRateMaxBpm: Long? = null,
    val oxygenSaturationAvgPercent: Double? = null,
)

data class HealthWorkout(
    val externalId: String,
    val start: Instant,
    val end: Instant,
    val durationMinutes: Long,
    val timezone: String,
    val exerciseType: Int,
    val title: String?,
    val activeCaloriesKcal: Double?,
)

data class HealthSyncBatch(
    val batchId: String,
    val digest: String,
    val timezone: String,
    val daily: List<HealthDailySummary>,
    val workouts: List<HealthWorkout>,
    val tombstones: List<String> = emptyList(),
)

data class DateWindow(
    val start: LocalDate,
    val endExclusive: LocalDate,
)

data class PairingValidation(
    val normalized: String,
    val isValid: Boolean,
)

data class DeviceCredentials(
    val deviceId: String,
    val token: String,
)
