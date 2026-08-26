package ru.innu.mygym.sync.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val MyGymColors = darkColorScheme(
    primary = Color(0xFF6EEB83),
    onPrimary = Color(0xFF08210D),
    secondary = Color(0xFFA9DDB0),
    background = Color(0xFF111412),
    onBackground = Color(0xFFE7EDE8),
    surface = Color(0xFF1A1F1B),
    onSurface = Color(0xFFE7EDE8),
    surfaceVariant = Color(0xFF252C27),
    onSurfaceVariant = Color(0xFFC0C9C1),
    error = Color(0xFFFFB4AB),
)

@Composable
fun MyGymSyncTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = MyGymColors, content = content)
}
