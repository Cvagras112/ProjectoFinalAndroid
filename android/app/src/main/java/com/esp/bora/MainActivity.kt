package com.esp.bora

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.fragment.app.FragmentActivity
import com.esp.bora.ui.BoraApp
import com.esp.bora.ui.theme.BoraTheme

// Se usa FragmentActivity (y no ComponentActivity) porque BiometricPrompt lo requiere.
class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            BoraTheme {
                BoraApp(activity = this)
            }
        }
    }
}
