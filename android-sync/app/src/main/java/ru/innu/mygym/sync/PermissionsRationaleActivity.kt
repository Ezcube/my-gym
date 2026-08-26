package ru.innu.mygym.sync

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import ru.innu.mygym.sync.ui.MyGymSyncTheme

class PermissionsRationaleActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent { MyGymSyncTheme { HealthPrivacyRationale() } }
    }
}

@Composable
private fun HealthPrivacyRationale() {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("Как «Мой зал» использует Health Connect", style = MaterialTheme.typography.headlineSmall)
        Text(
            "Приложение читает только выбранные вами показатели активности и восстановления, " +
                "преобразует их в дневные итоги и отправляет в ваш профиль на gym.innu.ru.",
        )
        Text(
            "Маршруты тренировок, геолокация, медицинские записи и необработанные ряды пульса или SpO₂ " +
                "не считываются и не отправляются. Фоновая синхронизация не используется.",
        )
        Text(
            "Доступ можно отозвать в приложении или настройках Health Connect. При отвязке локальный " +
                "токен устройства удаляется из защищённого хранилища.",
        )
    }
}
