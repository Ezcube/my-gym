package ru.innu.mygym.sync.domain

import java.nio.ByteBuffer
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

class SyncBatchFactory {
    fun create(
        timezone: String,
        daily: List<HealthDailySummary>,
        workouts: List<HealthWorkout>,
        tombstones: List<String> = emptyList(),
    ): HealthSyncBatch {
        val sortedDaily = daily.sortedBy(HealthDailySummary::date)
        val sortedWorkouts = workouts.sortedWith(compareBy(HealthWorkout::start, HealthWorkout::externalId))
        val sortedTombstones = tombstones.distinct().sorted()
        val canonical = canonical(timezone, sortedDaily, sortedWorkouts, sortedTombstones)
        val digestBytes = MessageDigest.getInstance("SHA-256")
            .digest(canonical.toByteArray(StandardCharsets.UTF_8))
        val digest = digestBytes.joinToString("") { "%02x".format(it.toInt() and 0xff) }

        return HealthSyncBatch(
            batchId = digestUuid(digestBytes).toString(),
            digest = digest,
            timezone = timezone,
            daily = sortedDaily,
            workouts = sortedWorkouts,
            tombstones = sortedTombstones,
        )
    }

    private fun canonical(
        timezone: String,
        daily: List<HealthDailySummary>,
        workouts: List<HealthWorkout>,
        tombstones: List<String>,
    ): String = buildString {
        field("mygym-health-sync-v1")
        field(timezone)
        daily.forEach { value ->
            field("daily")
            field(value.date)
            field(value.steps)
            field(value.activeCaloriesKcal)
            field(value.sleepMinutes)
            field(value.weightKg)
            field(value.bodyFatPercent)
            field(value.heartRateAvgBpm)
            field(value.heartRateMinBpm)
            field(value.heartRateMaxBpm)
            field(value.oxygenSaturationAvgPercent)
        }
        workouts.forEach { value ->
            field("workout")
            field(value.externalId)
            field(value.start)
            field(value.end)
            field(value.durationMinutes)
            field(value.timezone)
            field(value.exerciseType)
            field(value.title)
            field(value.activeCaloriesKcal)
        }
        tombstones.forEach { value ->
            field("tombstone")
            field(value)
        }
    }

    private fun StringBuilder.field(value: Any?) {
        val text = when (value) {
            null -> ""
            is Double -> java.math.BigDecimal.valueOf(value).stripTrailingZeros().toPlainString()
            is Instant, is LocalDate -> value.toString()
            else -> value.toString()
        }
        val size = text.toByteArray(StandardCharsets.UTF_8).size
        append(size).append(':').append(text).append('\n')
    }

    private fun digestUuid(digest: ByteArray): UUID {
        val value = digest.copyOfRange(0, 16)
        value[6] = ((value[6].toInt() and 0x0f) or 0x50).toByte()
        value[8] = ((value[8].toInt() and 0x3f) or 0x80).toByte()
        val buffer = ByteBuffer.wrap(value)
        return UUID(buffer.long, buffer.long)
    }
}
