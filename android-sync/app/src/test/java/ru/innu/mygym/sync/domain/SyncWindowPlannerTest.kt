package ru.innu.mygym.sync.domain

import java.time.LocalDate
import org.junit.Assert.assertEquals
import org.junit.Test

class SyncWindowPlannerTest {
    private val today = LocalDate.of(2026, 8, 25)

    @Test
    fun `first sync covers thirty calendar days including today`() {
        val window = SyncWindowPlanner.plan(today, hasCompletedInitialSync = false)

        assertEquals(today.minusDays(29), window.start)
        assertEquals(today.plusDays(1), window.endExclusive)
    }

    @Test
    fun `following sync recalculates today and previous two days`() {
        val window = SyncWindowPlanner.plan(today, hasCompletedInitialSync = true)

        assertEquals(today.minusDays(2), window.start)
        assertEquals(today.plusDays(1), window.endExclusive)
    }
}
