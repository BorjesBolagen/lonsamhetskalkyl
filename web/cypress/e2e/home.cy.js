/**
 * Test suite for the Home (Översikt) page
 */

describe('Home Page', () => {
  beforeEach(() => {
    // Gå till inloggningssidan och logga in manuellt för att slippa 307-redirects
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').clear().type('trafikborjes@gmail.com');
    cy.get('[data-testid="password-input"]').clear().type('trafik123');
    cy.get('[data-testid="login-button"]').click();

    // Verifiera att inloggningen lyckades och vi kom till startsidan
    cy.url().should('include', '/home');
    cy.wait(1500); 
  });

  it('renders the initial UI correctly and checks button states', () => {
    // Verifiera att sidans titel/rubrik finns
    cy.contains('Aktuella linjer').should('be.visible');

    // Verifiera att datumväljaren finns
    cy.get('input#selectedDate').should('exist');

    // "Rensa visning" ska vara avstängd (disabled) från början eftersom vi inte hämtat något
    cy.contains('button', 'Rensa visning').should('be.disabled');

    // Hämta-knappen ska finnas och vara klickbar
    cy.contains('button', 'Hämta filtrerade linjer').should('not.be.disabled');
  });

  it('can change the date and trigger a fetch process', () => {
    // Räknar ut dagens datum i formatet ÅÅÅÅ-MM-DD
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); 
    const day = String(today.getDate()).padStart(2, '0');
    const todaysDate = `${year}-${month}-${day}`;

    // Skriv in dagens datum i fältet
    cy.get('input#selectedDate').type(todaysDate);
    cy.get('input#selectedDate').should('have.value', todaysDate);

    // Hämta linjer
    cy.contains('button', 'Hämta filtrerade linjer').click();

    // Efter klicket ska knappen byta text och bli disabled
    cy.contains('button', 'Hämtar linjer, ekipage och bokningar...').should('be.disabled');
    
    // Animationen inuti knappen ska visas
    cy.get('.animate-spin').should('be.visible');

    // Cypress väntar automatiskt tills knappen återgår till sitt normala tillstånd
    cy.contains('button', 'Hämta filtrerade linjer', { timeout: 15000 }).should('be.visible');
  });

  it('handles the fetched results properly (cards OR empty state) and clears the view', () => {
    // Klicka på hämta (med default-datum)
    cy.contains('button', 'Hämta filtrerade linjer').click();

    // Vänta tills laddningen är helt klar, ges gått om tid
    cy.contains('button', 'Hämta filtrerade linjer', { timeout: 15000 }).should('not.be.disabled');

    // Här använder vi en Cypress-koll för att se om sidan hittade data eller om den var tom
    // Eftersom båda utfallen är korrekta beroende på dag, låter vi Cypress acceptera båda
    cy.get('body').then(($body) => {
      if ($body.text().includes('Inga linjer matchade dina valda kluster')) {
        // SCENARIO A: Inga körningar denna dag
        cy.log('Inga körningar hittades idag - verifierar empty state');
        cy.contains('Inga linjer matchade').should('be.visible');
        
      } else {
        // SCENARIO B: Körningar hittades
        cy.log('Körningar hittades - verifierar rendering av kort');
        
        // Verifiera sammanfattningstexten
        cy.contains(/hittades \d+ linjer med totalt \d+ ekipage/).should('be.visible');
        
        // Vi borde ha minst ett LineCard på skärmen
        cy.get('.space-y-3').children().should('have.length.greaterThan', 0);

        // Testa Popup-modalen på det allra första ekipaget i listan
        cy.contains('button', 'Info').first().click();
        
        // Verifiera att rutan öppnas
        cy.get('.fixed.inset-0').should('be.visible');
        cy.contains('h2', 'Ekipage').should('be.visible');
        cy.contains('strong', 'Antal bokningar:').should('be.visible');

        // Stäng rutan
        cy.contains('button', 'Stäng').click();
        cy.get('.fixed.inset-0').should('not.exist');
      }
    });

    // Oavsett om vi hittade linjer eller inte, ska vi nu kunna rensa visningen
    cy.contains('button', 'Rensa visning').should('not.be.disabled').click();

    // Verifiera att rensningen fungerade
    cy.contains('Klicka på knappen för att ladda linjerna.').should('be.visible');
    cy.contains('button', 'Rensa visning').should('be.disabled');
  });
});