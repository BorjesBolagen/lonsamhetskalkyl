/**
 * Test suite for the Admin page and global messaging
 */

describe('Admin Page - Messaging', () => {
  it('allows Admin to send a global message which is received by a Traffic Leader', () => {
    // Skapa ett unikt meddelande för varje testkörning så vi inte läser gamla test-meddelanden
    const uniqueMessage = `Viktigt meddelande från Cypress: ${Date.now()}`;

    // 1. ADMIN SKICKAR MEDDELANDET
    cy.loginAs('admin');
    cy.visit('/admin');
    
    // Vänta in sidan lite kort
    cy.wait(1000);

    // Öppna popup för att skicka meddelande (här klickar den på knappen i menyn)
    cy.contains('button', 'Skicka Meddelande').click();

    // Skriv in det unika meddelandet i textrutan i popupen
    cy.get('textarea[placeholder="Skriv ditt meddelande här..."]')
      .should('be.visible')
      .type(uniqueMessage);

    // Klicka på Skicka-knappen INUTI popupen (Använder Regex för att exakt matcha ordet "Skicka")
    cy.contains('button', /^Skicka$/).click();

    // Verifiera att rutan töms när det har skickats (bekräftar att funktionen gick igenom)
    cy.get('textarea[placeholder="Skriv ditt meddelande här..."]')
      .should('have.value', '');
    
    // Stäng popupen
    cy.contains('button', '✖').click();

    // Logga ut admin
    cy.get('[data-testid="logout-button"]').click();
    cy.url().should('include', '/login');

    // 2. TRAFIKLEDARE LÄSER MEDDELANDET
    // Eftersom vi precis loggat ut är vi redan på /login. 
    // Vi loggar in manuellt i UI:t för att garantera en fräsch session.
    cy.get('[data-testid="email-input"]').clear().type('trafikborjes@gmail.com');
    cy.get('[data-testid="password-input"]').clear().type('trafik123');
    cy.get('[data-testid="login-button"]').click();

    // Verifiera att inloggningen lyckades och vi kom till startsidan
    cy.url().should('include', '/home');
    cy.wait(1000);

    // Klicka på "Notifikationer" i navigeringsmenyn
    cy.contains('Notifikationer').click();
    
    // Verifiera att vi hamnade på rätt sida
    cy.url().should('include', '/notifications');

    // Verifiera att exakt det meddelandet vi nyss skapade finns synligt på skärmen!
    cy.contains(uniqueMessage).should('be.visible');
  });
});