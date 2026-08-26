package ru.innu.mygym.sync.data

import android.content.Context
import java.time.Instant

class SyncPreferences(context: Context) {
    private val preferences = context.getSharedPreferences("my_gym_sync_state", Context.MODE_PRIVATE)

    var hasCompletedInitialSync: Boolean
        get() = preferences.getBoolean(INITIAL_SYNC, false)
        set(value) { preferences.edit().putBoolean(INITIAL_SYNC, value).apply() }

    var lastSuccessfulSync: Instant?
        get() = preferences.getString(LAST_SYNC, null)?.let { runCatching { Instant.parse(it) }.getOrNull() }
        set(value) { preferences.edit().putString(LAST_SYNC, value?.toString()).apply() }

    fun clear() {
        preferences.edit().clear().apply()
    }

    private companion object {
        const val INITIAL_SYNC = "initial_sync_completed"
        const val LAST_SYNC = "last_successful_sync"
    }
}
