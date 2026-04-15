/**
 * Denna fil innehåller valideringsfunktioner för både frontend och backend
 */

/**
 * Validerar ett email. Måste innehålla ett @ och en punkt efter @ med minst 1 bokstav efter punkten
 * @param email 
 * @returns boolean: är email valid eller inte?
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validerar ett lösenord. Måste innehålla minst 7 tecken och minst en siffra
 * @param password 
 * @returns  boolean: är password valid eller inte?
 */
export function validatePassword(password: string): boolean {
  const passwordRegex = /^(?=.*\d).{7,}$/;
  return passwordRegex.test(password);
}