package ru.innu.mygym.sync.data

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.nio.charset.StandardCharsets
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec
import ru.innu.mygym.sync.domain.DeviceCredentials

interface TokenStore {
    fun read(): DeviceCredentials?
    fun save(credentials: DeviceCredentials)
    fun clear()
}

class KeystoreTokenStore(context: Context) : TokenStore {
    private val preferences = context.getSharedPreferences(PREFERENCES, Context.MODE_PRIVATE)

    override fun read(): DeviceCredentials? {
        val encoded = preferences.getString(CREDENTIALS, null) ?: return null
        return runCatching {
            val parts = encoded.split('.', limit = 2)
            require(parts.size == 2)
            val iv = Base64.decode(parts[0], Base64.NO_WRAP)
            val ciphertext = Base64.decode(parts[1], Base64.NO_WRAP)
            val cipher = Cipher.getInstance(TRANSFORMATION)
            cipher.init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(128, iv))
            val plaintext = cipher.doFinal(ciphertext).toString(StandardCharsets.UTF_8)
            val values = plaintext.split('\u0000', limit = 2)
            require(values.size == 2 && values.all(String::isNotBlank))
            DeviceCredentials(deviceId = values[0], token = values[1])
        }.getOrElse {
            clear()
            null
        }
    }

    override fun save(credentials: DeviceCredentials) {
        require(credentials.deviceId.isNotBlank() && credentials.token.isNotBlank())
        val plaintext = "${credentials.deviceId}\u0000${credentials.token}"
            .toByteArray(StandardCharsets.UTF_8)
        val cipher = Cipher.getInstance(TRANSFORMATION)
        cipher.init(Cipher.ENCRYPT_MODE, secretKey())
        val encoded = listOf(cipher.iv, cipher.doFinal(plaintext))
            .joinToString(".") { Base64.encodeToString(it, Base64.NO_WRAP) }
        check(preferences.edit().putString(CREDENTIALS, encoded).commit())
    }

    override fun clear() {
        preferences.edit().remove(CREDENTIALS).commit()
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getKey(KEY_ALIAS, null) as? SecretKey)?.let { return it }

        return KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE).run {
            init(
                KeyGenParameterSpec.Builder(
                    KEY_ALIAS,
                    KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT,
                )
                    .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                    .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                    .setRandomizedEncryptionRequired(true)
                    .build(),
            )
            generateKey()
        }
    }

    private companion object {
        const val PREFERENCES = "my_gym_sync_secrets"
        const val CREDENTIALS = "device_credentials"
        const val KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "my_gym_sync_device_token_v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
    }
}
