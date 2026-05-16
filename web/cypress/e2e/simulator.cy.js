/**
 * Test suite for the simulator page
 */

describe('Simulator Page', () => {
  beforeEach(() => {
    // Logga in och gå till simulatorn inför varje test
    cy.loginAs('admin'); 
    cy.visit('/simulator');

    // Vänta tills sidan är färdigladdad
    cy.get('select#selectedLine', { timeout: 10000 }).should('not.be.disabled');
  });

  it('loads basic page elements and disables buttons correctly on startup', () => {
    cy.contains('h1', 'Simulator').should('be.visible');
    cy.get('input#selectedDate').should('exist');
    cy.get('select#selectedLine').should('exist');
    cy.get('select#selectedEquipage').should('exist');

    // "Simulera valda" ska vara inaktiverad från start 
    cy.contains('button', 'Simulera valda').should('be.disabled');

    // "Rensa val"-knappen ska också vara inaktiverad från start
    cy.contains('button', 'Rensa val').should('be.disabled');
  });

  it('can open, fill in, and cancel the fictitious booking modal', () => {
    // Öppna popupen
    cy.contains('button', 'Lägg till fiktiv bokning').click();

    // Modalen ska visas
    cy.contains('h2', 'Lägg till fiktiv bokning').should('be.visible');

    // Skriv in testdata i fälten 
    cy.get('input#fictitiousTaxPointRelation').type('12345-67890');
    cy.get('input#fictitiousPrice').type('2500');

    // Klicka på Avbryt
    cy.contains('button', 'Avbryt').click();

    // Verifiera att modalen stängdes ordentligt
    cy.contains('h2', 'Lägg till fiktiv bokning').should('not.exist');
  });

  it('prevents submission of a fictitious booking with empty fields', () => {
    // Öppna popupen
    cy.contains('button', 'Lägg till fiktiv bokning').click();
    cy.contains('h2', 'Lägg till fiktiv bokning').should('be.visible');

    // Klicka "Lägg till"
    cy.contains('button', /^Lägg till$/).click();

    // Eftersom vi inte fyllt i något ska modalen inte stängas, 
    // utan stanna kvar och visa röd varningstext.
    cy.contains('h2', 'Lägg till fiktiv bokning').should('be.visible');

    // Stäng ner för att avsluta testet
    cy.contains('button', 'Avbryt').click();
  });
  
  it('displays the result sections even when they are empty', () => {
    // Kollar att Resultat-sektionerna renderas på skärmen
    cy.contains('h2', 'Valt ekipage').should('be.visible');
    cy.contains('h2', 'Oplacerade bokningar').should('be.visible');
    cy.contains('h3', 'Fiktiva bokningar').should('be.visible');
    cy.contains('h2', 'Simulerad effekt').should('be.visible');
    
    // Eftersom inget är valt än bör systemet be användaren välja ekipage
    cy.contains('Välj först ett ekipage.').should('be.visible');
  });
});