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
Cypress.Commands.add('loginAs', (userKey: string, rememberMe: boolean = false) => {

	if (!isUserRole(userKey)) {		
		return new Error("Argument userKey till loginAs måste vara 'admin' | 'leader' | 'unverified'");
	}

	cy.env(['users']).then(({ users }) => {
		const email = users[userKey].email;
		const password = users[userKey].password;

		cy.visit('/login')
		cy.get('[data-testid="email-input"]').type(email)
		cy.get('[data-testid="password-input"]').type(password)
		if (rememberMe) cy.get('[data-testid="remember-me"]').click()

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

		//// Check cookie status
		// Make sure cookies exist
		cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').should('exist')
		cy.getCookie('sb-remember-me').should('exist')

		// Cookies should exist with age depending on remember me:
		//		If rememberMe is checked (true) --> age should be 30 days
		// 		If rememberMe is unchecked (false) --> should be session cookie
		if (rememberMe) {
	    cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').then((cookie) => {
				expect(cookie?.expiry).to.be.greaterThan(Date.now() / 1000)		// Make sure auth cookie has expiry greater than current date
			})
			cy.getCookie('sb-remember-me').then((cookie) => {
				expect(cookie?.expiry).to.be.greaterThan(Date.now() / 1000)		// Make sure remember mee cookie has expiry greater than current date
			})
		} else {
	    cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').then((cookie) => {
				expect(cookie?.expiry).to.be.undefined;		// Make sure auth cookie has undefined expiry date, aka a session cookie
			})
			cy.getCookie('sb-remember-me').then((cookie) => {
				expect(cookie?.expiry).to.be.undefined;		// Make sure remember mee cookie has expiry greater than current date
			})	
		}
		
	})
})