package ru.innu.mygym.sync.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PairingCodeValidatorTest {
    @Test
    fun `normalizes separators and lowercase before validation`() {
        val result = PairingCodeValidator.validate("ab12-cd34")

        assertTrue(result.isValid)
        assertEquals("AB12CD34", result.normalized)
    }

    @Test
    fun `rejects codes that are not exactly eight alphanumeric characters`() {
        assertFalse(PairingCodeValidator.validate("ABC1234").isValid)
        assertFalse(PairingCodeValidator.validate("ABC123456").isValid)
        assertFalse(PairingCodeValidator.validate("ABC12!34").isValid)
    }
}
