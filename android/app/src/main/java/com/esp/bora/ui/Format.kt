package com.esp.bora.ui

import java.text.NumberFormat
import java.util.Locale

private val clpFormat: NumberFormat =
    NumberFormat.getCurrencyInstance(Locale.forLanguageTag("es-CL")).apply {
        maximumFractionDigits = 0
    }

/** 12500 -> "$12.500" */
fun formatClp(price: Long): String = clpFormat.format(price)
