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
        
        // Escape single quotes in base64 string to prevent PowerShell injection
        const escapedBase64 = passwordBase64.replace(/'/g, "''");
        
        // PowerShell command to encrypt using DPAPI (CurrentUser scope)
        // ConvertTo-SecureString uses DPAPI automatically
        // Using single quotes and escaping to prevent injection
        // Add $ProgressPreference = 'SilentlyContinue' to suppress progress bars
        const psCommand = `$ProgressPreference = 'SilentlyContinue'; $bytes = [System.Convert]::FromBase64String('${escapedBase64}'); $password = [System.Text.Encoding]::UTF8.GetString($bytes); $secure = ConvertTo-SecureString -String $password -AsPlainText -Force; $encrypted = ConvertFrom-SecureString -SecureString $secure; Write-Output $encrypted`;
        
        // Use -EncodedCommand for additional security (base64 encoded command)
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        
        const { stdout, stderr } = await execAsync(
            `powershell -EncodedCommand ${encodedCommand}`,
            {
                windowsHide: true,
                timeout: 5000,
                maxBuffer: 1024 * 1024
            }
        );

        // Filter CLIXML from stderr before checking
        const cleanStderr = stderr ? stderr
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return trimmed !== '' && 
                       !trimmed.startsWith('#< CLIXML') && 
                       !trimmed.startsWith('<Objs') &&
                       !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
            })
            .join('\n') : '';

        if (cleanStderr && cleanStderr.trim()) {
            console.error('[ENCRYPTION] PowerShell error:', cleanStderr);
            return null;
        }

        // Filter CLIXML from stdout
        const cleanStdout = stdout ? stdout
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return trimmed !== '' && 
                       !trimmed.startsWith('#< CLIXML') && 
                       !trimmed.startsWith('<Objs') &&
                       !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
            })
            .join('\n') : '';

        const encrypted = cleanStdout.trim();
        
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
        
        // Escape single quotes in base64 string to prevent PowerShell injection
        const escapedBase64 = encryptedBase64.replace(/'/g, "''");
        
        // PowerShell command to decrypt using DPAPI
        // Add $ProgressPreference = 'SilentlyContinue' to suppress progress bars
        const psCommand = `$ProgressPreference = 'SilentlyContinue'; $bytes = [System.Convert]::FromBase64String('${escapedBase64}'); $encrypted = [System.Text.Encoding]::UTF8.GetString($bytes); $secure = ConvertTo-SecureString -String $encrypted; $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); $password = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); Write-Output $password`;
        
        // Use -EncodedCommand for additional security (base64 encoded command)
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        
        const { stdout, stderr } = await execAsync(
            `powershell -EncodedCommand ${encodedCommand}`,
            {
                windowsHide: true,
                timeout: 5000,
                maxBuffer: 1024 * 1024
            }
        );

        // Filter CLIXML from stderr before checking
        const cleanStderr = stderr ? stderr
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return trimmed !== '' && 
                       !trimmed.startsWith('#< CLIXML') && 
                       !trimmed.startsWith('<Objs') &&
                       !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
            })
            .join('\n') : '';

        if (cleanStderr && cleanStderr.trim()) {
            console.error('[ENCRYPTION] PowerShell error:', cleanStderr);
            return null;
        }

        // Filter CLIXML from stdout
        const cleanStdout = stdout ? stdout
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return trimmed !== '' && 
                       !trimmed.startsWith('#< CLIXML') && 
                       !trimmed.startsWith('<Objs') &&
                       !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
            })
            .join('\n') : '';

        const decrypted = cleanStdout.trim();
        
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
        
        // Escape single quotes in base64 string to prevent PowerShell injection
        const escapedBase64 = passwordBase64.replace(/'/g, "''");
        
        // Add $ProgressPreference = 'SilentlyContinue' to suppress progress bars
        const psCommand = `$ProgressPreference = 'SilentlyContinue'; $bytes = [System.Convert]::FromBase64String('${escapedBase64}'); $password = [System.Text.Encoding]::UTF8.GetString($bytes); $secure = ConvertTo-SecureString -String $password -AsPlainText -Force; $encrypted = ConvertFrom-SecureString -SecureString $secure; Write-Output $encrypted`;
        
        // Use -EncodedCommand for additional security (base64 encoded command)
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        
        let encrypted = execSync(
            `powershell -EncodedCommand ${encodedCommand}`,
            {
                windowsHide: true,
                timeout: 5000,
                maxBuffer: 1024 * 1024,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr to prevent CLIXML output
            }
        ).trim();

        // Filter CLIXML from stdout
        encrypted = encrypted
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return trimmed !== '' && 
                       !trimmed.startsWith('#< CLIXML') && 
                       !trimmed.startsWith('<Objs') &&
                       !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
            })
            .join('\n')
            .trim();

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
        
        // Escape single quotes in base64 string to prevent PowerShell injection
        const escapedBase64 = encryptedBase64.replace(/'/g, "''");
        
        // Add $ProgressPreference = 'SilentlyContinue' to suppress progress bars
        const psCommand = `$ProgressPreference = 'SilentlyContinue'; $bytes = [System.Convert]::FromBase64String('${escapedBase64}'); $encrypted = [System.Text.Encoding]::UTF8.GetString($bytes); $secure = ConvertTo-SecureString -String $encrypted; $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure); $password = [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr); [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr); Write-Output $password`;
        
        // Use -EncodedCommand for additional security (base64 encoded command)
        const encodedCommand = Buffer.from(psCommand, 'utf16le').toString('base64');
        
        let decrypted = execSync(
            `powershell -EncodedCommand ${encodedCommand}`,
            {
                windowsHide: true,
                timeout: 5000,
                maxBuffer: 1024 * 1024,
                encoding: 'utf8',
                stdio: ['pipe', 'pipe', 'ignore'] // Suppress stderr to prevent CLIXML output
            }
        ).trim();

        // Filter CLIXML from stdout
        decrypted = decrypted
            .split('\n')
            .filter(line => {
                const trimmed = line.trim();
                return trimmed !== '' && 
                       !trimmed.startsWith('#< CLIXML') && 
                       !trimmed.startsWith('<Objs') &&
                       !trimmed.includes('xmlns="http://schemas.microsoft.com/powershell/2004/04"');
            })
            .join('\n')
            .trim();

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
