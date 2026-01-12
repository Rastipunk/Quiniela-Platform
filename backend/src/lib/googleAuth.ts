// backend/src/lib/googleAuth.ts
import { OAuth2Client } from "google-auth-library";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;

if (!GOOGLE_CLIENT_ID) {
  console.warn("⚠️  GOOGLE_CLIENT_ID no configurado. Google OAuth NO funcionará.");
}

const client = GOOGLE_CLIENT_ID ? new OAuth2Client(GOOGLE_CLIENT_ID) : null;

export interface GoogleUser {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
  picture?: string;
}

/**
 * Verifica un token de Google ID y extrae la información del usuario
 * @param token - ID token recibido desde el frontend (Google Sign In)
 * @returns Información del usuario de Google o null si el token es inválido
 */
export async function verifyGoogleToken(token: string): Promise<GoogleUser | null> {
  if (!client) {
    console.error("❌ Google OAuth no configurado (falta GOOGLE_CLIENT_ID)");
    return null;
  }

  try {
    const ticket = await client.verifyIdToken({
      idToken: token,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload) {
      console.error("❌ Token de Google válido pero sin payload");
      return null;
    }

    // Extraer información del usuario
    const googleUser: GoogleUser = {
      googleId: payload.sub, // Google User ID (único)
      email: payload.email || "",
      emailVerified: payload.email_verified || false,
      name: payload.name || "",
      picture: payload.picture,
    };

    // Validar que el email exista y esté verificado
    if (!googleUser.email || !googleUser.emailVerified) {
      console.error("❌ Google token sin email verificado");
      return null;
    }

    return googleUser;
  } catch (error) {
    console.error("❌ Error verificando token de Google:", error);
    return null;
  }
}
