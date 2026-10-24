/** User lookup port; hashes are private to authentication code. */
export interface IUserRepository {
  findByEmail(email: string): Promise<{
    id: string;
    tenantId: string;
    email: string;
    passwordHash: string;
    role: "ADMIN" | "ACCOUNTANT" | "AUDITOR" | "VIEWER";
  } | null>;
}
