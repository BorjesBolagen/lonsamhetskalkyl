/**
 * Test suite for the Settings (Mitt Konto) page
 */

describe('Settings Page', () => {
  beforeEach(() => {
    // Logga in som admin innan varje test
    cy.loginAs('admin');
    cy.visit('/settings');
    
    cy.wait(1000); 
  });

  it('displays the correct user profile information', () => {
    // Kolla användarinformation
    cy.contains('adminborjes@gmail.com').should('be.visible');
    cy.contains('Admin').should('be.visible'); 
  });

  it('renders the account page and can toggle between tabs', () => {
    // Verifiera att vi startar på Konto-fliken
    cy.contains('Din Profil').should('be.visible');
    cy.contains('Referensvärde för prisbar').should('be.visible');

    // Klicka på Lösenord-fliken
    cy.contains('button', 'Lösenord').click();
    
    // Verifiera att vyn byttes
    cy.contains('Byt lösenord').should('be.visible');
    cy.contains('Nuvarande lösenord').should('be.visible');
    cy.contains('Din Profil').should('not.exist'); // Konto-infon ska vara dold

    // Gå tillbaka till Konto
    cy.contains('button', 'Konto').click();
    cy.contains('Din Profil').should('be.visible');
  });

  it('can update reference value, save, and persist empty fallback as 0', () => {
    const newValue = '18500';
    const originalValue = '15000'; 

    cy.wait(1500);
    cy.contains('button', 'Spara inställningar').should('not.be.disabled');
    cy.get('input#profitabilityReferenceValue').should('have.value', originalValue);

    // Ändra värde
    cy.get('input#profitabilityReferenceValue').type('{selectAll}' + newValue);
    cy.get('input#profitabilityReferenceValue').should('have.value', newValue);

    cy.contains('button', 'Spara inställningar').click();
    cy.contains('Inställningar sparade.').should('be.visible');

    cy.wait(1000);

    // Logga ut och in för att se så värdet sparas
    cy.get('[data-testid="logout-button"]').click();
    cy.url().should('include', '/login');
    cy.loginAs('admin');
    cy.visit('/settings');
    
    cy.wait(1500);
    cy.contains('button', 'Spara inställningar').should('not.be.disabled');

    // Verifiera att 18500 hämtades
    cy.get('input#profitabilityReferenceValue').should('have.value', newValue);

    // Rensa fältet helt så det blir en tom sträng
    cy.get('input#profitabilityReferenceValue').clear().should('have.value', '');
      
    cy.contains('button', 'Spara inställningar').click();
    cy.contains('Inställningar sparade.').should('be.visible');

    cy.wait(1000); 

    // Verifiera att fallbacken fungerade genom att ladda om
    cy.visit('/settings');
    cy.wait(1500);
    
    // Om allt fungerar ska den tomma strängen ha blivit sparad som 0
    cy.get('input#profitabilityReferenceValue').should('have.value', '0');

    // --- Cleanup: Återställ till 15000 så vi inte förstör framtida tester ---
    cy.get('input#profitabilityReferenceValue').type('{selectAll}' + originalValue);
    cy.contains('button', 'Spara inställningar').click();
    cy.contains('Inställningar sparade.').should('be.visible');
  });

  it('shows validation errors when passwords do not match', () => {
    // Gå till lösenordsfliken
    cy.contains('button', 'Lösenord').click();

    // Skriv in uppgifter där de nya lösenorden inte matchar
    // Cypress letar upp den label som heter "Nuvarande lösenord", backar ut till föräldern och hittar input-fältet.
    cy.contains('label', 'Nuvarande lösenord').parent().find('input').type('admin123');
    cy.contains('label', 'Nytt lösenord').parent().find('input').type('NyttLösenord1!');
    cy.contains('label', 'Repetera nytt lösenord').parent().find('input').type('FelLösenord1!');

    // Spara
    cy.contains('button', 'Spara lösenord').click();

    // Verifiera att ett felmeddelande visas i UI:t.
    // OBS: Detta kommer krascha nu eftersom felmeddelandet inte finns än.
    cy.contains('Lösenorden matchar inte').should('be.visible');
  });

  it('can interact with filters and save them', () => {
    // Verifiera att kluster-sektionen finns
    cy.contains('Filtrera dina kluster').should('be.visible');

    // Hitta en specifik checkbox och markera den
    cy.contains('label', 'SML-Borlänge').click();
    
    // Klicka Spara
    cy.contains('button', 'Spara inställningar').click();
    
    // Verifiera success message
    cy.contains('Inställningar sparade.').should('be.visible');

    // Klicka igen för att återställa (cleanup)
    cy.contains('label', 'SML-Borlänge').click();
    cy.contains('button', 'Spara inställningar').click();
    
    // Verifiera sista meddelandet för att veta att cleanup är klar
    cy.contains('Inställningar sparade.').should('be.visible');
  });

  it('can toggle between Light and Dark theme', () => {
    // Vi vet att laddningen är klar när spara-knappen går att klicka på
    cy.contains('button', 'Spara inställningar').should('not.be.disabled');
    cy.wait(1000);

    // KLicka på darkmode
    cy.contains('button', 'Dark').click();
    
    // Verifiera att Dark-knappen ser "aktiv" ut
    cy.contains('button', 'Dark').should('have.class', 'bg-[var(--button-fetch)]');
    
    // Spara inställningen
    cy.contains('button', 'Spara inställningar').click();
    cy.contains('Inställningar sparade.').should('be.visible');

    // Verifiera att HTML-taggen fick dark mode
    cy.document().its('documentElement').should('have.attr', 'data-theme', 'dark');

    // Återställ till Light
    cy.contains('button', 'Light').click();
    cy.contains('button', 'Spara inställningar').click();
    cy.contains('Inställningar sparade.').should('be.visible');
    
    // Verifiera att det blev ljust igen
    cy.document().its('documentElement').should('have.attr', 'data-theme', 'light');
  });

  it('can toggle password visibility', () => {
    cy.contains('button', 'Lösenord').click();

    // Hitta input-fältet och verifiera att det är dolt som standard
    cy.contains('label', 'Nuvarande lösenord')
      .parent()
      .find('input')
      .should('have.attr', 'type', 'password')
      .type('hemligt123');

    // Klicka på ögon-ikonen (hittas genom att leta efter en button bredvid input-fältet)
    cy.contains('label', 'Nuvarande lösenord')
      .parent()
      .find('button')
      .click();

    // Verifiera att texten nu är synlig
    cy.contains('label', 'Nuvarande lösenord')
      .parent()
      .find('input')
      .should('have.attr', 'type', 'text');
  });
});