/**
 * Legal Documents API
 *
 * Endpoints para gestionar documentos legales (TOS, Privacy Policy).
 * Sistema diseñado para:
 * - Versionado de documentos
 * - Multi-idioma (locale)
 * - Tracking de aceptación por usuario
 * - Forzar re-aceptación cuando hay nuevas versiones
 */

import { Router, Request, Response } from "express";
import { prisma } from "../db";
import { requireAuth } from "../middleware/requireAuth";
import { LegalDocumentType, PlatformRole } from "@prisma/client";

// Tipo extendido de Request con autenticación
interface AuthenticatedRequest extends Request {
  auth?: { userId: string; platformRole: PlatformRole };
}

const router = Router();

// =========================================================================
// CONSTANTES - Versiones actuales de documentos legales
// Actualizar estas constantes cuando se publiquen nuevas versiones
// =========================================================================
export const CURRENT_LEGAL_VERSIONS = {
  TERMS_OF_SERVICE: "2026-01-25",
  PRIVACY_POLICY: "2026-01-25",
} as const;

// =========================================================================
// GET /legal/documents/:type
// Obtiene el documento legal activo para un tipo específico
// =========================================================================
router.get("/documents/:type", async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const locale = (req.query.locale as string) || "es";

    // Validar tipo (acepta alias cortos o nombres completos)
    const typeMap: Record<string, LegalDocumentType> = {
      terms: "TERMS_OF_SERVICE",
      privacy: "PRIVACY_POLICY",
      TERMS_OF_SERVICE: "TERMS_OF_SERVICE",
      PRIVACY_POLICY: "PRIVACY_POLICY",
    };

    const documentType = type ? typeMap[type] : undefined;
    if (!documentType) {
      return res.status(400).json({
        error: "INVALID_TYPE",
        message: "Tipo de documento inválido. Use 'terms', 'privacy', 'TERMS_OF_SERVICE' o 'PRIVACY_POLICY'.",
      });
    }

    // Buscar documento activo
    const document = await prisma.legalDocument.findFirst({
      where: {
        type: documentType,
        locale,
        isActive: true,
      },
      select: {
        id: true,
        type: true,
        version: true,
        title: true,
        content: true,
        locale: true,
        publishedAt: true,
        effectiveAt: true,
      },
    });

    if (!document) {
      return res.status(404).json({
        error: "DOCUMENT_NOT_FOUND",
        message: `No hay documento ${type} activo para el idioma ${locale}.`,
      });
    }

    return res.json({ document });
  } catch (error) {
    console.error("Error fetching legal document:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al obtener el documento.",
    });
  }
});

// =========================================================================
// GET /legal/current-versions
// Obtiene las versiones actuales de todos los documentos legales
// =========================================================================
router.get("/current-versions", async (_req: Request, res: Response) => {
  try {
    const locale = (_req.query.locale as string) || "es";

    // Buscar documentos activos
    const [terms, privacy] = await Promise.all([
      prisma.legalDocument.findFirst({
        where: { type: "TERMS_OF_SERVICE", locale, isActive: true },
        select: { version: true, title: true, publishedAt: true },
      }),
      prisma.legalDocument.findFirst({
        where: { type: "PRIVACY_POLICY", locale, isActive: true },
        select: { version: true, title: true, publishedAt: true },
      }),
    ]);

    return res.json({
      versions: {
        termsOfService: terms?.version || CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE,
        privacyPolicy: privacy?.version || CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY,
      },
      documents: {
        termsOfService: terms,
        privacyPolicy: privacy,
      },
    });
  } catch (error) {
    console.error("Error fetching current versions:", error);
    return res.status(500).json({
      error: "INTERNAL_ERROR",
      message: "Error al obtener versiones.",
    });
  }
});

// =========================================================================
// GET /legal/consent-status
// Verifica si el usuario tiene los documentos legales actualizados aceptados
// =========================================================================
router.get(
  "/consent-status",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth!.userId;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          acceptedTermsVersion: true,
          acceptedTermsAt: true,
          acceptedPrivacyVersion: true,
          acceptedPrivacyAt: true,
          ageVerifiedAt: true,
          marketingConsent: true,
        },
      });

      if (!user) {
        return res.status(404).json({
          error: "USER_NOT_FOUND",
          message: "Usuario no encontrado.",
        });
      }

      // Verificar si las versiones aceptadas coinciden con las actuales
      const termsUpToDate =
        user.acceptedTermsVersion === CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE;
      const privacyUpToDate =
        user.acceptedPrivacyVersion === CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY;

      return res.json({
        consent: {
          termsOfService: {
            accepted: !!user.acceptedTermsAt,
            version: user.acceptedTermsVersion,
            acceptedAt: user.acceptedTermsAt,
            isUpToDate: termsUpToDate,
            currentVersion: CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE,
          },
          privacyPolicy: {
            accepted: !!user.acceptedPrivacyAt,
            version: user.acceptedPrivacyVersion,
            acceptedAt: user.acceptedPrivacyAt,
            isUpToDate: privacyUpToDate,
            currentVersion: CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY,
          },
          ageVerified: !!user.ageVerifiedAt,
          marketingConsent: user.marketingConsent,
        },
        requiresUpdate: !termsUpToDate || !privacyUpToDate,
      });
    } catch (error) {
      console.error("Error fetching consent status:", error);
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al verificar estado de consentimiento.",
      });
    }
  }
);

// =========================================================================
// POST /legal/accept
// Registra la aceptación de documentos legales por el usuario
// =========================================================================
router.post(
  "/accept",
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.auth!.userId;
      const { acceptTerms, acceptPrivacy, acceptAge, acceptMarketing } = req.body;

      // Validar que al menos se está aceptando algo
      if (!acceptTerms && !acceptPrivacy && acceptAge === undefined) {
        return res.status(400).json({
          error: "VALIDATION_ERROR",
          message: "Debe especificar qué documentos acepta.",
        });
      }

      const updateData: Record<string, any> = {};
      const now = new Date();

      if (acceptTerms === true) {
        updateData.acceptedTermsAt = now;
        updateData.acceptedTermsVersion = CURRENT_LEGAL_VERSIONS.TERMS_OF_SERVICE;
      }

      if (acceptPrivacy === true) {
        updateData.acceptedPrivacyAt = now;
        updateData.acceptedPrivacyVersion = CURRENT_LEGAL_VERSIONS.PRIVACY_POLICY;
      }

      if (acceptAge === true) {
        updateData.ageVerifiedAt = now;
      }

      if (acceptMarketing !== undefined) {
        updateData.marketingConsent = acceptMarketing;
        updateData.marketingConsentAt = acceptMarketing ? now : null;
      }

      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: updateData,
        select: {
          acceptedTermsVersion: true,
          acceptedTermsAt: true,
          acceptedPrivacyVersion: true,
          acceptedPrivacyAt: true,
          ageVerifiedAt: true,
          marketingConsent: true,
        },
      });

      return res.json({
        message: "Consentimiento registrado exitosamente.",
        consent: updatedUser,
      });
    } catch (error) {
      console.error("Error accepting legal documents:", error);
      return res.status(500).json({
        error: "INTERNAL_ERROR",
        message: "Error al registrar consentimiento.",
      });
    }
  }
);

export default router;
