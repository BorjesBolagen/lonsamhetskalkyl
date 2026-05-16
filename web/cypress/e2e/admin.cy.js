/**
 * Test suite for the Admin page and global messaging
 */

describe('Admin Page', () => {

  it('allows Admin to send a global message which is received by a Traffic Leader', () => {
    // Skapa ett unikt meddelande för varje testkörning så vi inte läser gamla test-meddelanden
    const uniqueMessage = `Viktigt meddelande från Cypress: ${Date.now()}`;

    cy.loginAs('admin');
    cy.visit('/admin');
    cy.wait(1000);

    // Öppna popup för att skicka meddelande
    cy.contains('button', 'Skicka Meddelande').click();

    // Skriv in det unika meddelandet i textrutan i popupen
    cy.get('textarea[placeholder="Skriv ditt meddelande här..."]')
      .should('be.visible')
      .type(uniqueMessage);

    // Klicka på Skicka-knappen
    cy.contains('button', /^Skicka$/).click();

    // Verifiera att rutan töms när det har skickats
    cy.get('textarea[placeholder="Skriv ditt meddelande här..."]')
      .should('have.value', '');
    
    // Stäng popupen
    cy.contains('button', '✖').click();

    // Logga ut admin
    cy.get('[data-testid="logout-button"]').click();
    cy.url().should('include', '/login');

    // Vi loggar in manuellt i UI:t för att garantera en fräsch session.
    cy.get('[data-testid="email-input"]').clear().type('trafikborjes@gmail.com');
    cy.get('[data-testid="password-input"]').clear().type('trafik123');
    cy.get('[data-testid="login-button"]').click();

    // Verifiera att inloggningen lyckades
    cy.url().should('include', '/home');
    cy.wait(1000);

    // Klicka på "Notifikationer"
    cy.contains('Notifikationer').click();
    
    // Verifiera att vi hamnade på rätt sida
    cy.url().should('include', '/notifications');

    // Verifiera att exakt det meddelandet vi nyss skapade finns synligt på skärmen
    cy.contains(uniqueMessage).should('be.visible');
  });

  it('can search and filter traffic leaders in the list', () => {
    cy.loginAs('admin');
    cy.visit('/admin');
    
    // Vänta tills listan har laddat
    cy.contains('button', 'Ändra', { timeout: 10000 }).should('be.visible');

    // Skriv in något i sökrutan
    const searchQuery = 'EttNamnSomFörmodligenInteFinns123';
    cy.get('input[placeholder="Sök efter namn eller email..."]').type(searchQuery);
    cy.contains('button', 'Ändra').should('not.exist');
  });

  it('shows an error message if fields are missing when creating a new user', () => {
    cy.loginAs('admin');
    cy.visit('/admin');

    // Vänta tills sidan laddat klart users, annars klickar Cypress för snabbt
    cy.contains('button', 'Ändra', { timeout: 10000 }).should('be.visible');

    // Öppna popupen
    cy.get('[data-testid="signup-button"]').click();
    cy.contains('h3', 'Skapa ny användare').should('be.visible');

    // Försök skicka in ett helt tomt formulär
    cy.get('[data-testid="signup-submit-button"]').click();

    // Verifiera att React-statet sätter rätt felmeddelande
    cy.get('[data-testid="signup-response"]')
      .should('be.visible')
      .and('contain', 'Alla fält måste vara ifyllda');
      
    // Stäng popupen
    cy.get('[data-testid="close-signup-window"]').click();
  });

  it('can toggle password visibility when creating a user', () => {
    cy.loginAs('admin');
    cy.visit('/admin');

    // Vänta tills sidan har laddat klart.
    cy.contains('button', 'Ändra', { timeout: 10000 }).should('be.visible');

    cy.get('[data-testid="signup-button"]').click();
    cy.contains('h3', 'Skapa ny användare').should('be.visible');

    // Kolla att input-typen är 'password' som standard
    cy.get('[data-testid="signup-set-password"]')
      .should('have.attr', 'type', 'password')
      .type('Hemligt123');

    // Klicka på ögon-ikonen
    cy.get('[data-testid="signup-password-eye-icon"]').click();

    // Kolla att typen har ändrats till 'text'
    cy.get('[data-testid="signup-set-password"]')
      .should('have.attr', 'type', 'text');
  });

  it('can open the edit window for an existing user', () => {
    cy.loginAs('admin');
    cy.visit('/admin');

    // Vänta tills tabellen har laddat
    cy.contains('button', 'Ändra', { timeout: 10000 }).should('be.visible');

    // Klicka på den "Ändra"-knappen i listan
    cy.get('button').contains('Ändra').first().click();

    // Verifiera att popupen öppnas
    cy.contains('h3', 'Redigera användare').should('be.visible');

    // Verifiera att knapparna för "Spara" och "Radera användare" finns
    cy.contains('button', 'Spara').should('be.visible');
    cy.contains('button', 'Radera användare').should('be.visible');

    // Klicka Avbryt
    cy.contains('button', 'Avbryt').click();
    
    // Verifiera att fönstret stängdes
    cy.contains('h3', 'Redigera användare').should('not.exist');
  });
});