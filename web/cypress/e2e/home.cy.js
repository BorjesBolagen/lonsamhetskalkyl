/**
 * Test suite for the Home (Översikt) page
 */

describe('Home Page - Dynamic Data Handling', () => {
  beforeEach(() => {
    // Gå till inloggningssidan och logga in manuellt för att slippa 307-redirects
    cy.visit('/login');
    cy.get('[data-testid="email-input"]').clear().type('trafikborjes@gmail.com');
    cy.get('[data-testid="password-input"]').clear().type('trafik123');
    cy.get('[data-testid="login-button"]').click();

    // Verifiera att inloggningen lyckades och vi kom till startsidan
    cy.url().should('include', '/home');
    
    // Vänta lite så att inställningar (kluster) hinner laddas från databasen
    cy.wait(1500); 
  });

  it('renders the initial UI correctly and checks button states', () => {
    // Verifiera att sidans titel/rubrik finns
    cy.contains('Aktuella linjer').should('be.visible');

    // Verifiera att datumväljaren finns
    cy.get('input#selectedDate').should('exist');

    // "Rensa visning" ska vara avstängd (disabled) från början eftersom vi inte hämtat något
    cy.contains('button', 'Rensa visning').should('be.disabled');

    // Hämta-knappen ska finnas och vara klickbar (om inställningarna laddats korrekt)
    cy.contains('button', 'Hämta filtrerade linjer').should('not.be.disabled');
  });

  it('can change the date and trigger a fetch process', () => {
    // 1. Räkna ut dagens datum i formatet ÅÅÅÅ-MM-DD
    const today = new Date();
    const year = today.getFullYear();
    // getMonth() börjar på 0, så vi lägger till 1. padStart(2, '0') ser till att t.ex. "5" blir "05".
    const month = String(today.getMonth() + 1).padStart(2, '0'); 
    const day = String(today.getDate()).padStart(2, '0');
    const todaysDate = `${year}-${month}-${day}`;

    // 2. Skriv in dagens datum i fältet
    cy.get('input#selectedDate').type(todaysDate);
    cy.get('input#selectedDate').should('have.value', todaysDate);

    // 3. Klicka på hämta
    cy.contains('button', 'Hämta filtrerade linjer').click();

    // 4. DIREKT efter klicket ska knappen byta text och bli disabled (laddningsläge)
    cy.contains('button', 'Hämtar linjer, ekipage och bokningar...').should('be.disabled');
    
    // 5. Snurran (spinnern) inuti knappen ska visas
    cy.get('.animate-spin').should('be.visible');

    // 6. Cypress väntar nu automatiskt tills knappen återgår till sitt normala tillstånd
    cy.contains('button', 'Hämta filtrerade linjer', { timeout: 15000 }).should('be.visible');
  });

  it('handles the fetched results properly (cards OR empty state) and clears the view', () => {
    // Klicka på hämta (med default-datum)
    cy.contains('button', 'Hämta filtrerade linjer').click();

    // Vänta tills laddningen är helt klar (vi ger den upp till 15 sekunder ifall iLog är segt)
    cy.contains('button', 'Hämta filtrerade linjer', { timeout: 15000 }).should('not.be.disabled');

    // Här använder vi en Cypress-koll för att se om sidan hittade data ELLER om den var tom.
    // Eftersom båda utfallen är korrekta beroende på dag, låter vi Cypress acceptera båda.
    cy.get('body').then(($body) => {
      if ($body.text().includes('Inga linjer matchade dina valda kluster')) {
        // SCENARIO A: Inga körningar denna dag
        cy.log('Inga körningar hittades idag - verifierar empty state');
        cy.contains('Inga linjer matchade').should('be.visible');
        
      } else {
        // SCENARIO B: Körningar hittades!
        cy.log('Körningar hittades - verifierar rendering av kort');
        
        // Verifiera sammanfattningstexten
        cy.contains(/hittades \d+ linjer med totalt \d+ ekipage/).should('be.visible');
        
        // Vi borde ha minst ett LineCard på skärmen (din kod verkar mappa dem i en .space-y-3 div)
        cy.get('.space-y-3').children().should('have.length.greaterThan', 0);

        // Testa Popup-modalen på det allra första ekipaget i listan
        cy.contains('button', 'Info').first().click();
        
        // Verifiera att modalen öppnas (innehåller ordet "Ekipage" i rubriken och "Stäng"-knappen)
        cy.get('.fixed.inset-0').should('be.visible');
        cy.contains('h2', 'Ekipage').should('be.visible');
        cy.contains('strong', 'Antal bokningar:').should('be.visible');

        // Stäng modalen
        cy.contains('button', 'Stäng').click();
        cy.get('.fixed.inset-0').should('not.exist');
      }
    });

    // Oavsett om vi hittade linjer eller inte, ska vi nu kunna rensa visningen
    cy.contains('button', 'Rensa visning').should('not.be.disabled').click();

    // Verifiera att rensningen fungerade (sammanfattningen försvinner)
    cy.contains('Klicka på knappen för att ladda linjerna.').should('be.visible');
    cy.contains('button', 'Rensa visning').should('be.disabled');
  });
});