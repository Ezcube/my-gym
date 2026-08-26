package ru.innu.mygym.sync

import androidx.test.core.app.ApplicationProvider
import androidx.test.ext.junit.runners.AndroidJUnit4
import android.content.pm.PackageManager
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import ru.innu.mygym.sync.data.KeystoreTokenStore
import ru.innu.mygym.sync.domain.DeviceCredentials
import ru.innu.mygym.sync.health.HealthConnectGateway

@RunWith(AndroidJUnit4::class)
class PermissionAndRevokeInstrumentedTest {
    private val context = ApplicationProvider.getApplicationContext<android.content.Context>()

    @Test
    fun requestedHealthPermissionsAreReadOnlyAndExcludeBackgroundAndLocation() {
        val permissions = HealthConnectGateway(context).requiredPermissions
        val declared = context.packageManager
            .getPackageInfo(context.packageName, PackageManager.GET_PERMISSIONS)
            .requestedPermissions
            ?.toSet()
            .orEmpty()

        assertTrue(permissions.isNotEmpty())
        assertTrue(declared.containsAll(permissions))
        assertTrue(permissions.all { ".READ_" in it })
        assertFalse(permissions.any { "BACKGROUND" in it || "LOCATION" in it || ".WRITE_" in it })
    }

    @Test
    fun localRevokeClearsKeystoreProtectedCredentials() {
        val store = KeystoreTokenStore(context)
        store.clear()
        val credentials = DeviceCredentials(deviceId = "device-test", token = "scoped-test-token")

        store.save(credentials)
        assertEquals(credentials, store.read())
        store.clear()

        assertNull(store.read())
    }
}
