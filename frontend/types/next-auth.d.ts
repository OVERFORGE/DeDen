// types/next-auth.d.ts
import { UserRole } from "@prisma/client"; // 1. Import your Prisma enum
import NextAuth, { DefaultSession, DefaultUser } from "next-auth";
import { JWT, DefaultJWT } from "next-auth/jwt";

declare module "next-auth" {
  /**
   * The session object returned from useSession() or getSession().
   */
  interface Session {
    user: {
      id: string;
      userRole: UserRole; // 2. Add your userRole
    } & DefaultSession["user"];
  }

  /**
   * The user object returned from the database.
   */
  interface User extends DefaultUser {
    userRole: UserRole; // 3. Add userRole here too
  }
}

declare module "next-auth/jwt" {
  /**
   * The JWT token that is stored in the cookie.
   */
  interface JWT extends DefaultJWT {
    userRole: UserRole; // 4. Add userRole to the token
  }
}