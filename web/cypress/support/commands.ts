/// <reference types="cypress" />
// ***********************************************
// This example commands.ts shows you how to
// create various custom commands and overwrite
// existing commands.
//
// For more comprehensive examples of custom
// commands please read more here:
// https://on.cypress.io/custom-commands
// ***********************************************
//
//
// -- This is a parent command --
// Cypress.Commands.add('login', (email, password) => { ... })
//
//
// -- This is a child command --
// Cypress.Commands.add('drag', { prevSubject: 'element'}, (subject, options) => { ... })
//
//
// -- This is a dual command --
// Cypress.Commands.add('dismiss', { prevSubject: 'optional'}, (subject, options) => { ... })
//
//
// -- This will overwrite an existing command --
// Cypress.Commands.overwrite('visit', (originalFn, url, options) => { ... })
//
// declare global {
//   namespace Cypress {
//     interface Chainable {
//       login(email: string, password: string): Chainable<void>
//       drag(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       dismiss(subject: string, options?: Partial<TypeOptions>): Chainable<Element>
//       visit(originalFn: CommandOriginalFn, url: string, options: Partial<VisitOptions>): Chainable<Element>
//     }
//   }
// }

type UserRole = 'admin' | 'leader' | 'unverified'

const isUserRole = (key: string): key is UserRole => {
	return ['admin', 'leader', 'unverified'].includes(key);
}

/**
 * Loggar in med angiven roll och kollar om 
 * @param userKey: 'admin' | 'leader' | 'unverified'
 */
Cypress.Commands.add('loginAs', (userKey: string) => {

	if (!isUserRole(userKey)) {		
		return new Error("Argument till loginAs måste vara 'admin' | 'leader' | 'unverified'");
	}

	cy.env(['users']).then(({ users }) => {
		const email = users[userKey].email;
		const password = users[userKey].password;

		cy.visit('/login')
		cy.get('[data-testid="email-input"]').type(email)
		cy.get('[data-testid="password-input"]').type(password)
		cy.get('[data-testid="login-button"]').click()

		// If unverified different things should match
		if (userKey === 'unverified') {
			cy.url().should('include', '/login')
			cy.get('[data-testid="error-message"]').should('be.visible')
    	cy.get('[data-testid="error-message"]').should('contain', 'E-postadressen är inte bekräftad. Se inkorg för verifieringsmejl')
			return;
		}

		// after login, user should be redirected
    cy.url().should('include', '/home')
    cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').should('exist')
	})
})