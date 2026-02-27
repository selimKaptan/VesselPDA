import type { Express } from "express";
import { authStorage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { sendVerificationEmail, sendPasswordResetEmail } from "../../email";

function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function registerAuthRoutes(app: Express): void {
  app.get("/api/auth/user", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  app.post("/api/auth/register", async (req: any, res) => {
    try {
      const { email, password, firstName, lastName, userRole } = req.body;

      if (!email || !password || !firstName || !lastName) {
        return res.status(400).json({ message: "All fields are required" });
      }

      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const existingUser = await authStorage.getUserByEmail(email);

      if (existingUser) {
        if (existingUser.passwordHash) {
          return res.status(409).json({ message: "Email already in use" });
        }
        const passwordHash = await bcrypt.hash(password, 12);
        const token = generateToken();
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

        await authStorage.updatePassword(existingUser.id, passwordHash);
        await authStorage.setVerificationToken(existingUser.id, token, expiry);

        try {
          await sendVerificationEmail(email, existingUser.firstName || firstName, token);
        } catch (e) {
          console.error("[auth] Failed to send verification email:", e);
        }

        return res.json({ message: "Verification email sent" });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      const token = generateToken();
      const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await authStorage.createUser({
        email,
        passwordHash,
        firstName,
        lastName,
        userRole: userRole || "shipowner",
        roleConfirmed: true,
        verificationToken: token,
        verificationTokenExpiry: expiry,
      });

      try {
        await sendVerificationEmail(email, firstName, token);
      } catch (e) {
        console.error("[auth] Failed to send verification email:", e);
      }

      res.json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  app.post("/api/auth/login", async (req: any, res) => {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await authStorage.getUserByEmail(email);

      if (!user || !user.passwordHash) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid email or password" });
      }

      if (!user.emailVerified) {
        return res.status(403).json({ message: "email_not_verified", email: user.email });
      }

      req.session.userId = user.id;
      res.json(user);
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", async (req: any, res) => {
    req.session.destroy((err: any) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ message: "Logged out" });
    });
  });

  app.get("/api/auth/verify-email", async (req: any, res) => {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json({ message: "Token is required" });
      }

      const user = await authStorage.getUserByVerificationToken(token as string);

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired verification link" });
      }

      if (user.verificationTokenExpiry && new Date() > user.verificationTokenExpiry) {
        return res.status(400).json({ message: "Verification link has expired" });
      }

      await authStorage.markEmailVerified(user.id);
      res.json({ message: "Email verified successfully" });
    } catch (error) {
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Verification failed" });
    }
  });

  app.post("/api/auth/resend-verification", async (req: any, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await authStorage.getUserByEmail(email);

      if (user && !user.emailVerified) {
        const token = generateToken();
        const expiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
        await authStorage.setVerificationToken(user.id, token, expiry);
        try {
          await sendVerificationEmail(email, user.firstName || "User", token);
        } catch (e) {
          console.error("[auth] Failed to send verification email:", e);
        }
      }

      res.json({ message: "If that email exists, a verification link has been sent" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ message: "Failed to resend verification" });
    }
  });

  app.post("/api/auth/forgot-password", async (req: any, res) => {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      const user = await authStorage.getUserByEmail(email);

      if (user && user.emailVerified) {
        const token = generateToken();
        const expiry = new Date(Date.now() + 60 * 60 * 1000);
        await authStorage.setResetToken(user.id, token, expiry);
        try {
          await sendPasswordResetEmail(email, user.firstName || "User", token);
        } catch (e) {
          console.error("[auth] Failed to send reset email:", e);
        }
      }

      res.json({ message: "If that email exists, a password reset link has been sent" });
    } catch (error) {
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Failed to process request" });
    }
  });

  app.post("/api/auth/reset-password", async (req: any, res) => {
    try {
      const { token, newPassword } = req.body;

      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }

      if (newPassword.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const user = await authStorage.getUserByResetToken(token);

      if (!user) {
        return res.status(400).json({ message: "Invalid or expired reset link" });
      }

      if (user.resetPasswordTokenExpiry && new Date() > user.resetPasswordTokenExpiry) {
        return res.status(400).json({ message: "Reset link has expired" });
      }

      const passwordHash = await bcrypt.hash(newPassword, 12);
      await authStorage.updatePassword(user.id, passwordHash);
      await authStorage.clearResetToken(user.id);

      res.json({ message: "Password updated successfully" });
    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Password reset failed" });
    }
  });

  app.get("/api/logout", (req: any, res) => {
    req.session.destroy(() => {
      res.redirect("/");
    });
  });
}
