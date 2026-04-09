/**
 * Test suite for accessing all pages with and without valid cookies and tokens
 * TODO: add test so leaders cant access /admin
 */

describe('Cookies', () => {
  beforeEach(() => {
    cy.session('adminSession', () => {
      cy.visit('/login')
      cy.env(['adminEmail', 'adminPassword']).then(({ adminEmail, adminPassword }) => {
        cy.get('[data-testid="email-input"]').type(adminEmail)
        cy.get('[data-testid="password-input"]').type(adminPassword)
      })
      cy.get('[data-testid="login-button"]').click()
      cy.url().should('include', '/home')
    })
  })

  it('can access all pages with valid cookies', () => {
    const validRoutes = ["/home", "/admin", "/notifications", "/settings", "/simulator"]

    validRoutes.forEach((route) => {
      cy.visit(route)
      cy.url().should("include", route)
    })

    // just / should redirect to /login
    cy.visit("/")
    cy.url().should("include", "/login")
  })

  it('login - verify cookies - log out - only remember me should be left', () => {
    cy.visit("/home")
    cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').should('exist')
    cy.getCookie('sb-remember-me').should('exist')

    cy.get('[data-testid="logout-button"]').click()
    cy.url().should("include", "/login")

    cy.get('[data-testid="login-button"]').should("be.visible")
    
    cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').should('not.exist')
    cy.getCookie('sb-remember-me').should('exist')
  })
})