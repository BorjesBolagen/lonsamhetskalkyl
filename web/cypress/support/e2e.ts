// ***********************************************************
// This example support/e2e.ts is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// Import commands.js using ES2015 syntax:
import './commands'
import 'cypress-mailosaur'

// Denna kod säger till Cypress att strunta i Next.js utvecklings-varningar
Cypress.on('uncaught:exception', (err, runnable) => {
  // Ignorera Hydration-fel
  if (err.message.includes('Hydration failed') || err.message.includes('Minified React error')) {
    return false; // Detta hindrar Cypress från att krascha
  }
  // Låt alla andra riktiga fel passera och krascha testet
  return true;
});