package com.esp.bora.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Paleta de la identidad BORA: verde principal, terracota de acento, fondo crema y texto gris oscuro.
private val BoraGreen = Color(0xFF2E6B3E)
private val BoraGreenDark = Color(0xFF154728)
private val BoraTerracotta = Color(0xFFE2692B)
private val BoraCream = Color(0xFFFEFDF7)
private val BoraInk = Color(0xFF2B2B2B)
private val BoraSand = Color(0xFFF1EFE6)

private val BoraColors = lightColorScheme(
    primary = BoraGreen,
    onPrimary = Color.White,
    primaryContainer = Color(0xFFDDEBDD),
    onPrimaryContainer = BoraGreenDark,
    secondary = BoraTerracotta,
    onSecondary = Color.White,
    background = BoraCream,
    onBackground = BoraInk,
    surface = BoraCream,
    onSurface = BoraInk,
    surfaceVariant = BoraSand,
    onSurfaceVariant = Color(0xFF5A5A52),
    surfaceContainerLowest = Color.White,
    surfaceContainerLow = BoraCream,
    surfaceContainer = BoraSand,
    surfaceContainerHigh = BoraSand,
    surfaceContainerHighest = BoraSand,
    outline = Color(0xFF8A8A80),
    error = Color(0xFFB3261E),
)

@Composable
fun BoraTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = BoraColors,
        typography = Typography(),
        content = content,
    )
}
