package ru.innu.mygym.sync.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.unit.dp
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import ru.innu.mygym.sync.SyncUiState
import ru.innu.mygym.sync.health.HealthConnectAvailability

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MyGymSyncScreen(
    state: SyncUiState,
    baseUrl: String,
    onPair: (String) -> Unit,
    onRequestPermissions: () -> Unit,
    onOpenHealthConnect: () -> Unit,
    onSync: () -> Unit,
    onRevoke: () -> Unit,
) {
    var pairingCode by remember { mutableStateOf("") }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Мой зал · Samsung Health") }) },
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(20.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp),
        ) {
            Text(
                "Samsung Health передаёт данные часов в Health Connect. Это приложение отправляет " +
                    "в «Мой зал» только дневные итоги и тренировки.",
                style = MaterialTheme.typography.bodyLarge,
            )

            StatusCard(state, baseUrl)

            if (!state.paired) {
                OutlinedTextField(
                    value = pairingCode,
                    onValueChange = { pairingCode = it.take(12) },
                    modifier = Modifier.fillMaxWidth(),
                    label = { Text("Код привязки из «Моего зала»") },
                    supportingText = { Text("8 букв или цифр, действует 10 минут") },
                    singleLine = true,
                    keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
                    enabled = !state.busy,
                )
                Button(
                    onClick = { onPair(pairingCode) },
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.busy,
                ) { Text("Привязать устройство") }
            } else {
                Button(
                    onClick = onRequestPermissions,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.busy && state.healthAvailability == HealthConnectAvailability.AVAILABLE,
                ) { Text("Выбрать данные Health Connect") }
                OutlinedButton(
                    onClick = onOpenHealthConnect,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.busy && state.healthAvailability == HealthConnectAvailability.AVAILABLE,
                ) { Text("Открыть настройки Health Connect") }
                Button(
                    onClick = onSync,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.busy && state.grantedPermissionCount > 0,
                ) { Text("Синхронизировать сейчас") }
                OutlinedButton(
                    onClick = onRevoke,
                    modifier = Modifier.fillMaxWidth(),
                    enabled = !state.busy,
                ) { Text("Отвязать устройство и отозвать доступ") }
            }

            if (state.busy) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.Center,
                ) { CircularProgressIndicator() }
            }
            state.message?.let { Text(it, color = MaterialTheme.colorScheme.secondary) }

            Text(
                "Только чтение: шаги, тренировки, активные калории, сон, вес, жир, сводные " +
                    "пульс и SpO₂. Нет GPS, ЭКГ, давления, медицинских записей, записи в Health " +
                    "Connect и фонового доступа.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun StatusCard(state: SyncUiState, baseUrl: String) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Text("Состояние", style = MaterialTheme.typography.titleMedium)
            Text("Сервер: $baseUrl")
            Text("Устройство: ${if (state.paired) "привязано" else "не привязано"}")
            if (state.paired) Text("Серверный токен: ${if (state.deviceActive) "активен" else "не подтверждён"}")
            Text(
                "Health Connect: " + when (state.healthAvailability) {
                    HealthConnectAvailability.AVAILABLE -> "доступен"
                    HealthConnectAvailability.UPDATE_REQUIRED -> "нужно обновить"
                    HealthConnectAvailability.UNAVAILABLE -> "недоступен"
                },
            )
            Text("Разрешено типов данных: ${state.grantedPermissionCount} из ${state.requiredPermissionCount}")
            Text(
                "Последняя синхронизация: " + (state.lastSuccessfulSync?.atZone(ZoneId.systemDefault())
                    ?.format(DateTimeFormatter.ofPattern("dd.MM.yyyy HH:mm")) ?: "ещё не выполнялась"),
            )
        }
    }
}
