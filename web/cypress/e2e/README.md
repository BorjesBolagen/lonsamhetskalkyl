# TESTFILER
Under mappen cypress/e2e/ ligger alla testfiler för systemet.
E2E-test står för End-to-End test och i princip simulerar en riktig användare som klickar runt på hemsidan för att kolla att hela systemet fungerar som det ska.
Under cypress/e2e/2-advanced-examples finns massa exempel på tester för cypress egna hemsida.
Under cypress/e2e ligger våra tester

Starta testerna genom att:
1. `npm install` i web/ borde fungera alternativt `npm install cypress` och `npm i -D cypress-mailosaur` 
2. `npm run dev`
3. `npm run cypress:open` i ny terminal
4. Välj "E2E Testing" i appen som öppnas
5. Välj en webbläsare och klicka "Start E2E Testing"
6. Klicka på en testfil för att köra den

## Miljövariabler
Testerna använder inloggningsuppgifter från en lokal fil som inte pushas till git.
1. Skapa en fil som heter cypress.env.json i projektets rotmapp (där cypress.env.example.json ligger)
2. Kopiera innehållet från cypress.env.example.json och fyll i riktiga värden
3. env filen finns i discord under #testing

## Lägga till nya tester
Skapa en ny fil under cypress/e2e/ med ändelsen .cy.ts, till exempel saker.cy.ts.