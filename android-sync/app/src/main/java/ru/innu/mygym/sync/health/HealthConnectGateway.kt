package ru.innu.mygym.sync.health

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregateMetric
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ActiveCaloriesBurnedRecord
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeartRateRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.nio.charset.StandardCharsets
import java.security.MessageDigest
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import ru.innu.mygym.sync.domain.DailyAggregateSource
import ru.innu.mygym.sync.domain.DateWindow
import ru.innu.mygym.sync.domain.HealthDailySummary
import ru.innu.mygym.sync.domain.HealthRecordMapper
import ru.innu.mygym.sync.domain.HealthWorkout
import ru.innu.mygym.sync.domain.WorkoutSource

enum class HealthConnectAvailability {
    AVAILABLE,
    UPDATE_REQUIRED,
    UNAVAILABLE,
}

data class HealthSnapshot(
    val daily: List<HealthDailySummary>,
    val workouts: List<HealthWorkout>,
)

class HealthConnectGateway(private val context: Context) {
    val requiredPermissions: Set<String> = setOf(
        HealthPermission.getReadPermission(StepsRecord::class),
        HealthPermission.getReadPermission(ExerciseSessionRecord::class),
        HealthPermission.getReadPermission(ActiveCaloriesBurnedRecord::class),
        HealthPermission.getReadPermission(SleepSessionRecord::class),
        HealthPermission.getReadPermission(WeightRecord::class),
        HealthPermission.getReadPermission(BodyFatRecord::class),
        HealthPermission.getReadPermission(HeartRateRecord::class),
        HealthPermission.getReadPermission(OxygenSaturationRecord::class),
    )

    fun availability(): HealthConnectAvailability = when (HealthConnectClient.getSdkStatus(context)) {
        HealthConnectClient.SDK_AVAILABLE -> HealthConnectAvailability.AVAILABLE
        HealthConnectClient.SDK_UNAVAILABLE_PROVIDER_UPDATE_REQUIRED -> HealthConnectAvailability.UPDATE_REQUIRED
        else -> HealthConnectAvailability.UNAVAILABLE
    }

    suspend fun grantedPermissions(): Set<String> = client().permissionController.getGrantedPermissions()

    suspend fun revokeAllPermissions() {
        if (availability() == HealthConnectAvailability.AVAILABLE) {
            client().permissionController.revokeAllPermissions()
        }
    }

    suspend fun read(window: DateWindow, zoneId: ZoneId, granted: Set<String>): HealthSnapshot {
        require(granted.isNotEmpty()) { "At least one Health Connect permission is required" }
        val mapper = HealthRecordMapper(zoneId)
        val start = window.start.atStartOfDay(zoneId).toInstant()
        val end = window.endExclusive.atStartOfDay(zoneId).toInstant()
        val timeFilter = TimeRangeFilter.between(start, end)

        val weightByDate = if (canRead<WeightRecord>(granted)) {
            readAll<WeightRecord>(timeFilter)
                .groupBy { it.time.atZone(zoneId).toLocalDate() }
                .mapValues { (_, values) -> values.maxBy(WeightRecord::time).weight.inKilograms }
        } else emptyMap()
        val bodyFatByDate = if (canRead<BodyFatRecord>(granted)) {
            readAll<BodyFatRecord>(timeFilter)
                .groupBy { it.time.atZone(zoneId).toLocalDate() }
                .mapValues { (_, values) -> values.maxBy(BodyFatRecord::time).percentage.value }
        } else emptyMap()
        val oxygenByDate = if (canRead<OxygenSaturationRecord>(granted)) {
            readAll<OxygenSaturationRecord>(timeFilter)
                .groupBy { it.time.atZone(zoneId).toLocalDate() }
                .mapValues { (_, values) -> values.map { it.percentage.value }.average() }
        } else emptyMap()

        val daily = mutableListOf<HealthDailySummary>()
        var date = window.start
        while (date < window.endExclusive) {
            val dayStart = date.atStartOfDay(zoneId).toInstant()
            val dayEnd = date.plusDays(1).atStartOfDay(zoneId).toInstant()
            val aggregate = aggregateDay(dayStart, dayEnd, granted)
            daily += mapper.dailySummary(
                DailyAggregateSource(
                    date = date,
                    steps = aggregate.steps,
                    activeCaloriesKcal = aggregate.activeCaloriesKcal,
                    sleepMinutes = aggregate.sleepMinutes,
                    weightKg = weightByDate[date],
                    bodyFatPercent = bodyFatByDate[date],
                    heartRateAvgBpm = aggregate.heartRateAvgBpm,
                    heartRateMinBpm = aggregate.heartRateMinBpm,
                    heartRateMaxBpm = aggregate.heartRateMaxBpm,
                    oxygenSaturationAvgPercent = oxygenByDate[date],
                ),
            )
            date = date.plusDays(1)
        }

        val workouts = if (canRead<ExerciseSessionRecord>(granted)) {
            readAll<ExerciseSessionRecord>(timeFilter).map { record ->
                val calories = if (canRead<ActiveCaloriesBurnedRecord>(granted)) {
                    activeCalories(record.startTime, record.endTime)
                } else null
                mapper.workout(
                    WorkoutSource(
                        providerId = stableProviderId(record),
                        start = record.startTime,
                        end = record.endTime,
                        exerciseType = record.exerciseType,
                        title = record.title,
                        activeCaloriesKcal = calories,
                    ),
                )
            }
        } else emptyList()

        return HealthSnapshot(daily = daily, workouts = workouts)
    }

    private suspend fun aggregateDay(start: Instant, end: Instant, granted: Set<String>): DayAggregate {
        val metrics = mutableSetOf<AggregateMetric<*>>()
        if (canRead<StepsRecord>(granted)) metrics += StepsRecord.COUNT_TOTAL
        if (canRead<ActiveCaloriesBurnedRecord>(granted)) metrics += ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL
        if (canRead<SleepSessionRecord>(granted)) metrics += SleepSessionRecord.SLEEP_DURATION_TOTAL
        if (canRead<HeartRateRecord>(granted)) {
            metrics += HeartRateRecord.BPM_AVG
            metrics += HeartRateRecord.BPM_MIN
            metrics += HeartRateRecord.BPM_MAX
        }
        if (metrics.isEmpty()) return DayAggregate()

        val result = client().aggregate(
            AggregateRequest(
                metrics = metrics,
                timeRangeFilter = TimeRangeFilter.between(start, end),
            ),
        )
        return DayAggregate(
            steps = result[StepsRecord.COUNT_TOTAL],
            activeCaloriesKcal = result[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories,
            sleepMinutes = result[SleepSessionRecord.SLEEP_DURATION_TOTAL]?.toMinutes(),
            heartRateAvgBpm = result[HeartRateRecord.BPM_AVG]?.toDouble(),
            heartRateMinBpm = result[HeartRateRecord.BPM_MIN],
            heartRateMaxBpm = result[HeartRateRecord.BPM_MAX],
        )
    }

    private suspend fun activeCalories(start: Instant, end: Instant): Double? = client().aggregate(
        AggregateRequest(
            metrics = setOf(ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL),
            timeRangeFilter = TimeRangeFilter.between(start, end),
        ),
    )[ActiveCaloriesBurnedRecord.ACTIVE_CALORIES_TOTAL]?.inKilocalories

    private inline fun <reified T : Record> canRead(granted: Set<String>): Boolean =
        HealthPermission.getReadPermission(T::class) in granted

    private suspend inline fun <reified T : Record> readAll(filter: TimeRangeFilter): List<T> {
        val output = mutableListOf<T>()
        var pageToken: String? = null
        do {
            val response = client().readRecords(
                ReadRecordsRequest<T>(
                    timeRangeFilter = filter,
                    ascendingOrder = true,
                    pageSize = 1_000,
                    pageToken = pageToken,
                ),
            )
            output += response.records
            pageToken = response.pageToken
        } while (pageToken != null)
        return output
    }

    private fun stableProviderId(record: ExerciseSessionRecord): String {
        val source = buildString {
            append(record.metadata.dataOrigin.packageName)
            append(':')
            append(record.metadata.id)
            append(':')
            append(record.startTime)
            append(':')
            append(record.endTime)
            append(':')
            append(record.exerciseType)
        }
        return MessageDigest.getInstance("SHA-256")
            .digest(source.toByteArray(StandardCharsets.UTF_8))
            .joinToString("") { "%02x".format(it.toInt() and 0xff) }
    }

    private fun client(): HealthConnectClient {
        check(availability() == HealthConnectAvailability.AVAILABLE) { "Health Connect is unavailable" }
        return HealthConnectClient.getOrCreate(context)
    }
}

private data class DayAggregate(
    val steps: Long? = null,
    val activeCaloriesKcal: Double? = null,
    val sleepMinutes: Long? = null,
    val heartRateAvgBpm: Double? = null,
    val heartRateMinBpm: Long? = null,
    val heartRateMaxBpm: Long? = null,
)
