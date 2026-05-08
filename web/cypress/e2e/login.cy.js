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

    cy.loginAs('admin');

    // Check user role status
    cy.request('http://localhost:3000/api/users/get/currentUser')
      .should((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.status).to.eq(true)
        expect(response.body.message).to.eq('Användare hämtad')
      })
  })

  it('logs in with valid leader credentials', () => {
    
    cy.loginAs('leader');

    // Check user role status
    cy.request('http://localhost:3000/api/users/get/currentUser')
      .should((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.status).to.eq(true)
        expect(response.body.message).to.eq('Användare hämtad')
      })
    })


  it('shows an error with bad credentials', () => {
    cy.get('[data-testid="email-input"]').clear().type('user@example.com').should('have.value', 'user@example.com')
    cy.get('[data-testid="password-input"]').clear().type('wrongpassword123').should('have.value', 'wrongpassword123')
    cy.get('[data-testid="login-button"]').click()

    cy.url().should('include', '/login')
    cy.get('[data-testid="error-message"]').should('be.visible')
    cy.get('[data-testid="error-message"]').should('contain', 'Felaktiga inloggningsuppgifter')
  })

  it('logs in with email unverified', () => {
    cy.loginAs('unverified');
  })

  it('log in with bad email format 1: No @', () => {
    // Ge sidan 500ms (en halv sekund) att hydratisera React-koden
    cy.wait(500)
    cy.get('[data-testid="email-input"]').clear().type('user').should('have.value', 'user')
    cy.get('[data-testid="password-input"]').clear().type('wrongpassword123').should('have.value', 'wrongpassword123')
    cy.get('[data-testid="login-button"]').click()

    cy.url().should('include', '/login')
    cy.get('[data-testid="error-message"]').should('be.visible')
    cy.get('[data-testid="error-message"]').should('have.text', 'Email är inte rätt formaterat')
  })

  it('log in with bad email format 2: No . after @', () => {
    cy.wait(500)
    cy.get('[data-testid="email-input"]').clear().type('user@example').should('have.value', 'user@example')
    cy.get('[data-testid="password-input"]').clear().type('wrongpassword123').should('have.value', 'wrongpassword123')
    cy.get('[data-testid="login-button"]').click()
    
    cy.url().should('include', '/login')
    cy.get('[data-testid="error-message"]').should('be.visible')
    cy.get('[data-testid="error-message"]').should('have.text', 'Email är inte rätt formaterat')
  })

  it('log in with bad email format 3: No character after . after @', () => {
    cy.wait(500)
    cy.get('[data-testid="email-input"]').clear().type('user@example.').should('have.value', 'user@example.')
    cy.get('[data-testid="password-input"]').clear().type('wrongpassword123').should('have.value', 'wrongpassword123')
    cy.get('[data-testid="login-button"]').click()
    
    cy.url().should('include', '/login')
    cy.get('[data-testid="error-message"]').should('be.visible')
    cy.get('[data-testid="error-message"]').should('have.text', 'Email är inte rätt formaterat')
  })

  it('log in with bad password format 1: no number', () => {
    cy.get('[data-testid="email-input"]').clear().type('user@example.com').should('have.value', 'user@example.com')
    cy.get('[data-testid="password-input"]').clear().type('wrongpassword').should('have.value', 'wrongpassword')
    cy.get('[data-testid="login-button"]').click()

    cy.url().should('include', '/login')
    cy.get('[data-testid="error-message"]').should('be.visible')
    cy.get('[data-testid="error-message"]').should('contain', 'Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra')
  })

  it('log in with bad password format 2: not enough characters', () => {
    cy.get('[data-testid="email-input"]').clear().type('user@example.com').should('have.value', 'user@example.com')
    cy.get('[data-testid="password-input"]').clear().type('wrong').should('have.value', 'wrong')
    cy.get('[data-testid="login-button"]').click()

    cy.url().should('include', '/login')
    cy.get('[data-testid="error-message"]').should('be.visible')
    cy.get('[data-testid="error-message"]').should('contain', 'Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra')
  })

  it('try having remember me enabled as admin', () => {
    const rememberMe = true
    cy.loginAs('admin', rememberMe);    // loginAs checks cookies

    // Check user role status
    cy.request('http://localhost:3000/api/users/get/currentUser')
      .should((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.status).to.eq(true)
        expect(response.body.message).to.eq('Användare hämtad')
      })
  })

  it('try having remember me enabled as leader', () => {
    const rememberMe = true;
    cy.loginAs('leader', rememberMe);   // loginAs checks cookies

    // Check user role status
    cy.request('http://localhost:3000/api/users/get/currentUser')
      .should((response) => {
        expect(response.status).to.eq(200)
        expect(response.body.status).to.eq(true)
        expect(response.body.message).to.eq('Användare hämtad')
      })
  })

  it('try having remember me as unverified', () => {
    const rememberMe = true;
    cy.loginAs('unverified', rememberMe);   // loginAs checks cookies
  })
})