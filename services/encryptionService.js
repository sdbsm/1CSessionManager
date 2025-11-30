/**
 * Encryption Service for securing passwords using Windows DPAPI via PowerShell
 * Uses Windows Data Protection API through PowerShell ConvertTo-SecureString
 */

import { exec, execSync } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if encryption is available on this system
 */
export function isEncryptionAvailable() {
    return process.platform === 'win32';
}

/**
 * Encrypt a password using Windows DPAPI via PowerShell
 * @param {string} password - Plain text password to encrypt
 * @returns {Promise<string|null>} - Base64 encoded encrypted password or null if encryption failed
 */
export async function encryptPassword(password) {
    if (!password || password.trim() === '') {
        return null;
    }

    if (!isEncryptionAvailable()) {
        console.warn('[ENCRYPTION] DPAPI not available (not Windows), password will not be encrypted');
        return null;
    }

    try {
        // Use base64 encoding to avoid escaping issues with special characters
        const passwordBase64 = Buffer.from(password, 'utf8').toString('base64');
        
        // PowerShell command to encrypt using DPAPI (CurrentUser scope)
        // ConvertTo-SecureString uses DPAPI automatically
        const psCommand = `$bytes = [System.Convert]::FromBase64String('${passwordBase64}'); $password = [System.Text.Encoding]::UTF8.GetString($bytes); $secure = ConvertTo-SecureString -String $password -AsPlainText -Force; $encrypted = ConvertFrom-SecureString -SecureString $secure; Write-Output $encrypted`;
        
        const { stdout, stderr } = await execAsync(
            `powershell -Command "${psCommand}"`,
            {
                windowsHide: true,
                timeout: 5000,
                maxBuffer: 1024 * 1024
            }
        );

        if (stderr && stderr.trim()) {
            console.error('[ENCRYPTION] PowerShell error:', stderr);
            return null;
        }

        const encrypted = stdout.trim();
        
        if (!encrypted) {
            console.error('[ENCRYPTION] Empty encryption result');
            return null;
        }

        // Return encrypted string (PowerShell SecureString is already base64-like encoded)
        return encrypted;
    } catch (error) {
        console.error('[ENCRYPTION] Error encrypting password:', error.message);
        return null;
    }
}

/**
 * Decrypt a password using Windows DPAPI via PowerShell
 * @param {string} encryptedPassword - Encrypted password from ConvertFrom-SecureString
 * @returns {Promise<string|null>} - Decrypted password or null if decryption failed
 */
export async function decryptPassword(encryptedPassword) {
    if (!encryptedPassword || encryptedPassword.trim() === '') {
        return null;
    }

    if (!isEncryptionAvailable()) {
        console.warn('[ENCRYPTION] DPAPI not available (not Windows), cannot decrypt password');
        return null;
    }

    try {
        // Use base64 encoding to avoid escaping issues (encrypted strings can contain special chars)
        const encryptedBase64 = Buffer.from(encryptedPassword, 'utf8').toString('base64');
        
        // PowerShell command to decrypt using DPAPI
        const psCommand = `$bytes = [System.Convert]::FromBase64String('${encryptedBase64}'); $encrypted = [System.Text.Encoding]::UTF8.GetString($bytes); $secure = ConvertTo-SecureString -String $encrypted; $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); $password = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); Write-Output $password`;
        
        const { stdout, stderr } = await execAsync(
            `powershell -Command "${psCommand}"`,
            {
                windowsHide: true,
                timeout: 5000,
                maxBuffer: 1024 * 1024
            }
        );

        if (stderr && stderr.trim()) {
            console.error('[ENCRYPTION] PowerShell error:', stderr);
            return null;
        }

        const decrypted = stdout.trim();
        
        if (!decrypted) {
            console.error('[ENCRYPTION] Empty decryption result');
            return null;
        }

        return decrypted;
    } catch (error) {
        console.error('[ENCRYPTION] Error decrypting password:', error.message);
        return null;
    }
}

/**
 * Synchronous version of encryptPassword (for initial loading)
 * Note: This will block the event loop, use only during startup
 */
export function encryptPasswordSync(password) {
    if (!password || password.trim() === '') {
        return null;
    }

    if (!isEncryptionAvailable()) {
        return null;
    }

    try {
        // Use base64 encoding to avoid escaping issues with special characters
        const passwordBase64 = Buffer.from(password, 'utf8').toString('base64');
        
        const psCommand = `$bytes = [System.Convert]::FromBase64String('${passwordBase64}'); $password = [System.Text.Encoding]::UTF8.GetString($bytes); $secure = ConvertTo-SecureString -String $password -AsPlainText -Force; $encrypted = ConvertFrom-SecureString -SecureString $secure; Write-Output $encrypted`;
        
        const encrypted = execSync(
            `powershell -Command "${psCommand}"`,
            {
                windowsHide: true,
                timeout: 5000,
                maxBuffer: 1024 * 1024,
                encoding: 'utf8'
            }
        ).trim();

        return encrypted || null;
    } catch (error) {
        console.error('[ENCRYPTION] Error encrypting password (sync):', error.message);
        return null;
    }
}

/**
 * Synchronous version of decryptPassword (for initial loading)
 * Note: This will block the event loop, use only during startup
 */
export function decryptPasswordSync(encryptedPassword) {
    if (!encryptedPassword || encryptedPassword.trim() === '') {
        return null;
    }

    if (!isEncryptionAvailable()) {
        return null;
    }

    try {
        // Use base64 encoding to avoid escaping issues (encrypted strings can contain special chars)
        const encryptedBase64 = Buffer.from(encryptedPassword, 'utf8').toString('base64');
        
        const psCommand = `$bytes = [System.Convert]::FromBase64String('${encryptedBase64}'); $encrypted = [System.Text.Encoding]::UTF8.GetString($bytes); $secure = ConvertTo-SecureString -String $encrypted; $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); $password = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); Write-Output $password`;
        
        const decrypted = execSync(
            `powershell -Command "${psCommand}"`,
            {
                windowsHide: true,
                timeout: 5000,
                maxBuffer: 1024 * 1024,
                encoding: 'utf8'
            }
        ).trim();

        return decrypted || null;
    } catch (error) {
        console.error('[ENCRYPTION] Error decrypting password (sync):', error.message);
        return null;
    }
}

/**
 * Check if a string is encrypted (PowerShell SecureString format)
 * PowerShell SecureString output starts with specific patterns
 * @param {string} value - Value to check
 * @returns {boolean} - True if value appears to be encrypted
 */
export function isEncrypted(value) {
    if (!value || typeof value !== 'string') {
        return false;
    }
    
    // PowerShell ConvertFrom-SecureString produces base64-like strings
    // Typically longer than 50 characters and matches base64 pattern
    const base64Regex = /^[A-Za-z0-9+/]+=*$/;
    
    // Check if it looks like a PowerShell encrypted SecureString
    // Usually starts with numbers and contains base64-like characters
    if (value.length > 50 && base64Regex.test(value)) {
        // Additional check: PowerShell SecureString often has specific structure
        // It's a long base64 string (typically 100+ characters for short passwords)
        return true;
    }
    
    return false;
}

/**
 * Migrate plain text password to encrypted format
 * @param {string} plainPassword - Plain text password
 * @returns {Promise<string|null>} - Encrypted password or plain password if encryption unavailable
 */
export async function migratePassword(plainPassword) {
    if (!plainPassword) {
        return null;
    }

    // If already encrypted, return as is
    if (isEncrypted(plainPassword)) {
        return plainPassword;
    }

    // Try to encrypt
    const encrypted = await encryptPassword(plainPassword);
    
    // If encryption failed but we have a password, return plain (for backward compatibility)
    if (!encrypted && plainPassword) {
        console.warn('[ENCRYPTION] Failed to encrypt password, keeping plain text (backward compatibility)');
        return plainPassword;
    }
    
    return encrypted;
}
