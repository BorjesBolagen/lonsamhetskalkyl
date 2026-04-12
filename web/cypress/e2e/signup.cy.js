describe('sign up tests', () => {
  beforeEach(() => {
    cy.loginAs('admin');
    cy.visit("/admin");
    cy.get('[data-testid="signup-button"]').should("be.visible");
    cy.get('[data-testid="signup-button"]').click();
  });

  it('sign up with missing parameters', () => {
    // Missing first name
    cy.signupUser("", 'lastname', 'email@test.com', 'password123', 'Trafikledare');
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Alla fält måste vara ifyllda");
    cy.clearSignupForm();

    // Missing last name
    cy.signupUser('firstname', "", 'email@test.com', 'password123', 'Trafikledare');
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Alla fält måste vara ifyllda");
    cy.clearSignupForm();

    // Missing email
    cy.signupUser('firstname', 'lastname', "", 'password123', 'Trafikledare');
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Alla fält måste vara ifyllda");
    cy.clearSignupForm();

    // Missing password
    cy.signupUser('firstname', 'lastname', 'email@test.com', "", 'Trafikledare');
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Alla fält måste vara ifyllda");
    cy.clearSignupForm();

    // Missing role
    cy.signupUser('firstname', 'lastname', 'email@test.com', 'password123', "");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Alla fält måste vara ifyllda");
    cy.clearSignupForm();

  });

  it('sign up with bad email', () => {

    cy.signupUser("firstname", "lastname", "email", "password123", "Trafikledare");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Fel vid registrering: Email är inte rätt formaterat");
    cy.clearSignupForm();

    cy.signupUser("firstname", "lastname", "email@", "password123", "Trafikledare");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Fel vid registrering: Email är inte rätt formaterat");
    cy.clearSignupForm();

    cy.signupUser("firstname", "lastname", "email@example", "password123", "Trafikledare");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Fel vid registrering: Email är inte rätt formaterat");
    cy.clearSignupForm();

    cy.signupUser("firstname", "lastname", "email@.com", "password123", "Trafikledare");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Fel vid registrering: Email är inte rätt formaterat");
    cy.clearSignupForm();

    cy.signupUser("firstname", "lastname", "email@example.", "password123", "Trafikledare");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Fel vid registrering: Email är inte rätt formaterat");
    cy.clearSignupForm();

    cy.signupUser("firstname", "lastname", "@example.com", "password123", "Trafikledare");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Fel vid registrering: Email är inte rätt formaterat");
    cy.clearSignupForm();
  })

  it('sign up with bad password', () => {

    cy.signupUser("firstname", "lastname", "email@example.com", "pass", "Trafikledare");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Fel vid registrering: Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra");
    cy.clearSignupForm();

    cy.signupUser("firstname", "lastname", "email@example.com", "longpasswordbutnonumbers", "Trafikledare");
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", "Fel vid registrering: Lösenordet måste vara minst 7 tecken långt och innehålla minst 1 siffra");
    cy.clearSignupForm();

  });

  /**
   * Sign up valid user
   * check if user is in supabase
   * get user id
   * delete user
   * Denna kan faila om man anropar den för mycket. Supabase har em email-rate limit på 2 mejl i timmen.
   * I så fall får man felet "Fel vid registrering: email rate limit exceeded" och HTTP 429
   */
  it('correctly sign up a user - see comments if fail', () => {

    const firstName = "first";
    const lastName = "user";
    const password = "Validpassword123";
    const role = "Trafikledare";

    const serverId = "ubz4dvwg"
    const serverDomain = "ubz4dvwg.mailosaur.net";
    const email = "first.user@" + serverDomain;

    const emailedAfter = new Date();

    cy.signupUser(firstName, lastName, email, password, role)
    const correctOutput = `Skapade användare ${email}. Ett verifieringsmail har skickats. Kom ihåg att kolla skräpposten.`;
    cy.get('[data-testid="signup-response"]').should("be.visible").and("contain", correctOutput);

    cy.mailosaurGetMessage(serverId, 
      { sentTo: email },
      { receivedAfter: emailedAfter, timeout: 30000 }).then((message) => {
      const verificationLink = message.html.links[0].href;
      cy.visit(verificationLink);   // This should redirect to /login
    });

    // Now with verified email try logging in as signed up user

    // Login with new user
    cy.get('[data-testid="email-input"]').should("be.visible").type(email);
    cy.get('[data-testid="password-input"]').should("be.visible").type(password);
    cy.get('[data-testid="login-button"]').should("be.visible").click()

    // Verify that we are logged in
    cy.url().should("include", "/home")

    // Check if the new user is in supabase
    
    cy.request('http://localhost:3000/api/users/')
      .then((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.status).to.eq(true);
        expect(response.body.message).to.eq("Users fetched successfully");
        expect(response.body.data).to.have.length(1);       // Should only be self
        expect(response.body.data[0].email).to.eq(email);   // Make sure email is same
        expect(response.body.data[0].email_verified).to.eq(true);   // Email should be marked as verified
        
        // Get user id
        const userId = response.body.data[0].id;

        // Log out of new user
        cy.get('[data-testid="logout-button"]').should("be.visible").click();

        // Login as admin and delete user
        cy.loginAs('admin');
        cy.request({
          method: 'DELETE',
          url: "http://localhost:3000/api/users/delete/user",
          headers: { 'Content-type': 'application/json' },
          body: { userId: userId },
          }).should((deleteResponse) => {
            expect(deleteResponse.status).to.eq(200);
          });
    });
  });
});
