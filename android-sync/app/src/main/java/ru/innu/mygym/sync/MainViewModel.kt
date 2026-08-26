package ru.innu.mygym.sync

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.time.Clock
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import ru.innu.mygym.sync.data.KeystoreTokenStore
import ru.innu.mygym.sync.data.SyncPreferences
import ru.innu.mygym.sync.domain.PairingCodeValidator
import ru.innu.mygym.sync.domain.SyncBatchFactory
import ru.innu.mygym.sync.domain.SyncWindowPlanner
import ru.innu.mygym.sync.health.HealthConnectAvailability
import ru.innu.mygym.sync.health.HealthConnectGateway
import ru.innu.mygym.sync.network.HealthApiException
import ru.innu.mygym.sync.network.HttpHealthSyncApi

data class SyncUiState(
    val healthAvailability: HealthConnectAvailability = HealthConnectAvailability.UNAVAILABLE,
    val paired: Boolean = false,
    val deviceActive: Boolean = false,
    val grantedPermissionCount: Int = 0,
    val requiredPermissionCount: Int = 0,
    val lastSuccessfulSync: Instant? = null,
    val busy: Boolean = false,
    val message: String? = null,
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val tokenStore = KeystoreTokenStore(application)
    private val preferences = SyncPreferences(application)
    private val health = HealthConnectGateway(application)
    private val api = HttpHealthSyncApi()
    private val batches = SyncBatchFactory()
    private val clock = Clock.systemDefaultZone()
    private val syncMutex = Mutex()

    private val mutableState = MutableStateFlow(
        SyncUiState(
            healthAvailability = health.availability(),
            paired = tokenStore.read() != null,
            requiredPermissionCount = health.requiredPermissions.size,
            lastSuccessfulSync = preferences.lastSuccessfulSync,
        ),
    )
    val state: StateFlow<SyncUiState> = mutableState.asStateFlow()

    val requestedPermissions: Set<String>
        get() = health.requiredPermissions

    fun onOpen() {
        viewModelScope.launch {
            val availability = health.availability()
            val credentials = tokenStore.read()
            val granted = if (availability == HealthConnectAvailability.AVAILABLE) {
                runCatching { health.grantedPermissions() }.getOrDefault(emptySet())
            } else emptySet()
            val status = credentials?.let { runCatching { api.status(it) }.getOrNull() }
            mutableState.update {
                it.copy(
                    healthAvailability = availability,
                    paired = credentials != null,
                    deviceActive = status?.active ?: false,
                    grantedPermissionCount = granted.size,
                    lastSuccessfulSync = preferences.lastSuccessfulSync,
                )
            }
            if (credentials != null && granted.isNotEmpty()) performSync(credentials, granted)
        }
    }

    fun pair(rawCode: String) {
        val validation = PairingCodeValidator.validate(rawCode)
        if (!validation.isValid) {
            mutableState.update { it.copy(message = "Введите код из 8 букв или цифр") }
            return
        }
        if (mutableState.value.busy) return

        viewModelScope.launch {
            mutableState.update { it.copy(busy = true, message = null) }
            runCatching {
                api.pair(validation.normalized, deviceName())
            }.onSuccess { credentials ->
                tokenStore.save(credentials)
                mutableState.update {
                    it.copy(
                        paired = true,
                        deviceActive = true,
                        busy = false,
                        message = "Устройство привязано. Разрешите чтение данных Health Connect.",
                    )
                }
            }.onFailure { error ->
                mutableState.update { it.copy(busy = false, message = error.userMessage("Не удалось привязать устройство")) }
            }
        }
    }

    fun onPermissionsResult(granted: Set<String>) {
        mutableState.update {
            it.copy(
                grantedPermissionCount = granted.size,
                message = if (granted.isEmpty()) {
                    "Доступ не предоставлен — данные не отправляются"
                } else {
                    "Доступ обновлён"
                },
            )
        }
        if (granted.isNotEmpty()) syncNow()
    }

    fun syncNow() {
        if (mutableState.value.busy) return
        viewModelScope.launch {
            val credentials = tokenStore.read()
            if (credentials == null) {
                mutableState.update { it.copy(message = "Сначала привяжите устройство") }
                return@launch
            }
            if (health.availability() != HealthConnectAvailability.AVAILABLE) {
                mutableState.update { it.copy(message = "Health Connect недоступен или требует обновления") }
                return@launch
            }
            val granted = runCatching { health.grantedPermissions() }
                .getOrElse { error ->
                    mutableState.update { it.copy(message = error.userMessage("Не удалось проверить разрешения")) }
                    return@launch
                }
            mutableState.update { it.copy(grantedPermissionCount = granted.size) }
            if (granted.isEmpty()) {
                mutableState.update { it.copy(message = "Разрешите хотя бы один тип данных Health Connect") }
                return@launch
            }
            performSync(credentials, granted)
        }
    }

    fun revoke() {
        if (mutableState.value.busy) return
        viewModelScope.launch {
            val credentials = tokenStore.read()
            mutableState.update { it.copy(busy = true, message = null) }
            runCatching {
                if (credentials != null) {
                    try {
                        api.revoke(credentials)
                    } catch (error: HealthApiException) {
                        if (error.statusCode !in setOf(401, 404)) throw error
                    }
                }
            }.onFailure { error ->
                mutableState.update { it.copy(busy = false, message = error.userMessage("Не удалось отозвать устройство на сервере")) }
                return@launch
            }

            val permissionError = runCatching { health.revokeAllPermissions() }.exceptionOrNull()
            tokenStore.clear()
            preferences.clear()
            mutableState.update {
                it.copy(
                    paired = false,
                    deviceActive = false,
                    grantedPermissionCount = 0,
                    lastSuccessfulSync = null,
                    busy = false,
                    message = permissionError?.userMessage("Устройство отвязано, но проверьте разрешения Health Connect")
                        ?: "Устройство отвязано, локальный токен удалён",
                )
            }
        }
    }

    private suspend fun performSync(
        credentials: ru.innu.mygym.sync.domain.DeviceCredentials,
        granted: Set<String>,
    ) {
        if (!syncMutex.tryLock()) return
        try {
            mutableState.update { it.copy(busy = true, message = "Синхронизация…") }
            runCatching {
                val zone = ZoneId.systemDefault()
                val today = LocalDate.now(clock)
                val window = SyncWindowPlanner.plan(today, preferences.hasCompletedInitialSync)
                val snapshot = health.read(window, zone, granted)
                val batch = batches.create(zone.id, snapshot.daily, snapshot.workouts)
                api.sync(credentials, batch)
                val completedAt = Instant.now(clock)
                preferences.hasCompletedInitialSync = true
                preferences.lastSuccessfulSync = completedAt
                completedAt
            }.onSuccess { completedAt ->
                mutableState.update {
                    it.copy(
                        deviceActive = true,
                        lastSuccessfulSync = completedAt,
                        busy = false,
                        message = "Данные синхронизированы",
                    )
                }
            }.onFailure { error ->
                mutableState.update { it.copy(busy = false, message = error.userMessage("Синхронизация не выполнена")) }
            }
        } finally {
            syncMutex.unlock()
        }
    }

    private fun deviceName(): String = listOf(Build.MANUFACTURER, Build.MODEL)
        .map(String::trim)
        .filter(String::isNotEmpty)
        .distinct()
        .joinToString(" ")
        .ifBlank { "Android" }

    private fun Throwable.userMessage(prefix: String): String = when (this) {
        is HealthApiException -> "$prefix (HTTP $statusCode)"
        is SecurityException -> "$prefix: доступ отозван"
        else -> prefix
    }
}
