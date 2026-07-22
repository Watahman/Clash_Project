export function isStrongPassword(password) {
    return typeof password === 'string'
        && password.length >= 8
        && password.length <= 1024
        && /[a-z]/.test(password)
        && /[A-Z]/.test(password)
        && /\d/.test(password)
        && /[^A-Za-z0-9]/.test(password);
}
