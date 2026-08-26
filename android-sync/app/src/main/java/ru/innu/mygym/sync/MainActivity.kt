package ru.innu.mygym.sync

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.compose.LifecycleEventEffect
import androidx.lifecycle.viewmodel.compose.viewModel
import ru.innu.mygym.sync.ui.MyGymSyncScreen
import ru.innu.mygym.sync.ui.MyGymSyncTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MyGymSyncTheme {
                val viewModel: MainViewModel = viewModel()
                val state by viewModel.state.collectAsStateWithLifecycle()
                val permissionLauncher = rememberLauncherForActivityResult(
                    PermissionController.createRequestPermissionResultContract(),
                    viewModel::onPermissionsResult,
                )

                LifecycleEventEffect(Lifecycle.Event.ON_START) { viewModel.onOpen() }
                MyGymSyncScreen(
                    state = state,
                    baseUrl = BuildConfig.BASE_URL,
                    onPair = viewModel::pair,
                    onRequestPermissions = { permissionLauncher.launch(viewModel.requestedPermissions) },
                    onOpenHealthConnect = {
                        startActivity(Intent(HealthConnectClient.ACTION_HEALTH_CONNECT_SETTINGS))
                    },
                    onSync = viewModel::syncNow,
                    onRevoke = viewModel::revoke,
                )
            }
        }
    }
}
