/**
 * Test suite for accessing all pages with and without valid cookies and tokens
 * TODO: add test so leaders cant access /admin
 */

describe('Cookies', () => {
  beforeEach(() => {
    cy.session('adminSession', () => {
      cy.loginAs('admin')
    })
  })
  const adminRoutes = ["/home", "/admin", "/notifications", "/settings", "/simulator"];
  const leaderRoutes = ["/home", "/notifications", "/settings", "/simulator"];
  it('admin can access all pages with valid cookies', () => {
    

    adminRoutes.forEach((route) => {
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

  it("can't access routes without valid auth cookie", () => {
    cy.clearCookie('sb-ukfnyyglaistpbnlgjar-auth-token')
    cy.getCookie('sb-ukfnyyglaistpbnlgjar-auth-token').should('not.exist')

    adminRoutes.forEach((route) => {
      cy.visit(route)
      cy.url().should("include", "/login")
    })
  })

  it("leader shouldn't be able to see admin panel", () => {
    cy.loginAs('leader');

    // Leader should be able to visit these routes
    leaderRoutes.forEach((route) => {
      cy.visit(route);
      cy.url().should("include", route)
    })

    cy.request({ url: "/admin", failOnStatusCode: false }).then((response) => {
      expect(response.status).to.eq(403)
    })
  })
})