package ru.innu.mygym.sync.network

import java.net.HttpURLConnection
import java.net.URI
import java.net.URLEncoder
import java.nio.charset.StandardCharsets
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import ru.innu.mygym.sync.BuildConfig
import ru.innu.mygym.sync.domain.DeviceCredentials
import ru.innu.mygym.sync.domain.HealthDailySummary
import ru.innu.mygym.sync.domain.HealthSyncBatch
import ru.innu.mygym.sync.domain.HealthWorkout

data class DeviceStatus(
    val active: Boolean,
    val lastSyncAt: String?,
)

interface HealthSyncApi {
    suspend fun pair(code: String, deviceName: String): DeviceCredentials
    suspend fun sync(credentials: DeviceCredentials, batch: HealthSyncBatch)
    suspend fun status(credentials: DeviceCredentials): DeviceStatus
    suspend fun revoke(credentials: DeviceCredentials)
}

class HttpHealthSyncApi(
    configuredBaseUrl: String = BuildConfig.BASE_URL,
) : HealthSyncApi {
    private val baseUrl = configuredBaseUrl.trimEnd('/').also { value ->
        val uri = URI(value)
        require(uri.scheme == "https" && !uri.host.isNullOrBlank()) {
            "MY_GYM_BASE_URL must be an absolute HTTPS URL"
        }
    }

    override suspend fun pair(code: String, deviceName: String): DeviceCredentials {
        val response = request(
            method = "POST",
            path = "/api/health/devices/pair",
            body = JSONObject()
                .put("code", code)
                .put("deviceName", deviceName.take(80))
                .put("platform", "android")
                .put("appVersion", BuildConfig.VERSION_NAME),
        )
        return DeviceCredentials(
            deviceId = response.requireString("deviceId"),
            token = response.requireString("token"),
        )
    }

    override suspend fun sync(credentials: DeviceCredentials, batch: HealthSyncBatch) {
        request(
            method = "POST",
            path = "/api/health/sync",
            credentials = credentials,
            body = batch.toJson(),
            idempotencyKey = batch.batchId,
            digest = batch.digest,
        )
    }

    override suspend fun status(credentials: DeviceCredentials): DeviceStatus {
        val response = request(
            method = "GET",
            path = "/api/health/devices/${credentials.deviceId.pathSegment()}",
            credentials = credentials,
        )
        return DeviceStatus(
            active = response.optBoolean("active", false),
            lastSyncAt = if (response.isNull("lastSyncAt")) null else response.getString("lastSyncAt")
                .trim()
                .takeIf(String::isNotEmpty),
        )
    }

    override suspend fun revoke(credentials: DeviceCredentials) {
        request(
            method = "DELETE",
            path = "/api/health/devices/${credentials.deviceId.pathSegment()}",
            credentials = credentials,
        )
    }

    private suspend fun request(
        method: String,
        path: String,
        credentials: DeviceCredentials? = null,
        body: JSONObject? = null,
        idempotencyKey: String? = null,
        digest: String? = null,
    ): JSONObject = withContext(Dispatchers.IO) {
        val connection = URI("$baseUrl$path").toURL().openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = CONNECT_TIMEOUT_MS
            connection.readTimeout = READ_TIMEOUT_MS
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "MyGymHealthSync/${BuildConfig.VERSION_NAME}")
            credentials?.let { connection.setRequestProperty("Authorization", "Bearer ${it.token}") }
            idempotencyKey?.let { connection.setRequestProperty("Idempotency-Key", it) }
            digest?.let { connection.setRequestProperty("X-Content-SHA256", it) }

            if (body != null) {
                val bytes = body.toString().toByteArray(StandardCharsets.UTF_8)
                require(bytes.size <= MAX_REQUEST_BYTES) { "Health sync payload is too large" }
                connection.doOutput = true
                connection.setFixedLengthStreamingMode(bytes.size)
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { it.write(bytes) }
            }

            val status = connection.responseCode
            if (status !in 200..299) {
                connection.errorStream?.close()
                throw HealthApiException(status)
            }
            val stream = connection.inputStream ?: return@withContext JSONObject()
            val text = stream.bufferedReader(StandardCharsets.UTF_8).use { reader ->
                val output = StringBuilder()
                val buffer = CharArray(4096)
                while (true) {
                    val count = reader.read(buffer)
                    if (count < 0) break
                    output.append(buffer, 0, count)
                    require(output.length <= MAX_RESPONSE_CHARS) { "Health API response is too large" }
                }
                output.toString()
            }
            if (text.isBlank()) JSONObject() else JSONObject(text)
        } finally {
            connection.disconnect()
        }
    }

    private fun HealthSyncBatch.toJson(): JSONObject = JSONObject()
        .put("batchId", batchId)
        .put("digest", digest)
        .put("timezone", timezone)
        .put("daily", JSONArray(daily.map { it.toJson() }))
        .put("workouts", JSONArray(workouts.map { it.toJson() }))
        .put("tombstones", JSONArray(tombstones))

    private fun HealthDailySummary.toJson(): JSONObject = JSONObject()
        .put("date", date.toString())
        .putOptional("steps", steps)
        .putOptional("activeCaloriesKcal", activeCaloriesKcal)
        .putOptional("sleepMinutes", sleepMinutes)
        .putOptional("weightKg", weightKg)
        .putOptional("bodyFatPercent", bodyFatPercent)
        .putOptional("heartRateAvgBpm", heartRateAvgBpm)
        .putOptional("heartRateMinBpm", heartRateMinBpm)
        .putOptional("heartRateMaxBpm", heartRateMaxBpm)
        .putOptional("oxygenSaturationAvgPercent", oxygenSaturationAvgPercent)

    private fun HealthWorkout.toJson(): JSONObject = JSONObject()
        .put("externalId", externalId)
        .put("start", start.toString())
        .put("end", end.toString())
        .put("durationMinutes", durationMinutes)
        .put("timezone", timezone)
        .put("exerciseType", exerciseType)
        .putOptional("title", title)
        .putOptional("activeCaloriesKcal", activeCaloriesKcal)

    private fun JSONObject.putOptional(name: String, value: Any?): JSONObject = apply {
        if (value != null) put(name, value)
    }

    private fun JSONObject.requireString(name: String): String = getString(name)
        .trim()
        .also { require(it.isNotEmpty()) { "Health API omitted $name" } }

    private fun String.pathSegment(): String = URLEncoder.encode(this, StandardCharsets.UTF_8.name())
        .replace("+", "%20")

    private companion object {
        const val CONNECT_TIMEOUT_MS = 10_000
        const val READ_TIMEOUT_MS = 30_000
        const val MAX_REQUEST_BYTES = 512 * 1024
        const val MAX_RESPONSE_CHARS = 256 * 1024
    }
}

class HealthApiException(val statusCode: Int) : Exception("Health API request failed ($statusCode)")
