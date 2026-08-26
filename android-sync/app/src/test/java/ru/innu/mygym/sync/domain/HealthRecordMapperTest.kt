package ru.innu.mygym.sync.domain

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HealthRecordMapperTest {
    private val zone = ZoneId.of("Europe/Moscow")
    private val mapper = HealthRecordMapper(zone)

    @Test
    fun `maps aggregates to their local calendar day and keeps only normalized values`() {
        val date = LocalDate.of(2026, 8, 25)
        val summary = mapper.dailySummary(
            DailyAggregateSource(
                date = date,
                steps = 8_421,
                activeCaloriesKcal = 442.126,
                sleepMinutes = 437,
                weightKg = 81.234,
                bodyFatPercent = 18.456,
                heartRateAvgBpm = 68.4,
                heartRateMinBpm = 49,
                heartRateMaxBpm = 137,
                oxygenSaturationAvgPercent = 97.123,
            ),
        )

        assertEquals(date, summary.date)
        assertEquals(8_421L, summary.steps)
        assertEquals(442.13, summary.activeCaloriesKcal!!, 0.0)
        assertEquals(81.23, summary.weightKg!!, 0.0)
        assertEquals(18.46, summary.bodyFatPercent!!, 0.0)
        assertEquals(97.12, summary.oxygenSaturationAvgPercent!!, 0.0)
    }

    @Test
    fun `maps a workout without route or sensor samples`() {
        val workout = mapper.workout(
            WorkoutSource(
                providerId = "health-connect-id",
                start = Instant.parse("2026-08-25T08:00:00Z"),
                end = Instant.parse("2026-08-25T08:45:00Z"),
                exerciseType = 56,
                title = "Morning run",
                activeCaloriesKcal = null,
            ),
        )

        assertEquals("hc:health-connect-id", workout.externalId)
        assertEquals(45, workout.durationMinutes)
        assertEquals("Europe/Moscow", workout.timezone)
        assertNull(workout.activeCaloriesKcal)
    }
}
