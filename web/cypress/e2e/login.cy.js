/**
 * Test suite for the login page
 */

describe('Login Page', () => {
  beforeEach(() => {
    cy.visit('/login')
  })

  it('shows the login form', () => {
    cy.get('[data-testid="email-input"]').should('be.visible')
    cy.get('[data-testid="password-input"]').should('be.visible')
    cy.get('[data-testid="remember-me"]').should('be.visible')
    cy.get('[data-testid="login-button"]').should('be.visible')
  })

  it('logs in with valid admin credentials', () => {

    cy.env(['adminEmail', 'adminPassword']).then(({ adminEmail, adminPassword }) => {
      cy.get('[data-testid="email-input"]').type(adminEmail)
      cy.get('[data-testid="password-input"]').type(adminPassword)
    })
    
    
    cy.get('[data-testid="login-button"]').click()

    // after login, user should be redirected
    cy.url().should('include', '/home')
    cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').should('exist')

    // Check user role status
    cy.request('http://localhost:3000/api/users/get/currentUser')
      .should((response) => {
        expect(response.status).to.eq(200)
      })
  })

  it('logs in with valid leader credentials', () => {
    
    
    cy.env(['leaderEmail', 'leaderPassword']).then(({ leaderEmail, leaderPassword }) => {
      cy.get('[data-testid="email-input"]').type(leaderEmail)
      cy.get('[data-testid="password-input"]').type(leaderPassword)
    })

    cy.get('[data-testid="login-button"]').click()

    // after login, user should be redirected
    cy.url().should('include', '/home')
    cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').should('exist')

    // Check user role status
    cy.request('http://localhost:3000/api/users/get/currentUser')
      .should((response) => {
        expect(response.status).to.eq(200)
      })
    })


  it('shows an error with bad credentials', () => {
    cy.get('[data-testid="email-input"]').type('user@example.com')
    cy.get('[data-testid="password-input"]').type('wrongpassword')
    cy.get('[data-testid="login-button"]').click()

    cy.get('[data-testid="error-message"]').should('be.visible')
    cy.get('[data-testid="error-message"]').should('contain', 'Inloggning misslyckades: Invalid login credentials')
  })

  it('logs in with email unverified', () => {

    cy.env(['unverifiedEmail', 'unverifiedPassword']).then(({ unverifiedEmail, unverifiedPassword }) => {
      cy.get('[data-testid="email-input"]').type(unverifiedEmail)
      cy.get('[data-testid="password-input"]').type(unverifiedPassword)
    })
    
    cy.get('[data-testid="login-button"]').click()

    cy.get('[data-testid="error-message"]').should('be.visible')
    cy.get('[data-testid="error-message"]').should('contain', 'Inloggning misslyckades: Email not confirmed')
  })

  it('stays on the login page if login fails', () => {
    cy.get('[data-testid="email-input"]').type('wrong@example.com')
    cy.get('[data-testid="password-input"]').type('wrongpassword')
    cy.get('[data-testid="login-button"]').click()

    cy.url().should('include', '/login')
  })

  // Probably make tests for remember me and "forgot password" too.
})