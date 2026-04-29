/**
 * Test suite for the Settings (Mitt Konto) page
 */

describe('Settings Page', () => {
  beforeEach(() => {
    // Logga in som admin innan varje test
    cy.loginAs('admin');
    cy.visit('/settings');
    
    // Liten wait för att låta React ladda in data från Supabase
    cy.wait(1000); 
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

  it('can update reference value, save, and persist after relogin', () => {
    const newValue = '18500';
    const originalValue = '15000'; 

    // Låt React stabilisera sig och ladda data
    cy.wait(1500);
    cy.contains('button', 'Spara inställningar').should('not.be.disabled');
    cy.get('input#profitabilityReferenceValue').should('have.value', originalValue);

    // Skriv in nytt värde med markera-allt metoden
    cy.get('input#profitabilityReferenceValue').type('{selectAll}' + newValue);
    cy.get('input#profitabilityReferenceValue').should('have.value', newValue);

    // Spara
    cy.contains('button', 'Spara inställningar').click();
    cy.contains('Inställningar sparade.').should('be.visible');

    // Ge databasen tid
    cy.wait(1000);

    // Logga ut och in
    cy.get('[data-testid="logout-button"]').click();
    cy.url().should('include', '/login');
    cy.loginAs('admin');
    cy.visit('/settings');
    
    // VIKTIGT: Låt React få sin Hydration-panik ifred innan cleanup
    cy.wait(1500);
    cy.contains('button', 'Spara inställningar').should('not.be.disabled');

    // Verifiera att värdet hämtades (Detta vet vi redan fungerar!)
    cy.get('input#profitabilityReferenceValue').should('have.value', newValue);

    // CLEANUP: Återställ
    cy.get('input#profitabilityReferenceValue').type('{selectAll}' + originalValue);
    cy.get('input#profitabilityReferenceValue').should('have.value', originalValue);
      
    cy.contains('button', 'Spara inställningar').click();
    cy.contains('Inställningar sparade.').should('be.visible');

    // Låt databas-anropet gå klart innan Cypress stänger fönstret
    cy.wait(1500); 
  });

  it('shows validation errors when passwords do not match (WILL FAIL TEMPORARILY)', () => {
    // Gå till lösenordsfliken
    cy.contains('button', 'Lösenord').click();

    // Skriv in uppgifter där de nya lösenorden inte matchar
    // Cypress letar upp den label som heter "Nuvarande lösenord", backar ut till föräldern och hittar input-fältet.
    cy.contains('label', 'Nuvarande lösenord').parent().find('input').type('admin123');
    cy.contains('label', 'Nytt lösenord').parent().find('input').type('NyttLösenord1!');
    cy.contains('label', 'Repetera nytt lösenord').parent().find('input').type('FelLösenord1!');

    // Klicka på spara
    cy.contains('button', 'Spara lösenord').click();

    // Verifiera att ett felmeddelande visas i UI:t.
    // TODO: När ni bygger funktionen, se till att Cypress letar efter rätt felmeddelande eller data-testid.
    // Detta kommer krascha nu eftersom felmeddelandet inte existerar i koden än.
    cy.contains('Lösenorden matchar inte').should('be.visible');
  });

  it('can interact with cluster filters and save them', () => {
    // Verifiera att kluster-sektionen finns
    cy.contains('Filtrera dina kluster').should('be.visible');

    // Hitta en specifik checkbox (t.ex. SML-Borlänge) och klicka på dess label
    cy.contains('label', 'SML-Borlänge').click();
    
    // Klicka Spara
    cy.contains('button', 'Spara inställningar').click();
    
    // Verifiera success message
    cy.contains('Inställningar sparade.').should('be.visible');

    // Klicka igen för att återställa state (cleanup)
    cy.contains('label', 'SML-Borlänge').click();
    cy.contains('button', 'Spara inställningar').click();
    
    // Verifiera sista meddelandet för att veta att cleanup är klar
    cy.contains('Inställningar sparade.').should('be.visible');
  });
});