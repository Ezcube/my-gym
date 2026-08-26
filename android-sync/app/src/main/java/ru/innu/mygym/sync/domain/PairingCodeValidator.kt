package ru.innu.mygym.sync.domain

import java.util.Locale

object PairingCodeValidator {
    private val allowed = Regex("^[A-Z0-9]{8}$")

    fun validate(raw: String): PairingValidation {
        val normalized = raw
            .filterNot { it.isWhitespace() || it == '-' }
            .uppercase(Locale.ROOT)
        return PairingValidation(normalized, allowed.matches(normalized))
    }
}
