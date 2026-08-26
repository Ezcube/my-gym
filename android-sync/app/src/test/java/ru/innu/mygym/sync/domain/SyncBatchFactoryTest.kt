package ru.innu.mygym.sync.domain

import java.time.LocalDate
import java.util.UUID
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class SyncBatchFactoryTest {
    private val factory = SyncBatchFactory()

    @Test
    fun `same normalized payload produces stable batch id and digest regardless of input order`() {
        val firstDay = HealthDailySummary(date = LocalDate.of(2026, 8, 24), steps = 1_000)
        val secondDay = HealthDailySummary(date = LocalDate.of(2026, 8, 25), steps = 2_000)

        val first = factory.create("Europe/Moscow", listOf(secondDay, firstDay), emptyList())
        val second = factory.create("Europe/Moscow", listOf(firstDay, secondDay), emptyList())

        assertEquals(first.digest, second.digest)
        assertEquals(first.batchId, second.batchId)
        assertEquals(listOf(firstDay, secondDay), first.daily)
        assertEquals(64, first.digest.length)
        assertEquals(5, UUID.fromString(first.batchId).version())
    }

    @Test
    fun `changed normalized value produces another idempotency identity`() {
        val date = LocalDate.of(2026, 8, 25)

        val first = factory.create("Europe/Moscow", listOf(HealthDailySummary(date, steps = 2_000)), emptyList())
        val changed = factory.create("Europe/Moscow", listOf(HealthDailySummary(date, steps = 2_001)), emptyList())

        assertNotEquals(first.digest, changed.digest)
        assertNotEquals(first.batchId, changed.batchId)
    }
}
