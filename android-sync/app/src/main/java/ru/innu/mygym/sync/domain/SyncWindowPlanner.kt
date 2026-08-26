package ru.innu.mygym.sync.domain

import java.time.LocalDate

object SyncWindowPlanner {
    fun plan(today: LocalDate, hasCompletedInitialSync: Boolean): DateWindow {
        val daysBack = if (hasCompletedInitialSync) 2L else 29L
        return DateWindow(
            start = today.minusDays(daysBack),
            endExclusive = today.plusDays(1),
        )
    }
}
