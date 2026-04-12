/**
 * Test suite for the policies in supabase
 */

describe('Supabase policies', () => {
  it('admin log in - should see all users according to policies', () => {
    cy.loginAs('admin');

    cy.request('http://localhost:3000/api/users/')
    .should((response) => {
      expect(response.status).to.eq(200);
      expect(response.body.status).to.eq(true);
      expect(response.body.message).to.eq("Users fetched successfully");
      expect(response.body.data).to.have.length.greaterThan(1);   // Assuming we have more than 1 total users in the database

    });
  });

  it('leader log in - should only see self', () => {
    cy.loginAs('leader');

    cy.env(['users']).then(({ users }) => {
      cy.request('http://localhost:3000/api/users/')
      .should((response) => {
        expect(response.status).to.eq(200);
        expect(response.body.status).to.eq(true);
        expect(response.body.message).to.eq("Users fetched successfully");
        expect(response.body.data).to.have.length(1);                   // Should only be self
        expect(response.body.data[0].email).to.eq(users.leader.email);  // Make sure email is same

        
      });
    });
  });
});